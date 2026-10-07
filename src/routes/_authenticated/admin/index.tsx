import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Eye, EyeOff, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isVideoFile, uploadVideoWithProgress, freshToken, friendlyError, UPLOAD_CANCELLED } from "@/lib/upload-video";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminVideos,
});

type VideoRow = {
  id: string;
  title: string;
  storage_path: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

async function fetchVideos(): Promise<VideoRow[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("id, title, storage_path, is_active, sort_order, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function AdminVideos() {
  const qc = useQueryClient();
  const { data: videos, isLoading } = useQuery({ queryKey: ["admin-videos"], queryFn: fetchVideos });
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      dragDepth.current += 1;
      setDragging(true);
    }
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (uploading !== null) return;
    void startUpload(Array.from(e.dataTransfer.files));
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    e.target.value = "";
    void startUpload(all);
  }

  async function startUpload(all: File[]) {
    const files = all.filter((file) => {
      if (!isVideoFile(file)) {
        toast.error(`${file.name} is not a video file.`);
        return false;
      }
      if (file.size > 200 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 200 MB.`);
        return false;
      }
      return true;
    });
    if (files.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const { data: auth } = await supabase.auth.getUser();
    const total = files.reduce((s, f) => s + f.size, 0);
    const loaded = new Map<File, number>();
    let done = 0;
    const update = () => {
      const sum = files.reduce((s, f) => s + (loaded.get(f) ?? 0), 0);
      setProgress(Math.round((sum / total) * 100));
      setUploading(`${done} of ${files.length} videos done`);
    };
    update();

    async function uploadOne(file: File) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safe}`;
      try {
        await uploadVideoWithProgress(path, file, (pct) => {
          loaded.set(file, (file.size * pct) / 100);
          update();
        }, controller.signal);
      } catch (err) {
        if ((err as Error).message !== UPLOAD_CANCELLED) {
          toast.error(`Upload failed for ${file.name}: ${(err as Error).message}`);
        }
        loaded.set(file, file.size);
        return;
      }
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      await freshToken().catch(() => {});
      const { error: dbErr } = await supabase.from("videos").insert({
        title,
        storage_path: path,
        uploaded_by: auth.user?.id ?? null,
      });
      if (dbErr) toast.error(`${file.name}: ${friendlyError(dbErr.message)}`);
      else qc.invalidateQueries({ queryKey: ["admin-videos"] });
    }

    // Upload up to 3 files at the same time.
    const queue = [...files];
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const f = queue.shift()!;
        await uploadOne(f);
        done++;
        update();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
    if (controller.signal.aborted) toast("Upload stoppet.");
    else toast.success(`Finished uploading ${files.length} video${files.length > 1 ? "s" : ""}`);
    abortRef.current = null;
    setUploading(null);
    qc.invalidateQueries({ queryKey: ["admin-videos"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  const toggle = useMutation({
    mutationFn: async (v: VideoRow) => {
      const { error } = await supabase.from("videos").update({ is_active: !v.is_active }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error("Could not update video."),
  });

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("videos").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-videos"] }),
    onError: () => toast.error("Could not rename video."),
  });

  const remove = useMutation({
    mutationFn: async (v: VideoRow) => {
      const { error } = await supabase.from("videos").delete().eq("id", v.id);
      if (error) throw error;
      await supabase.storage.from("videos").remove([v.storage_path]);
    },
    onSuccess: () => {
      toast.success("Video deleted");
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error("Could not delete video."),
  });

  async function openPreview(v: VideoRow) {
    const { data, error } = await supabase.storage.from("videos").createSignedUrl(v.storage_path, 600);
    if (error || !data) {
      toast.error("Could not load preview.");
      return;
    }
    setPreview(data.signedUrl);
  }

  const activeCount = videos?.filter((v) => v.is_active).length ?? 0;

  return (
    <section
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="relative"
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-background/80">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="size-8" />
            <span className="text-sm font-semibold">Slip videoerne her for at uploade</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Feed videos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {videos?.length ?? 0} uploaded · {activeCount} active in the feed. Each participant sees active videos in
            their own random order.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,.mov,.mp4,.m4v,.webm"
          multiple
          hidden
          onChange={onFiles}
        />
        <button
          type="button"
          disabled={uploading !== null}
          onClick={() => fileRef.current?.click()}
          className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? `Uploading… ${progress}%` : "Upload videos"}
        </button>
      </div>
      {uploading && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate">{uploading}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Keep this page open until the upload finishes.</p>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-destructive/20 hover:text-destructive"
            >
              Stop upload
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !videos || videos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-8 flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border px-6 py-16 text-center text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <Upload className="size-8" />
          <span className="font-medium">Tap to upload your first videos</span>
          <span className="text-xs">MP4 / WebM / MOV, up to 200 MB each</span>
        </button>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {videos.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => openPreview(v)}
                aria-label="Preview"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted"
              >
                <Play className="size-4 fill-current" />
              </button>
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={v.title}
                  onBlur={(e) => {
                    const t = e.target.value.trim();
                    if (t && t !== v.title) rename.mutate({ id: v.id, title: t });
                  }}
                  className="w-full truncate bg-transparent text-sm font-semibold outline-none focus:underline"
                  aria-label="Video title"
                />
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString()} · {v.is_active ? "Active" : "Hidden"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle.mutate(v)}
                aria-label={v.is_active ? "Hide from feed" : "Show in feed"}
                className={`flex size-10 items-center justify-center rounded-xl ${
                  v.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {v.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${v.title}"? This cannot be undone.`)) remove.mutate(v);
                }}
                aria-label="Delete"
                className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreview(null)}
        >
          <video src={preview} controls autoPlay className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
    </section>
  );
}

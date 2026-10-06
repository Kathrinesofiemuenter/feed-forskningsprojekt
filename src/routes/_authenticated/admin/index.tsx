import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Eye, EyeOff, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isVideoFile, uploadVideoWithProgress } from "@/lib/upload-video";

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

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const { data: auth } = await supabase.auth.getUser();
    let i = 0;
    for (const file of files) {
      i++;
      const label = files.length > 1 ? `${file.name} (${i}/${files.length})` : file.name;
      if (!isVideoFile(file)) {
        toast.error(`${file.name} is not a video file.`);
        continue;
      }
      if (file.size > 200 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 200 MB.`);
        continue;
      }
      setUploading(label);
      setProgress(0);
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safe}`;
      try {
        await uploadVideoWithProgress(path, file, setProgress);
      } catch (err) {
        toast.error(`Upload failed for ${file.name}: ${(err as Error).message}`);
        continue;
      }
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      const { error: dbErr } = await supabase.from("videos").insert({
        title,
        storage_path: path,
        uploaded_by: auth.user?.id ?? null,
      });
      if (dbErr) {
        toast.error(`Saved file but could not register ${file.name}.`);
        continue;
      }
      toast.success(`Uploaded ${file.name}`);
      qc.invalidateQueries({ queryKey: ["admin-videos"] });
    }
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
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Feed videos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {videos?.length ?? 0} uploaded · {activeCount} active in the feed. Each participant sees active videos in
            their own random order.
          </p>
        </div>
        <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={onFiles} />
        <button
          type="button"
          disabled={uploading !== null}
          onClick={() => fileRef.current?.click()}
          className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? `Uploading ${uploading}…` : "Upload videos"}
        </button>
      </div>

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

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SURVEY_ITEMS } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: Analytics,
});

type ResponseRow = {
  id: string;
  username: string;
  survey_date: string;
  glad: number;
  tilfreds: number;
  haebefuld: number;
  bekymret: number;
  ensom: number;
  irritabel: number;
  feed_seconds_at_submit: number | null;
  submitted_at: string;
};

type SortKey = "username" | "submitted_at";

async function fetchResponses(): Promise<ResponseRow[]> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select(
      "id, username, survey_date, glad, tilfreds, haebefuld, bekymret, ensom, irritabel, feed_seconds_at_submit, submitted_at",
    )
    .order("submitted_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data ?? [];
}

function toCsv(rows: ResponseRow[]): string {
  const headers = [
    "username",
    "submitted_at",
    "survey_date",
    ...SURVEY_ITEMS.map((i) => i.key),
    "feed_seconds_at_submit",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.username,
      r.submitted_at,
      r.survey_date,
      ...SURVEY_ITEMS.map((i) => r[i.key]),
      r.feed_seconds_at_submit,
    ]
      .map(esc)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function Analytics() {
  const { data: rows, isLoading, error } = useQuery({ queryKey: ["survey-responses"], queryFn: fetchResponses });
  const [sortKey, setSortKey] = useState<SortKey>("submitted_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])];
    list.sort((a, b) => {
      const cmp =
        sortKey === "username"
          ? a.username.localeCompare(b.username)
          : a.submitted_at.localeCompare(b.submitted_at);
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, dir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "username" ? "asc" : "desc");
    }
  }

  function exportCsv() {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey_responses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const participants = new Set(rows?.map((r) => r.username)).size;

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? (
      <ArrowUpDown className="size-3.5 opacity-50" />
    ) : dir === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Survey responses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows?.length ?? 0} responses from {participants} participant{participants === 1 ? "" : "s"}. Scale 1 =
            Slet ikke, 5 = I meget høj grad.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!rows || rows.length === 0}
          className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 disabled:opacity-50"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="mt-8 text-sm text-destructive">Could not load responses.</p>
      ) : sorted.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No responses yet. They appear here as soon as participants complete a daily check-in.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("username")} className="flex items-center gap-1.5 font-semibold">
                    username <SortIcon k="username" />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort("submitted_at")} className="flex items-center gap-1.5 font-semibold">
                    submitted_at <SortIcon k="submitted_at" />
                  </button>
                </th>
                {SURVEY_ITEMS.map((i) => (
                  <th key={i.key} className="px-3 py-3 text-center font-semibold">
                    {i.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold">feed min</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{r.username}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(r.submitted_at).toLocaleString()}
                  </td>
                  {SURVEY_ITEMS.map((i) => (
                    <td key={i.key} className="px-3 py-3 text-center tabular-nums">
                      {r[i.key]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {r.feed_seconds_at_submit === null ? "–" : Math.round(r.feed_seconds_at_submit / 60)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <VoiceMemos />
    </section>
  );
}

type MemoRow = { id: string; username: string; memo_date: string; submitted_at: string; duration_seconds: number; storage_path: string };

async function fetchMemos() {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("id, username, memo_date, submitted_at, duration_seconds, storage_path")
    .order("submitted_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as MemoRow[];
}

function VoiceMemos() {
  const { data: memos, isLoading } = useQuery({ queryKey: ["voice-memos"], queryFn: fetchMemos });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<string | null>(null);

  async function load(m: MemoRow) {
    const { data } = await supabase.storage.from("voice-memos").createSignedUrl(m.storage_path, 3600);
    if (data?.signedUrl) setUrls((u) => ({ ...u, [m.id]: data.signedUrl }));
  }

  async function exportMp3(m: MemoRow) {
    setExporting(m.id);
    try {
      let url = urls[m.id];
      if (!url) {
        const { data } = await supabase.storage.from("voice-memos").createSignedUrl(m.storage_path, 3600);
        url = data?.signedUrl;
        if (url) setUrls((u) => ({ ...u, [m.id]: url! }));
      }
      if (!url) throw new Error("no url");
      const { exportVoiceMemoAsMp3 } = await import("@/lib/export-voice-memo");
      await exportVoiceMemoAsMp3(url, m.username, m.memo_date);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold">Voice memos</h2>
      <p className="mt-1 text-sm text-muted-foreground">{memos?.length ?? 0} memos.</p>
      {isLoading ? (
        <Loader2 className="mt-6 size-6 animate-spin text-muted-foreground" />
      ) : !memos || memos.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No voice memos yet.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-border rounded-3xl border border-border bg-card">
          {memos.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
              <span className="w-32 font-semibold">{m.username}</span>
              <span className="w-44 text-muted-foreground">{new Date(m.submitted_at).toLocaleString()}</span>
              <span className="w-12 tabular-nums text-muted-foreground">{m.duration_seconds}s</span>
              {urls[m.id] ? (
                <audio controls src={urls[m.id]} className="h-9 flex-1" />
              ) : (
                <button type="button" onClick={() => load(m)} className="rounded-lg bg-muted px-3 py-1.5 font-semibold">
                  Play
                </button>
              )}
              <button
                type="button"
                onClick={() => exportMp3(m)}
                disabled={exporting === m.id}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {exporting === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                MP3
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

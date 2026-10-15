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

/** Feed time as minutes:seconds, e.g. 1586 s -> "26:26". */
function formatDayMin(seconds: number | undefined): string {
  if (seconds === undefined) return "–";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Times are shown in Danish time, whatever machine the CSV is made on. */
const SUBMITTED_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Copenhagen",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "15.10.2026, 09.41.32" */
function formatSubmitted(iso: string): string {
  const p: Record<string, string> = {};
  for (const part of SUBMITTED_FMT.formatToParts(new Date(iso))) p[part.type] = part.value;
  return `${p["day"]}.${p["month"]}.${p["year"]}, ${p["hour"]}.${p["minute"]}.${p["second"]}`;
}

function toCsv(rows: ResponseRow[], daySeconds: Map<string, number>): string {
  const headers = [
    "username",
    "submitted_at",
    ...SURVEY_ITEMS.map((i) => i.label),
    "feed min (day)",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.username,
      formatSubmitted(r.submitted_at),
      ...SURVEY_ITEMS.map((i) => r[i.key]),
      formatDayMin(daySeconds.get(`${r.username}|${r.survey_date}`)),
    ]
      .map(esc)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function Analytics() {
  const { data: rows, isLoading, error } = useQuery({ queryKey: ["survey-responses"], queryFn: fetchResponses });
  // Same query key as the Watch time table below, so the numbers are fetched once.
  const { data: usage } = useQuery({ queryKey: ["feed-usage"], queryFn: fetchUsage });
  const daySeconds = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of usage ?? []) m.set(`${u.username}|${u.usage_date}`, u.seconds);
    return m;
  }, [usage]);
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
    // BOM so Excel reads æ/å/ø correctly.
    const blob = new Blob(["\uFEFF" + toCsv(sorted, daySeconds)], { type: "text/csv;charset=utf-8" });
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
                <th className="px-4 py-3 text-right font-semibold">feed min (day)</th>
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
                  <td
                    className="px-4 py-3 text-right tabular-nums text-muted-foreground"
                    title="Total feed time for this participant on this day"
                  >
                    {formatDayMin(daySeconds.get(`${r.username}|${r.survey_date}`))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WatchTime />
      <VoiceMemos />
    </section>
  );
}

type UsageRow = { user_id: string; usage_date: string; seconds: number; username: string };

async function fetchUsage(): Promise<UsageRow[]> {
  const [{ data: usage, error: usageError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from("feed_usage").select("user_id, usage_date, seconds").order("usage_date", { ascending: false }).limit(10000),
    supabase.from("profiles").select("id, username").limit(5000),
  ]);
  if (usageError) throw usageError;
  if (profilesError) throw profilesError;
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  return (usage ?? []).map((u) => ({ ...u, username: nameById.get(u.user_id) ?? u.user_id.slice(0, 8) }));
}

function usageCsv(rows: UsageRow[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => [r.username, r.usage_date, r.seconds, Math.round((r.seconds / 60) * 10) / 10].map(esc).join(","));
  return ["username,date,seconds,minutes", ...lines].join("\n");
}

function WatchTime() {
  const { data: rows, isLoading, error } = useQuery({ queryKey: ["feed-usage"], queryFn: fetchUsage });

  function exportCsv() {
    const blob = new Blob([usageCsv(rows ?? [])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watch_time_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Watch time</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Time each participant has spent in the feed per day — including days where the survey was never reached.
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
        <Loader2 className="mt-6 size-6 animate-spin text-muted-foreground" />
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">Could not load watch time.</p>
      ) : !rows || rows.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No watch time recorded yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">username</th>
                <th className="px-4 py-3 font-semibold">date</th>
                <th className="px-4 py-3 text-right font-semibold">minutes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={`${r.user_id}-${r.usage_date}`} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{r.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.usage_date}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {(Math.round((r.seconds / 60) * 10) / 10).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

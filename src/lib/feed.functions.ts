import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Participants have no direct storage access; the server signs short-lived
// view links only for active videos.
export const signFeedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paths: z.array(z.string().min(1).max(500)).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const unique = [...new Set(data.paths)];
    if (unique.length === 0) return {} as Record<string, string>;
    // Lookups and signing are chunked: with a few hundred videos a single
    // request exceeds the server-function request size limit ("Bad Request").
    const CHUNK = 100;
    const allowed: string[] = [];
    for (let i = 0; i < unique.length; i += CHUNK) {
      const { data: rows, error } = await context.supabase
        .from("videos")
        .select("storage_path")
        .eq("is_active", true)
        .in("storage_path", unique.slice(i, i + CHUNK));
      if (error) throw new Error(error.message);
      allowed.push(...(rows ?? []).map((r) => r.storage_path));
    }
    if (allowed.length === 0) return {} as Record<string, string>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, string> = {};
    for (let i = 0; i < allowed.length; i += CHUNK) {
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("videos")
        .createSignedUrls(allowed.slice(i, i + CHUNK), 60 * 60);
      if (sErr) throw new Error(sErr.message);
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
      });
    }
    return out;
  });

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
    const { data: rows, error } = await context.supabase
      .from("videos")
      .select("storage_path")
      .eq("is_active", true)
      .in("storage_path", unique);
    if (error) throw new Error(error.message);
    const allowed = (rows ?? []).map((r) => r.storage_path);
    if (allowed.length === 0) return {} as Record<string, string>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("videos")
      .createSignedUrls(allowed, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    const out: Record<string, string> = {};
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
    });
    return out;
  });

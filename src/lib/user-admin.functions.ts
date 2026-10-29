import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: set a new password for a participant, looked up by username. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
        password: z.string().min(6).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (!profile) return { ok: false as const, reason: "not_found" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only video removal. The file itself is deleted with the privileged
 * client because the storage policies grant reads and signed links to admins
 * but not deletes, so a browser-side remove() silently removes nothing.
 */
export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        storagePath: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    // The row goes first: if the file removal then fails, no participant can
    // reach a video whose file is missing.
    const { error: rowError } = await context.supabase.from("videos").delete().eq("id", data.id);
    if (rowError) throw new Error(rowError.message);

    const safePath = data.storagePath.startsWith("/") ? data.storagePath.slice(1) : data.storagePath;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: fileError } = await supabaseAdmin.storage.from("videos").remove([safePath]);
    return { ok: true, fileRemoved: !fileError };
  });

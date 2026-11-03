import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const prepareConversionUploads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) throw new Error("Forbidden");
    const { data: rows, error: readError } = await context.supabase.from("videos").select("id,storage_path").in("id", data.ids);
    if (readError) throw new Error(readError.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await Promise.all((rows ?? []).map(async row => {
      const path = `optimized-20261103/${row.id}.mp4`;
      const { data: upload, error: uploadError } = await supabaseAdmin.storage.from("videos").createSignedUploadUrl(path, { upsert: true });
      if (uploadError || !upload) throw new Error("Cannot prepare upload");
      return { id: row.id, path, signedUrl: upload.signedUrl };
    }));
  });
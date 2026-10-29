import { useEffect, useState } from "react";
import { Check, CloudUpload, AlertCircle, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listOutbox, retryPending, type OutboxItem } from "@/lib/outbox";
import { Button } from "@/components/ui/button";

export function DeliveryStatus() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [seen, setSeen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const update = async () => {
      const { data } = await supabase.auth.getSession();
      const rows = (await listOutbox()).filter(i => i.userId === data.session?.user.id);
      if (!alive) return;
      setItems(rows);
      if (rows.length) setSeen(true);
    };
    const run = () => { void update().catch(() => undefined); };
    window.addEventListener("outbox-change", run);
    const { data } = supabase.auth.onAuthStateChange(() => { setSeen(false); run(); });
    run();
    return () => { alive = false; window.removeEventListener("outbox-change", run); data.subscription.unsubscribe(); };
  }, []);
  if (!seen && !items.length) return null;
  const blocked = items.some(i => i.blocked);
  return <div role="status" className="fixed inset-x-0 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm">
    {blocked ? <AlertCircle className="size-4 shrink-0 text-destructive" /> : items.length ? <CloudUpload className="size-4 shrink-0 text-accent" /> : <Check className="size-4 shrink-0 text-accent" />}
    <span>{items.length ? "Gemt på telefonen · venter på at sende" : "Dine svar og stemmebeskeder er sendt"}</span>
    {blocked && <Button variant="ghost" size="icon" aria-label="Prøv at sende igen" title="Prøv at sende igen" disabled={busy} onClick={async () => { setBusy(true); try { await retryPending(); } finally { setBusy(false); } }}><RotateCw className={busy ? "animate-spin" : ""} /></Button>}
  </div>;
}
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { resetUserPassword } from "@/lib/user-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Adgangskoder – Feed-forskningsprojekt" }] }),
  component: UsersAdmin,
});

function UsersAdmin() {
  const reset = useServerFn(resetUserPassword);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(uname)) return toast.error("Ugyldigt brugernavn.");
    if (password.length < 6) return toast.error("Adgangskoden skal være mindst 6 tegn.");
    setBusy(true);
    try {
      const res = await reset({ data: { username: uname, password } });
      if (!res.ok) toast.error(`Ingen bruger hedder "${uname}".`);
      else {
        toast.success(`Ny adgangskode sat for ${uname}.`);
        setPassword("");
      }
    } catch {
      toast.error("Kunne ikke ændre adgangskoden.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none ring-ring focus:ring-2";
  return (
    <section className="max-w-md space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <KeyRound className="size-5" /> Nulstil adgangskode
      </h2>
      <p className="text-sm text-muted-foreground">
        Skriv deltagerens brugernavn og en ny adgangskode. Den gamle adgangskode holder op med at virke med det samme.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className={input} placeholder="Brugernavn" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className={input} placeholder="Ny adgangskode (mindst 6 tegn)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Sæt ny adgangskode
        </button>
      </form>
    </section>
  );
}

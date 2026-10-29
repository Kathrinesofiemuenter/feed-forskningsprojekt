import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, Search, Users } from "lucide-react";
import { resetUserPassword, listUsers } from "@/lib/user-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Brugere – Feed-forskningsprojekt" }] }),
  component: UsersAdmin,
});

const dateFmt = new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });

function UsersAdmin() {
  const reset = useServerFn(resetUserPassword);
  const getUsers = useServerFn(listUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [users, setUsers] = useState<Awaited<ReturnType<typeof listUsers>>["users"] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    getUsers()
      .then((res) => {
        if (alive) setUsers(res.users);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [getUsers]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = filter.trim().toLowerCase();
    return q ? users.filter((u) => u.username.toLowerCase().includes(q)) : users;
  }, [users, filter]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(uname)) { toast.error("Ugyldigt brugernavn."); return; }
    if (password.length < 6) { toast.error("Adgangskoden skal være mindst 6 tegn."); return; }
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
  const roleChip = "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

  return (
    <div className="space-y-10">
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

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users className="size-5" /> Brugere
          {users && <span className="text-sm font-normal text-muted-foreground">({users.length})</span>}
        </h2>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${input} pl-10`}
            placeholder="Søg brugernavn…"
            autoCapitalize="none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {loadError && <p className="text-sm text-destructive">Kunne ikke hente brugerlisten.</p>}
        {!users && !loadError && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Henter brugere…
          </p>
        )}
        {users && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {filtered.map((u) => (
              <li key={u.username} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.username}</p>
                  <p className="text-xs text-muted-foreground">Oprettet {dateFmt.format(new Date(u.createdAt))}</p>
                </div>
                {u.role === "admin" ? (
                  <span className={`${roleChip} bg-primary/15 text-primary`}>Admin</span>
                ) : (
                  <span className={`${roleChip} bg-muted text-muted-foreground`}>Deltager</span>
                )}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Ingen brugere matcher søgningen.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { USERNAME_RE, usernameToEmail } from "@/lib/study";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log ind – Feed-forskningsprojekt" },
      { name: "description", content: "Log ind eller opret din deltagerkonto med et brugernavn." },
      { property: "og:title", content: "Log ind – Feed-forskningsprojekt" },
      { property: "og:description", content: "Log ind eller opret din deltagerkonto med et brugernavn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      toast.error("Brugernavnet skal være 3–24 tegn: bogstaver, tal eller underscores.");
      return;
    }
    if (password.length < 6) {
      toast.error("Adgangskoden skal være mindst 6 tegn.");
      return;
    }
    setBusy(true);
    const email = usernameToEmail(uname);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: uname } },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message.includes("registered") ? "Det brugernavn er allerede taget." : error.message);
        return;
      }
      if (!data.session) {
        toast.error("Kontoen blev oprettet, men du kunne ikke logges ind. Prøv at logge ind.");
        setMode("signin");
        return;
      }
      navigate({ to: "/feed", replace: true });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Forkert brugernavn eller adgangskode.");
      return;
    }
    navigate({ to: "/feed", replace: true });
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Play className="size-3.5 fill-current" />
          </span>
          Feed-forskningsprojekt
        </div>

        <h1 className="text-3xl font-bold">{mode === "signin" ? "Velkommen tilbage" : "Opret din konto"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Indtast det brugernavn og den adgangskode, du har fået udleveret."
            : "Vælg et brugernavn og en adgangskode. Der kræves ingen e-mailadresse."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-9 rounded-lg transition ${
                mode === m ? "bg-card text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Log ind" : "Tilmeld"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Brugernavn
            </span>
            <input
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none ring-ring transition focus:ring-2"
              placeholder="e.g. p_042"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Adgangskode
            </span>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none ring-ring transition focus:ring-2"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Log ind" : "Opret konto"}
          </button>
        </form>
      </div>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Play,
  Smartphone,
  ClipboardList,
  Timer,
  Lock,
  ShieldCheck,
  UserCircle2,
  ChevronRight,
  LogIn,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feed-forskningsprojekt – Forskningsfeed med korte videoer" },
      {
        name: "description",
        content:
          "En forskningsundersøgelse om, hvordan et feed med korte videoer påvirker din trivsel. Kun for deltagere.",
      },
      { property: "og:title", content: "Feed-forskningsprojekt – Forskningsfeed med korte videoer" },
      {
        property: "og:description",
        content: "Se korte videoer og besvar en daglig check-in om dit humør.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Play className="size-3.5 fill-current" />
          </span>
          Feed-forskningsprojekt
        </div>
        <Link
          to="/auth"
          className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent active:scale-95"
        >
          Login
        </Link>
      </header>

      <section className="relative z-10 px-6 pt-12">
        <div className="mx-auto max-w-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Forskningsfeed</p>
          <h1 className="text-[2.6rem] font-black leading-[0.98] tracking-tight">
            Se korte videoer.
            <br />
            Daglig check-in
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            En forskningsundersøgelse, der ser på, hvordan et feed med korte videoer påvirker din trivsel. Du skal
            scrolle gennem et feed og derefter besvare seks korte spørgsmål om, hvordan du har det.
          </p>
          <Link
            to="/auth"
            className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            Kom i gang
            <ChevronRight className="size-5" />
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Kun for deltagere · login med et udleveret brugernavn
          </p>
        </div>
      </section>

      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <h2 className="text-xl font-bold tracking-tight">Sådan fungerer det:</h2>
          <ol className="mt-5 space-y-4">
            <Step
              num={1}
              icon={<LogIn className="size-5" />}
              title="Login"
              text="Login med udleveret brugernavn og adgangskode. Det er alt – du behøver hverken e-mailadresse eller personlige oplysninger."
            />
            <Step
              num={2}
              icon={<Smartphone className="size-5" />}
              title="Se feedet"
              text="Bladr gennem korte videoer, én ad gangen."
            />
            <Step
              num={3}
              icon={<ClipboardList className="size-5" />}
              title="Besvar det daglige spørgeskema"
              text="Efter 20 minutters visning får du seks hurtige spørgsmål om, hvordan du har det lige nu."
            />
          </ol>
        </div>
      </section>

      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <SectionLabel>Feedet</SectionLabel>
          <div className="mt-4 space-y-3">
            <Feature icon={<Smartphone className="size-5" />} title="Stryg for at rulle">
              Lodrette videoer i fuld skærm, der vises én ad gangen, ligesom på de sociale medier, du kender.
            </Feature>
            <Feature icon={<Volume2 className="size-5" />} title="Lyd">
              Videoerne afspilles med lyd. Tryk på skærmen for at slå lyden til, hvis den er slået fra.
            </Feature>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <SectionLabel>Det daglige check-in</SectionLabel>
          <div className="mt-4 space-y-3">
            <Feature icon={<Timer className="size-5" />} title="Efter 20 minutter">
              Når du har set videoer i alt 20 minutter på en dag, vises check-in på skærmen. Dette tæller én gang pr.
              kalenderdag og nulstilles den næste dag.
            </Feature>
            <Feature icon={<ClipboardList className="size-5" />} title="Seks hurtige spørgsmål">
              For hvert spørgsmål svarer du på, hvordan du har det lige nu, fra 1 (Slet ikke) til 5 (I meget høj
              grad): glad, tilfreds, håbefuld, bekymret, ensom og irritabel.
            </Feature>
            <Feature icon={<Lock className="size-5" />} title="Påkrævet for at fortsætte.">
              Du kan ikke vende tilbage til feedet, før alle spørgsmål er besvaret. Der er kun én check-in om dagen.
            </Feature>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mx-auto max-w-sm">
          <SectionLabel>Hvad du accepterer</SectionLabel>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <ul className="space-y-3 text-sm leading-relaxed text-card-foreground">
              <ConsentRow icon={<UserCircle2 className="size-4 shrink-0" />}>
                Du deltager ved hjælp af et brugernavn og en adgangskode.
              </ConsentRow>
              <ConsentRow icon={<Smartphone className="size-4 shrink-0" />}>
                Du vil se et feed med korte videoer i en tilfældig rækkefølge.
              </ConsentRow>
              <ConsentRow icon={<Timer className="size-4 shrink-0" />}>
                Efter at have set videoer i 20 minutter om dagen skal du besvare den daglige humørcheck, før du kan
                vende tilbage til feedet.
              </ConsentRow>
              <ConsentRow icon={<ShieldCheck className="size-4 shrink-0" />}>
                Dine svar gemmes under dit brugernavn sammen med dato og klokkeslæt for, hvornår du har indsendt dem,
                samt hvor lang tid du bruger på appen
              </ConsentRow>
              <ConsentRow icon={<ShieldCheck className="size-4 shrink-0" />}>
                Dine svar bruges udelukkende til denne undersøgelses forskningsformål.
              </ConsentRow>
            </ul>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Ved at deltage bekræfter du, at du forstår ovenstående og accepterer det.
          </p>
          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
            Feed-forskningsprojekt · Forskningsprojekt
          </p>
        </div>
      </section>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{children}</p>
  );
}

function Step({
  num,
  icon,
  title,
  text,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trin {num}</p>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 pl-12 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function ConsentRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

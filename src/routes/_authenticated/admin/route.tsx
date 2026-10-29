import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { ArrowLeft, Clapperboard, Table2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/feed" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const tab =
    "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground";
  const active = "bg-card text-foreground shadow";
  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/feed" aria-label="Back to feed" className="flex size-10 items-center justify-center rounded-full bg-card">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Admin</p>
            <h1 className="text-xl font-bold">Study console</h1>
          </div>
        </div>
        <nav className="flex gap-1 rounded-2xl bg-muted p-1">
          <Link to="/admin" activeOptions={{ exact: true }} className={tab} activeProps={{ className: `${tab} ${active}` }}>
            <Clapperboard className="size-4" /> Videos
          </Link>
          <Link to="/admin/analytics" className={tab} activeProps={{ className: `${tab} ${active}` }}>
            <Table2 className="size-4" /> Survey responses
          </Link>
          <Link to="/admin/users" className={tab} activeProps={{ className: `${tab} ${active}` }}>
            <KeyRound className="size-4" /> Brugere
          </Link>
        </nav>
      </header>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}

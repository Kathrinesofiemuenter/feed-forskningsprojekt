import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type CurrentUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [{ data: profile }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle(),
    supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
  ]);
  return {
    id: data.user.id,
    username: profile?.username ?? (data.user.user_metadata?.["username"] as string) ?? "participant",
    isAdmin: Boolean(isAdmin),
  };
}

export function useCurrentUser() {
  return useQuery({ queryKey: ["current-user"], queryFn: fetchCurrentUser, staleTime: 60_000 });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { listDirectory, userKeys } from "@/api/users";
import type { MemberDirectoryResponse } from "@/api/types";

/** "firstName lastName" (falls back to userName when the name is blank). */
export function userDisplayLabel(u: Pick<MemberDirectoryResponse, "firstName" | "lastName" | "userName">): string {
  const full = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.userName;
}

/**
 * Member-directory id → display-name map for replacing raw user ids in the UI
 * (received-list owner cells, received detail card). Gated on
 * `users:directory-read`; empty when the user lacks it (callers then fall
 * back to the raw id). Shares the `userKeys.directory` cache with the share
 * picker, so this adds no extra request.
 */
export function useUserNameMap(): Map<string, string> {
  const { hasPermission } = useAuth();
  const query = useQuery({
    queryKey: userKeys.directory,
    queryFn: listDirectory,
    enabled: hasPermission("users:directory-read"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const map = new Map<string, string>();
  for (const u of query.data ?? []) map.set(u.id, userDisplayLabel(u));
  return map;
}

/** Resolved display name, or the raw id when unresolvable (no permission / unknown user). */
export function displayUserName(names: Map<string, string>, id: string): string {
  return names.get(id) ?? id;
}

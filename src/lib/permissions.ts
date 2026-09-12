import { jwtDecode } from "jwt-decode";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

/**
 * Reads role/permission claims for CLIENT-SIDE UI gating only.
 * The API enforces authorization server-side (403) — this just hides
 * buttons the user can't use. Checks several common .NET claim names.
 */
export function sessionFromToken(token: string): Omit<SessionUser, "id" | "email" | "firstName" | "lastName"> & Partial<SessionUser> {
  let claims: Record<string, unknown> = {};
  try {
    claims = jwtDecode<Record<string, unknown>>(token);
  } catch {
    return { roles: [], permissions: [] };
  }

  const roles = [
    ...asArray(claims["role"]),
    ...asArray(claims["roles"]),
    ...asArray(claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]),
  ];
  const permissions = [
    ...asArray(claims["permission"]),
    ...asArray(claims["permissions"]),
  ];

  return {
    roles: [...new Set(roles)],
    permissions: [...new Set(permissions)],
    email: firstString(claims, [
      "email",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "unique_name",
      "preferred_username",
    ]),
    id: firstString(claims, [
      "sub",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
      "nameid",
    ]),
  };
}

export function isAdminUser(user: Pick<SessionUser, "roles"> | null): boolean {
  return user?.roles.some((r) => r.toLowerCase() === "admin") ?? false;
}

/** Admins pass every permission check (server owns roles; UI mirrors that). */
export function canUser(
  user: SessionUser | null,
  permission?: string,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (!permission) return true;
  return user.permissions.includes(permission);
}

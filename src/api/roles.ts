import { api } from "./client";
import type {
  RoleDetailResponse,
  RoleListItem,
  RoleRequest,
} from "./types";

export const roleKeys = {
  all: (includeDisabled: boolean) => ["roles", includeDisabled] as const,
  detail: (id: string) => ["roles", id] as const,
};

export async function listRoles(includeDisabled = true): Promise<RoleListItem[]> {
  const res = await api.get<RoleListItem[]>("/api/Roles", {
    params: { includeDisabled },
  });
  return res.data;
}

export async function getRole(id: string): Promise<RoleDetailResponse> {
  const res = await api.get<RoleDetailResponse>(`/api/Roles/${id}`);
  return res.data;
}

export async function createRole(body: RoleRequest): Promise<RoleDetailResponse> {
  const res = await api.post<RoleDetailResponse>("/api/Roles", body);
  return res.data;
}

export async function updateRole(id: string, body: RoleRequest): Promise<void> {
  await api.put(`/api/Roles/${id}`, body);
}

export async function toggleRoleStatus(id: string): Promise<void> {
  await api.put(`/api/Roles/${id}/toggle-status`);
}

import { api } from "./client";
import type {
  CreateUserRequest,
  MemberDirectoryResponse,
  UpdateUserRequest,
  UserResponse,
} from "./types";

export const userKeys = {
  all: ["users"] as const,
  directory: ["users", "directory"] as const,
  detail: (id: string) => ["users", id] as const,
};

export async function listUsers(): Promise<UserResponse[]> {
  const res = await api.get<UserResponse[]>("/api/Users");
  return res.data;
}

/**
 * Privacy-safe member directory for the share-recipient picker.
 * Requires `users:directory-read` (Member + Admin). Active users only.
 * Never use the admin `GET /api/Users` listing for members client-side.
 */
export async function listDirectory(): Promise<MemberDirectoryResponse[]> {
  const res = await api.get<MemberDirectoryResponse[]>("/api/Users/directory");
  return res.data;
}

export async function getUser(id: string): Promise<UserResponse> {
  const res = await api.get<UserResponse>(`/api/Users/${id}`);
  return res.data;
}

export async function createUser(body: CreateUserRequest): Promise<UserResponse> {
  const res = await api.post<UserResponse>("/api/Users", body);
  return res.data;
}

export async function updateUser(id: string, body: UpdateUserRequest): Promise<void> {
  await api.put(`/api/Users/${id}`, body);
}

export async function toggleUserStatus(id: string): Promise<void> {
  await api.put(`/api/Users/${id}/toggle-status`);
}

export async function unlockUser(id: string): Promise<void> {
  await api.put(`/api/Users/${id}/unlock`);
}

/**
 * Requires `users:delete`. The API rejects self-deletion
 * with `403 User.CannotDeleteSelf`.
 */
export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/Users/${id}`);
}

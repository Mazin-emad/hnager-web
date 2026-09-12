import { api } from "./client";
import type {
  AuthRequest,
  AuthResponse,
  RefreshTokenRequest,
} from "./types";

export const authKeys = {
  profile: ["auth", "profile"] as const,
};

export async function login(body: AuthRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/Auth/login", body);
  return res.data;
}

export async function revokeRefreshToken(body: RefreshTokenRequest): Promise<void> {
  await api.post("/Auth/revoke-refresh-token", body);
}

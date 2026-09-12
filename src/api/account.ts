import { api } from "./client";
import type {
  ChangePasswordRequest,
  ProfileResponse,
  UpdateProfileRequest,
} from "./types";

export async function getProfile(): Promise<ProfileResponse> {
  const res = await api.get<ProfileResponse>("/me");
  return res.data;
}

export async function updateProfile(body: UpdateProfileRequest): Promise<void> {
  await api.put("/me/info", body);
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await api.put("/me/change-password", body);
}

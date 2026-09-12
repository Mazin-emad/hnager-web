import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearTokens, getTokens, setTokens } from "@/auth/tokenStore";
import { unwrapAuthResponse } from "./errors";
import type { AuthResponse, RefreshTokenRequest } from "./types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.token) {
    config.headers.Authorization = `Bearer ${tokens.token}`;
  }
  return config;
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<AuthResponse> | null = null;

function doRefresh(): Promise<AuthResponse> {
  if (!refreshPromise) {
    const tokens = getTokens();
    if (!tokens) return Promise.reject(new Error("no tokens"));
    const body: RefreshTokenRequest = {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    };
    refreshPromise = api
      .post("/Auth/refresh", body)
      .then((res) => {
        const auth = unwrapAuthResponse(res.data);
        setTokens({ token: auth.token, refreshToken: auth.refreshToken });
        return auth;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Broadcast so AuthContext can reset state without importing it (no cycles). */
function broadcastLogout(): void {
  clearTokens();
  window.dispatchEvent(new Event("auth:expired"));
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const url = config?.url ?? "";

    // Never retry the auth endpoints themselves.
    const isAuthCall = url.includes("/Auth/");
    if (error.response?.status === 401 && !isAuthCall && config && !config._retry) {
      config._retry = true;
      try {
        const refreshed = await doRefresh();
        config.headers.Authorization = `Bearer ${refreshed.token}`;
        return api(config);
      } catch {
        broadcastLogout();
      }
    }
    return Promise.reject(error);
  },
);

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getProfile } from "@/api/account";
import { login as loginRequest, revokeRefreshToken } from "@/api/auth";
import { parseApiError } from "@/api/errors";
import type { ProfileResponse } from "@/api/types";
import { clearTokens, getTokens, setTokens } from "./tokenStore";
import { canUser, isAdminUser, sessionFromToken, type SessionUser } from "@/lib/permissions";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  profile: ProfileResponse | null;
  isAdmin: boolean;
  hasPermission: (permission?: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function buildSession(): Promise<{ user: SessionUser; profile: ProfileResponse } | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  // The interceptor refreshes the access token once on 401, so a stored
  // session is validated with a single profile call.
  const profile = await getProfile();
  const fromToken = sessionFromToken(tokens.token);
  const user: SessionUser = {
    id: fromToken.id ?? "",
    email: profile.email || fromToken.email || "",
    firstName: profile.firstName,
    lastName: profile.lastName,
    roles: fromToken.roles ?? [],
    permissions: fromToken.permissions ?? [],
  };
  return { user, profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  const resetToGuest = useCallback(() => {
    clearTokens();
    queryClient.clear();
    setUser(null);
    setProfile(null);
    setStatus("guest");
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    buildSession()
      .then((session) => {
        if (cancelled) return;
        if (session) {
          setUser(session.user);
          setProfile(session.profile);
          setStatus("authed");
        } else {
          setStatus("guest");
        }
      })
      .catch(() => {
        if (!cancelled) resetToGuest();
      });
    const onExpired = () => {
      if (!cancelled) resetToGuest();
    };
    window.addEventListener("auth:expired", onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener("auth:expired", onExpired);
    };
  }, [resetToGuest]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const auth = await loginRequest({ email, password });
        setTokens({ token: auth.token, refreshToken: auth.refreshToken });
        const session = await buildSession();
        if (session) {
          setUser(session.user);
          setProfile(session.profile);
          setStatus("authed");
        } else {
          resetToGuest();
          throw new Error("تعذّر تحميل بيانات الحساب");
        }
      } catch (error) {
        resetToGuest();
        throw error;
      }
    },
    [resetToGuest],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    if (tokens) {
      try {
        await revokeRefreshToken(tokens);
      } catch (error) {
        // Revocation is best-effort; a plain-text 400 just means the
        // token was already unusable. Still log out locally.
        void parseApiError(error);
      }
    }
    resetToGuest();
  }, [resetToGuest]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      isAdmin: isAdminUser(user),
      hasPermission: (permission?: string) => canUser(user, permission),
      login,
      logout,
    }),
    [status, user, profile, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

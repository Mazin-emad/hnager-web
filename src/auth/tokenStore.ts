// Token storage: memory (fast path for the interceptor) + localStorage
// (persistence across reloads). A Bearer-token SPA has no httpOnly option.

export interface StoredTokens {
  token: string;
  refreshToken: string;
}

const ACCESS_KEY = "hn.accessToken";
const REFRESH_KEY = "hn.refreshToken";

let memory: StoredTokens | null = null;

function readStorage(): StoredTokens | null {
  try {
    const token = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (token && refreshToken) return { token, refreshToken };
  } catch {
    // storage unavailable (private mode etc.) — memory still works
  }
  return null;
}

export function getTokens(): StoredTokens | null {
  if (memory) return memory;
  memory = readStorage();
  return memory;
}

export function setTokens(tokens: StoredTokens): void {
  memory = tokens;
  try {
    localStorage.setItem(ACCESS_KEY, tokens.token);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // ignore — memory still works for this session
  }
}

export function clearTokens(): void {
  memory = null;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

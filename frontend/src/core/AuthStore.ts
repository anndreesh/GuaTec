import { STORAGE_KEYS } from "@/config/gameConfig";

/**
 * Thin wrapper around localStorage for the two pieces of state that must
 * survive a page reload before the backend is even reachable: the session
 * token and, redundantly, the last known username (used only for optimistic
 * UI while `/user/me` loads).
 */
export const AuthStore = {
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.authToken);
  },
  setToken(token: string): void {
    localStorage.setItem(STORAGE_KEYS.authToken, token);
  },
  clearToken(): void {
    localStorage.removeItem(STORAGE_KEYS.authToken);
  },
  getCachedUsername(): string | null {
    return localStorage.getItem(STORAGE_KEYS.username);
  },
  setCachedUsername(username: string): void {
    localStorage.setItem(STORAGE_KEYS.username, username);
  },
  getPendingOAuthEmail(): string | null {
    return localStorage.getItem("mm.pendingOAuthEmail");
  },
  setPendingOAuthEmail(email: string): void {
    localStorage.setItem("mm.pendingOAuthEmail", email);
  },
  clearPendingOAuthEmail(): void {
    localStorage.removeItem("mm.pendingOAuthEmail");
  },
};

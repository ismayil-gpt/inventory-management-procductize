import { writeLastActivity } from '../../application-shell/idle-timeout.hook';
import { create } from 'zustand';

// Ref: CLAUDE.md §4 (Zustand for auth session), §11 #4.
// NOTE: tokens are kept in localStorage for the development build. Production
// hardening moves the refresh token to an httpOnly cookie (documented upgrade).
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'STORE_KEEPER';
  preferredLanguage: string;
  preferredTheme: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** A fresh sign-in: stores the session and starts the idle clock (DESC #6). */
  startSession: (session: Session) => void;
  /** Rotated tokens from a refresh: stores them without counting as user activity. */
  setSession: (session: Session) => void;
  clearSession: () => void;
  /** Adopt whatever another tab last stored (rotated tokens or a sign-out). */
  reloadFromStorage: () => void;
}

const STORAGE_KEY = 'mizan.auth';

function loadInitial(): Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt storage */
  }
  return { accessToken: null, refreshToken: null, user: null };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadInitial(),
  startSession: (session) => {
    // Signing in is activity: the idle clock (DESC #6) starts now, not at the last session's end.
    // A token refresh is not — background requests must never keep an idle user signed in.
    writeLastActivity(Date.now());
    get().setSession(session);
  },
  setSession: (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ accessToken: session.accessToken, refreshToken: session.refreshToken, user: session.user });
  },
  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
  reloadFromStorage: () => set(loadInitial()),
}));

// Tabs share one server-side session. When another tab rotates the tokens or
// signs out, follow it — a tab holding a stale refresh token would otherwise
// present it again, which the server treats as theft and ends the session.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) useAuthStore.getState().reloadFromStorage();
  });
}

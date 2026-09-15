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
  setSession: (session: Session) => void;
  clearSession: () => void;
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

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  setSession: (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ accessToken: session.accessToken, refreshToken: session.refreshToken, user: session.user });
  },
  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));

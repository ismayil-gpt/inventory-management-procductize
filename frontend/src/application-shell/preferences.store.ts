import { create } from 'zustand';
import i18n from '../internationalisation/i18n';

// Ref: CLAUDE.md §4 (Zustand: theme, language, offline queue only), §10.
export type ThemeChoice = 'light' | 'dark' | 'system';
export type LanguageChoice = 'en' | 'ar';

interface PreferencesState {
  theme: ThemeChoice;
  language: LanguageChoice;
  setTheme: (theme: ThemeChoice) => void;
  toggleTheme: () => void;
  setLanguage: (language: LanguageChoice) => void;
  toggleLanguage: () => void;
}

function applyTheme(theme: ThemeChoice): void {
  const root = document.documentElement;
  if (theme === 'system') {
    // Let the prefers-color-scheme fallback in the tokens decide.
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  localStorage.setItem('mizan.theme', theme);
}

function applyLanguage(language: LanguageChoice): void {
  const root = document.documentElement;
  root.setAttribute('lang', language);
  root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  localStorage.setItem('mizan.language', language);
  void i18n.changeLanguage(language);
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  theme: (localStorage.getItem('mizan.theme') as ThemeChoice) ?? 'system',
  language: (localStorage.getItem('mizan.language') as LanguageChoice) ?? 'en',
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: ThemeChoice = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
  setLanguage: (language) => {
    applyLanguage(language);
    set({ language });
  },
  toggleLanguage: () => {
    const next: LanguageChoice = get().language === 'ar' ? 'en' : 'ar';
    applyLanguage(next);
    set({ language: next });
  },
}));

/** Apply persisted preferences to <html> before first paint. */
export function initPreferences(): void {
  const theme = (localStorage.getItem('mizan.theme') as ThemeChoice) ?? 'system';
  const language = (localStorage.getItem('mizan.language') as LanguageChoice) ?? 'en';
  applyTheme(theme);
  applyLanguage(language);
}

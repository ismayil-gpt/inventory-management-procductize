import { create } from 'zustand';

// UI-only toggle state (§4 — Zustand for theme/language/offline-queue-style UI
// state; no server data lives here, that's TanStack Query's job).
interface AssistantUiState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useAssistantUi = create<AssistantUiState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}));

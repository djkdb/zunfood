import { create } from 'zustand';
import { uid } from '@/lib/id';

export interface Toast {
  id: string;
  message: string;
  icon?: string;
  tone: 'neutral' | 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, options?: { icon?: string; tone?: Toast['tone'] }) => void;
  dismiss: (id: string) => void;
}

const DURATION_MS = 2_600;

/** 짧은 알림 — "민수가 들어왔어요" 같은 순간을 전한다. */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push(message, options) {
    const toast: Toast = {
      id: uid('t'),
      message,
      icon: options?.icon,
      tone: options?.tone ?? 'neutral',
    };
    set({ toasts: [...get().toasts, toast].slice(-3) });
    window.setTimeout(() => get().dismiss(toast.id), DURATION_MS);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (message: string, options?: { icon?: string; tone?: Toast['tone'] }) =>
  useToastStore.getState().push(message, options);

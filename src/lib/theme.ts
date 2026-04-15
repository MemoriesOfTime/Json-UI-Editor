import { create } from 'zustand';

export type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('jsonui-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // localStorage may be unavailable
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('jsonui-theme', next);
    } catch {
      // ignore
    }
    applyTheme(next);
    set({ theme: next });
  },
}));

applyTheme(useThemeStore.getState().theme);

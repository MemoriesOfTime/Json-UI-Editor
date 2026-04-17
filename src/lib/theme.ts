import { create } from 'zustand';

export type Theme = 'dark' | 'light';
export type Style = 'minecraft' | 'oreui';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('jsonui-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // localStorage may be unavailable
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getInitialStyle(): Style {
  try {
    const saved = localStorage.getItem('jsonui-style');
    if (saved === 'minecraft' || saved === 'oreui') return saved;
  } catch {
    // localStorage may be unavailable
  }
  return 'minecraft';
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
}

function applyStyle(style: Style) {
  if (style === 'oreui') {
    document.documentElement.classList.add('style-oreui');
    document.documentElement.classList.remove('style-minecraft');
  } else {
    document.documentElement.classList.remove('style-oreui');
    document.documentElement.classList.add('style-minecraft');
  }
}

interface ThemeState {
  theme: Theme;
  style: Style;
  toggleTheme: () => void;
  setStyle: (style: Style) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  style: getInitialStyle(),
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
  setStyle: (style: Style) => {
    try {
      localStorage.setItem('jsonui-style', style);
    } catch {
      // ignore
    }
    applyStyle(style);
    set({ style });
  },
}));

applyTheme(useThemeStore.getState().theme);
applyStyle(useThemeStore.getState().style);

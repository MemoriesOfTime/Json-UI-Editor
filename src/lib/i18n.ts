import { useCallback } from 'react';
import { create } from 'zustand';
import { en } from './locales/en';
import { zh } from './locales/zh';

export type Locale = 'zh' | 'en';

const dictionaries: Record<Locale, Record<string, string>> = { zh, en };

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem('jsonui-locale');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // localStorage may be unavailable
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem('jsonui-locale', locale);
    } catch {
      // ignore
    }
    set({ locale });
  },
}));

function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let text = dictionaries[locale][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/** 非React上下文使用（如 alert、throw Error） */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  return translate(useI18nStore.getState().locale, key, params);
}

/** React组件内使用，locale变化自动触发重渲染 */
export function useT() {
  const locale = useI18nStore((s) => s.locale);
  return useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );
}

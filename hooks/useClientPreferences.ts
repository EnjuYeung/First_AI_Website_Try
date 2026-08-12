import { useEffect, useState } from 'react';
import { AppSettings } from '../types';

const LANGUAGE_KEY = 'subm.language';
const THEME_KEY = 'subm.theme';
const COLOR_THEME_KEY = 'subm.colorTheme';

const readLanguage = (): AppSettings['language'] => {
  if (typeof window === 'undefined') return 'zh';
  try {
    const value = window.localStorage.getItem(LANGUAGE_KEY);
    return value === 'en' || value === 'zh' ? value : 'zh';
  } catch {
    return 'zh';
  }
};

const readTheme = (): AppSettings['theme'] => {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
};

const readColorTheme = (): AppSettings['colorTheme'] => {
  if (typeof window === 'undefined') return 'default';
  try {
    const value = window.localStorage.getItem(COLOR_THEME_KEY);
    return value === 'blue' || value === 'violet' || value === 'rose' ? value : 'default';
  } catch {
    return 'default';
  }
};

export const useClientPreferences = () => {
  const [language, setLanguage] = useState<AppSettings['language']>(readLanguage);
  const [theme, setTheme] = useState<AppSettings['theme']>(readTheme);
  const [colorTheme, setColorTheme] = useState<AppSettings['colorTheme']>(readColorTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Keep the preference in memory if storage is unavailable.
    }
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Keep the preference in memory if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLOR_THEME_KEY, colorTheme);
    } catch {
      // Keep the preference in memory if storage is unavailable.
    }
  }, [colorTheme]);

  return { language, setLanguage, theme, setTheme, colorTheme, setColorTheme };
};

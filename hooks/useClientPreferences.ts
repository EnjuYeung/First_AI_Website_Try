import { useEffect, useState } from 'react';
import { AppSettings } from '../types';

const LANGUAGE_KEY = 'subm.language';
const THEME_KEY = 'subm.theme';

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

export const useClientPreferences = () => {
  const [language, setLanguage] = useState<AppSettings['language']>(readLanguage);
  const [theme, setTheme] = useState<AppSettings['theme']>(readTheme);

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

  return { language, setLanguage, theme, setTheme };
};

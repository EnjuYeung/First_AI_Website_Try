import { useEffect } from 'react';
import { AppSettings } from '../types';

export const useTheme = (theme: AppSettings['theme'], colorTheme: AppSettings['colorTheme']) => {
  useEffect(() => {
    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    apply();
    document.documentElement.dataset.colorTheme = colorTheme;

    // Listen for system changes if theme is system
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme, colorTheme]);
};

'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export function ThemeSync() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('imperium-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.state?.theme) {
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          setTheme(systemDark ? 'dark' : 'light');
        }
      } else {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(systemDark ? 'dark' : 'light');
      }
    } catch (e) {}
  }, [setTheme]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return null;
}

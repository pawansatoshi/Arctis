'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// ============================================================
// ARCTIS Theme Provider
// ============================================================
// Light is the default, premium visual language. Dark mode remains
// fully supported — toggle via useTheme().toggleTheme() or setTheme().
// No new dependency added; this is a small, self-contained provider.
// The inline script in layout.tsx applies the stored preference
// before hydration to avoid a flash of the wrong theme.
// ============================================================

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'arctis-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Theme | null;
    setThemeState(stored === 'dark' ? 'dark' : 'light');
  }, []);

  const applyTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* private browsing, etc. */ }
  };

  const toggleTheme = () => applyTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

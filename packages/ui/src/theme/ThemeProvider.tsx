'use client';

// Theme Provider with Dark Mode Support

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { vapourTheme } from './index';
import { vapourDarkTheme } from './darkTheme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Hook to use theme context
 */
export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within VapourThemeProvider');
  }
  return context;
}

interface VapourThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
}

/**
 * Theme Provider with dark mode support
 * Persists theme preference to localStorage
 *
 * IMPORTANT: We read localStorage during initial render (useState callback)
 * so that CssBaseline injects the correct theme styles on first render.
 * Do NOT defer localStorage read to useEffect - that breaks dark mode.
 */
export function VapourThemeProvider({ children, defaultMode = 'light' }: VapourThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Read localStorage DURING initial render
    // This ensures CssBaseline injects the correct theme on first render
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vapour-theme-mode');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return defaultMode;
  });

  // Persist to localStorage when mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vapour-theme-mode', mode);
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const theme = useMemo(() => {
    return mode === 'dark' ? vapourDarkTheme : vapourTheme;
  }, [mode]);

  const contextValue = useMemo(
    () => ({
      mode,
      toggleTheme,
      setTheme,
    }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme} key={mode}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

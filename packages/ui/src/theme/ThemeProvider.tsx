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
 */
export function VapourThemeProvider({ children, defaultMode = 'light' }: VapourThemeProviderProps) {
  // Track if we've mounted (to avoid hydration mismatch)
  const [mounted, setMounted] = useState(false);
  // Always start with defaultMode to avoid hydration mismatch
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  // Load saved theme preference after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('vapour-theme-mode');
    if (saved === 'light' || saved === 'dark') {
      setMode(saved);
    }
    setMounted(true);
  }, []);

  // Persist to localStorage when mode changes (but only after initial mount)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('vapour-theme-mode', mode);
    }
  }, [mode, mounted]);

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
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

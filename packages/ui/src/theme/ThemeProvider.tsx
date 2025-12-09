'use client';

// Theme Provider with Dark Mode Support

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { vapourTheme } from './lightTheme';
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
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  // DEBUG: Log theme imports
  console.log('[ThemeProvider] vapourTheme:', vapourTheme ? 'loaded' : 'UNDEFINED');
  console.log('[ThemeProvider] vapourDarkTheme:', vapourDarkTheme ? 'loaded' : 'UNDEFINED');
  console.log('[ThemeProvider] Current mode:', mode);

  // Initialize from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vapour-theme-mode') as ThemeMode;
      console.log('[ThemeProvider] localStorage saved mode:', saved);
      if (saved === 'light' || saved === 'dark') {
        setMode(saved);
      }
    }
  }, []);

  // Persist to localStorage when mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vapour-theme-mode', mode);
      console.log('[ThemeProvider] Mode changed to:', mode);
    }
  }, [mode]);

  const toggleTheme = () => {
    console.log('[ThemeProvider] toggleTheme called, switching from', mode);
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const theme = useMemo(() => {
    const selectedTheme = mode === 'dark' ? vapourDarkTheme : vapourTheme;
    console.log('[ThemeProvider] Selected theme palette mode:', selectedTheme?.palette?.mode);
    return selectedTheme;
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

// Theme Toggle Button Component

import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeMode } from '../theme/ThemeProvider';

interface ThemeToggleProps {
  /**
   * Size of the icon button
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Show tooltip
   */
  showTooltip?: boolean;
}

/**
 * Theme toggle button
 * Switches between light and dark mode
 */
export function ThemeToggle({ size = 'medium', showTooltip = true }: ThemeToggleProps) {
  const { mode, toggleTheme } = useThemeMode();

  const button = (
    <IconButton
      onClick={toggleTheme}
      color="inherit"
      size={size}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
    >
      {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );

  if (showTooltip) {
    return (
      <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
        {button}
      </Tooltip>
    );
  }

  return button;
}

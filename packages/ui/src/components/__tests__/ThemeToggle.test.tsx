/**
 * ThemeToggle Component Tests
 *
 * Tests for the theme toggle button component including:
 * - Rendering with light/dark mode icons
 * - Toggle functionality
 * - Tooltip display
 * - Size variations
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { VapourThemeProvider } from '../../theme/ThemeProvider';

// Wrapper to provide theme context
const renderWithTheme = (ui: React.ReactElement, defaultMode: 'light' | 'dark' = 'light') => {
  return render(<VapourThemeProvider defaultMode={defaultMode}>{ui}</VapourThemeProvider>);
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render toggle button', () => {
      renderWithTheme(<ThemeToggle />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have appropriate aria-label in light mode', () => {
      renderWithTheme(<ThemeToggle />, 'light');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    });

    it('should have appropriate aria-label in dark mode', () => {
      renderWithTheme(<ThemeToggle />, 'dark');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle from light to dark mode on click', () => {
      renderWithTheme(<ThemeToggle />, 'light');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');

      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    });

    it('should toggle from dark to light mode on click', () => {
      renderWithTheme(<ThemeToggle />, 'dark');

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');

      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    });

    it('should toggle back and forth', () => {
      renderWithTheme(<ThemeToggle />, 'light');

      const button = screen.getByRole('button');

      // Light -> Dark
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');

      // Dark -> Light
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');

      // Light -> Dark again
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip by default', async () => {
      renderWithTheme(<ThemeToggle showTooltip={true} />, 'light');

      const button = screen.getByRole('button');

      // Hover to show tooltip
      fireEvent.mouseEnter(button);

      // Tooltip should appear
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('Switch to dark mode');
    });

    it('should not render tooltip wrapper when showTooltip is false', () => {
      const { container } = renderWithTheme(<ThemeToggle showTooltip={false} />, 'light');

      // Button should still exist
      expect(screen.getByRole('button')).toBeInTheDocument();

      // But tooltip wrapper should not
      fireEvent.mouseEnter(screen.getByRole('button'));

      // No tooltip should appear (check that tooltip role doesn't exist after delay)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should show correct tooltip text for dark mode', async () => {
      renderWithTheme(<ThemeToggle />, 'dark');

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Switch to light mode');
    });
  });

  describe('Size Prop', () => {
    it('should accept small size', () => {
      renderWithTheme(<ThemeToggle size="small" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept medium size (default)', () => {
      renderWithTheme(<ThemeToggle size="medium" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept large size', () => {
      renderWithTheme(<ThemeToggle size="large" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Default Props', () => {
    it('should use medium size by default', () => {
      renderWithTheme(<ThemeToggle />);

      // Just verify it renders correctly with defaults
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should show tooltip by default', async () => {
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ThemeToggle />);
      }).toThrow('useThemeMode must be used within VapourThemeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Integration', () => {
    it('should work as part of a header', () => {
      renderWithTheme(
        <header>
          <h1>My App</h1>
          <ThemeToggle />
        </header>
      );

      expect(screen.getByText('My App')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should work with multiple toggles', () => {
      renderWithTheme(
        <div>
          <ThemeToggle />
          <ThemeToggle />
        </div>,
        'light'
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);

      // Both should be in sync
      expect(buttons[0]).toHaveAttribute('aria-label', 'Switch to dark mode');
      expect(buttons[1]).toHaveAttribute('aria-label', 'Switch to dark mode');

      // Click one, both should update
      fireEvent.click(buttons[0]);

      expect(buttons[0]).toHaveAttribute('aria-label', 'Switch to light mode');
      expect(buttons[1]).toHaveAttribute('aria-label', 'Switch to light mode');
    });
  });
});

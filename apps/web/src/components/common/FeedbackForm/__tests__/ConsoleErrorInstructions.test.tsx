/**
 * Tests for ConsoleErrorInstructions component
 *
 * Tests the expandable instructions showing how to capture console errors.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConsoleErrorInstructions } from '../ConsoleErrorInstructions';

// Mock MUI icons
jest.mock('@mui/icons-material/Info', () => {
  const MockIcon = () => <span data-testid="info-icon" />;
  MockIcon.displayName = 'MockInfoIcon';
  return MockIcon;
});

jest.mock('@mui/icons-material/ExpandMore', () => {
  const MockIcon = () => <span data-testid="expand-more-icon" />;
  MockIcon.displayName = 'MockExpandMoreIcon';
  return MockIcon;
});

jest.mock('@mui/icons-material/ExpandLess', () => {
  const MockIcon = () => <span data-testid="expand-less-icon" />;
  MockIcon.displayName = 'MockExpandLessIcon';
  return MockIcon;
});

describe('ConsoleErrorInstructions', () => {
  describe('Rendering', () => {
    it('should render collapsed by default', () => {
      render(<ConsoleErrorInstructions />);

      expect(screen.getByText('How to get console error messages')).toBeInTheDocument();
      expect(screen.getByTestId('expand-more-icon')).toBeInTheDocument();
    });

    it('should show info icon', () => {
      render(<ConsoleErrorInstructions />);

      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    });

    it('should not show instructions when collapsed', () => {
      render(<ConsoleErrorInstructions />);

      expect(screen.queryByText('Open Developer Tools')).not.toBeVisible();
    });
  });

  describe('Expansion', () => {
    it('should expand when clicked', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByText('Open Developer Tools')).toBeVisible();
      expect(screen.getByText(/Click the "Console" tab/)).toBeVisible();
      expect(screen.getByText('Right-click on the error message')).toBeVisible();
    });

    it('should show expand less icon when expanded', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByTestId('expand-less-icon')).toBeInTheDocument();
    });

    it('should collapse when clicked again', async () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');

      // Expand
      fireEvent.click(header);
      expect(screen.getByText('Open Developer Tools')).toBeVisible();

      // Collapse
      fireEvent.click(header);

      // Wait for collapse animation and check icon changed back
      await waitFor(() => {
        expect(screen.getByTestId('expand-more-icon')).toBeInTheDocument();
      });
    });
  });

  describe('Instruction Content', () => {
    it('should display step numbers', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display Windows/Linux keyboard shortcut', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByText(/Windows\/Linux/)).toBeInTheDocument();
      expect(screen.getByText(/F12/)).toBeInTheDocument();
      expect(screen.getByText(/Ctrl\+Shift\+I/)).toBeInTheDocument();
    });

    it('should display Mac keyboard shortcut', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByText(/Mac/)).toBeInTheDocument();
      expect(screen.getByText(/⌘\+Option\+I/)).toBeInTheDocument();
    });

    it('should display Console tab instruction', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByText(/Click the "Console" tab/)).toBeInTheDocument();
      expect(screen.getByText(/Look for red error messages/)).toBeInTheDocument();
    });

    it('should display copy instruction', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByText('Right-click on the error message')).toBeInTheDocument();
      expect(screen.getByText(/Select "Copy"/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<ConsoleErrorInstructions />);

      expect(screen.getByLabelText('Expand instructions')).toBeInTheDocument();
    });

    it('should update button label when expanded', () => {
      render(<ConsoleErrorInstructions />);

      const header = screen.getByText('How to get console error messages');
      fireEvent.click(header);

      expect(screen.getByLabelText('Collapse instructions')).toBeInTheDocument();
    });

    it('should expand when clicking anywhere on the header row', () => {
      render(<ConsoleErrorInstructions />);

      // Clicking on the text should expand (proving the div is clickable)
      const headerText = screen.getByText('How to get console error messages');
      fireEvent.click(headerText);

      expect(screen.getByText('Open Developer Tools')).toBeVisible();
    });
  });
});

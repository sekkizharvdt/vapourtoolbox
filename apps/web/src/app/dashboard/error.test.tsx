/**
 * Tests for Dashboard Error Boundary
 */

import React from 'react';
import { render, screen } from '@/test-utils';
import DashboardError from './error';

// Mock logger to avoid console output during tests
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('DashboardError', () => {
  const mockError = new Error('Test error message');
  const mockReset = jest.fn();
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock useRouter
    const nextNav = require('next/navigation') as {
      useRouter: ReturnType<typeof jest.fn>;
    };
    nextNav.useRouter = jest.fn(() => ({
      push: mockPush,
      back: jest.fn(),
    }));
  });

  it('renders error boundary with error message in development', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
      configurable: true,
    });

    render(<DashboardError error={mockError} reset={mockReset} />);

    // Check for main heading
    expect(screen.getByText('Dashboard Error')).toBeInTheDocument();

    // Check for error message
    expect(screen.getByText(/An error occurred while loading the dashboard/i)).toBeInTheDocument();

    // Check for error details in development (use regex to handle pre-formatted text)
    expect(screen.getByText(/Test error message/i)).toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
  });

  it('does not show error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
      configurable: true,
    });

    render(<DashboardError error={mockError} reset={mockReset} />);

    // Check for main heading
    expect(screen.getByText('Dashboard Error')).toBeInTheDocument();

    // Error details should not be visible
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
  });

  it('displays error digest when provided', () => {
    const errorWithDigest = Object.assign(mockError, { digest: 'abc123' });

    render(<DashboardError error={errorWithDigest} reset={mockReset} />);

    expect(screen.getByText(/Error ID: abc123/i)).toBeInTheDocument();
  });

  it('calls reset when Refresh Dashboard button is clicked', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<DashboardError error={mockError} reset={mockReset} />);

    const refreshButton = screen.getByRole('button', { name: /refresh dashboard/i });
    await user.click(refreshButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('navigates to home when Go Home button is clicked', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<DashboardError error={mockError} reset={mockReset} />);

    const homeButton = screen.getByRole('button', { name: /go home/i });
    await user.click(homeButton);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders with warning severity alert', () => {
    const { container } = render(<DashboardError error={mockError} reset={mockReset} />);

    // MUI Alert with severity="warning" should have a specific class or role
    const alert = container.querySelector('.MuiAlert-standardWarning');
    expect(alert).toBeInTheDocument();
  });

  it('displays error icon', () => {
    render(<DashboardError error={mockError} reset={mockReset} />);

    // The ErrorOutline icon should be rendered
    const icons = document.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });
});

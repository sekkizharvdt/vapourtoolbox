/**
 * Auth Test Wrapper
 *
 * Provides AuthContext for component testing
 */

import React, { ReactElement, createContext } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { User as FirebaseUser } from 'firebase/auth';
import type { CustomClaims } from '@vapour/types';
import { UserRoles } from './factories';
import { RolePermissions } from '@vapour/types';

// Create local AuthContext type matching the real one
interface AuthContextType {
  user: FirebaseUser | null;
  claims: CustomClaims | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a default MUI theme for testing
const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

/**
 * Auth wrapper options
 */
export interface AuthWrapperOptions {
  user?: FirebaseUser | null;
  claims?: CustomClaims | null;
  loading?: boolean;
  signInWithGoogle?: () => Promise<void>;
  signOut?: () => Promise<void>;
}

/**
 * Create a mock AuthContext value
 */
export function createMockAuthContext(options: AuthWrapperOptions = {}) {
  return {
    user: options.user ?? null,
    claims: options.claims ?? null,
    loading: options.loading ?? false,
    signInWithGoogle: options.signInWithGoogle ?? jest.fn().mockResolvedValue(undefined),
    signOut: options.signOut ?? jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Auth wrapper component
 */
function AuthWrapper({
  children,
  authContext,
}: {
  children: React.ReactNode;
  authContext: ReturnType<typeof createMockAuthContext>;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
    </ThemeProvider>
  );
}

/**
 * Render with authenticated user
 *
 * @param ui - Component to render
 * @param options - Auth and render options
 *
 * @example
 * ```tsx
 * renderWithAuth(<MyComponent />, {
 *   role: 'SUPER_ADMIN'
 * });
 * ```
 */
export function renderWithAuth(
  ui: ReactElement,
  options: {
    role?: keyof typeof RolePermissions;
    user?: FirebaseUser;
    claims?: CustomClaims;
    loading?: boolean;
    renderOptions?: Omit<RenderOptions, 'wrapper'>;
  } = {}
): ReturnType<typeof render> {
  const { role, user: customUser, claims: customClaims, loading = false, renderOptions } = options;

  // Create user based on role or use custom user
  let user: FirebaseUser | null = null;
  let claims: CustomClaims | null = null;

  if (role) {
    const userFactory = UserRoles[role.toLowerCase() as keyof typeof UserRoles];
    if (userFactory) {
      user = userFactory();
      // Extract claims from user's getIdTokenResult mock
      const mockGetIdTokenResult = user.getIdTokenResult as jest.Mock;
      const tokenResult = mockGetIdTokenResult.mock.results[0]?.value;
      if (tokenResult && typeof tokenResult === 'object' && 'then' in tokenResult) {
        // It's a promise, resolve it
        tokenResult.then((result: { claims: CustomClaims }) => {
          claims = result.claims;
        });
      } else if (tokenResult && 'claims' in tokenResult) {
        claims = tokenResult.claims as CustomClaims;
      }
    }
  }

  if (customUser) {
    user = customUser;
  }

  if (customClaims) {
    claims = customClaims;
  }

  const authContext = createMockAuthContext({
    user,
    claims,
    loading,
  });

  return render(ui, {
    wrapper: ({ children }) => <AuthWrapper authContext={authContext}>{children}</AuthWrapper>,
    ...renderOptions,
  });
}

/**
 * Render with unauthenticated state
 */
export function renderWithoutAuth(
  ui: ReactElement,
  renderOptions?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  const authContext = createMockAuthContext({
    user: null,
    claims: null,
    loading: false,
  });

  return render(ui, {
    wrapper: ({ children }) => <AuthWrapper authContext={authContext}>{children}</AuthWrapper>,
    ...renderOptions,
  });
}

/**
 * Render with loading state
 */
export function renderWithAuthLoading(
  ui: ReactElement,
  renderOptions?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  const authContext = createMockAuthContext({
    user: null,
    claims: null,
    loading: true,
  });

  return render(ui, {
    wrapper: ({ children }) => <AuthWrapper authContext={authContext}>{children}</AuthWrapper>,
    ...renderOptions,
  });
}

/**
 * Render with pending approval state (user authenticated but no claims)
 */
export function renderWithPendingUser(
  ui: ReactElement,
  renderOptions?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  const user = UserRoles.pendingUser();

  const authContext = createMockAuthContext({
    user,
    claims: null,
    loading: false,
  });

  return render(ui, {
    wrapper: ({ children }) => <AuthWrapper authContext={authContext}>{children}</AuthWrapper>,
    ...renderOptions,
  });
}

/**
 * Quick role-based render helpers
 */
export const renderAs: Record<
  string,
  (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => ReturnType<typeof render>
> = {
  superAdmin: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'SUPER_ADMIN', renderOptions: options }),

  director: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'DIRECTOR', renderOptions: options }),

  projectManager: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'PROJECT_MANAGER', renderOptions: options }),

  procurementManager: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'PROCUREMENT_MANAGER', renderOptions: options }),

  accountant: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'ACCOUNTANT', renderOptions: options }),

  financeManager: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'FINANCE_MANAGER', renderOptions: options }),

  engineeringHead: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'ENGINEERING_HEAD', renderOptions: options }),

  engineer: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'ENGINEER', renderOptions: options }),

  siteEngineer: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'SITE_ENGINEER', renderOptions: options }),

  teamMember: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'TEAM_MEMBER', renderOptions: options }),

  clientPM: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuth(ui, { role: 'CLIENT_PM', renderOptions: options }),

  unauthenticated: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithoutAuth(ui, options),

  pending: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithPendingUser(ui, options),

  loading: (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
    renderWithAuthLoading(ui, options),
};

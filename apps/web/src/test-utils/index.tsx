import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Create a default MUI theme for testing
const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

/**
 * Custom render function that wraps components with common providers
 *
 * Usage:
 * ```tsx
 * import { render, screen } from '@/test-utils';
 *
 * test('renders component', () => {
 *   render(<MyComponent />);
 *   expect(screen.getByText('Hello')).toBeInTheDocument();
 * });
 * ```
 */
function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

/**
 * Custom render that includes all providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Override render with our custom version
export { customRender as render };

// Export Auth test utilities
export * from './auth-wrapper';

// Export test data factories
export {
  createMockFirebaseUser,
  createMockCustomClaims,
  createMockAuthenticatedUser,
  UserRoles,
  createMockUser as createMockUserDocument, // Rename to avoid conflict
  createMockVendor,
  createMockCustomer,
  createMockProject,
  createMockBankTransaction,
  createMockAccountingTransaction,
  createMockPurchaseRequest,
  createMockRFQ,
  createMockPurchaseOrder,
} from './factories';

// Export Firebase mocks (with renamed exports to avoid conflicts)
export {
  createMockUser, // From firebase-mocks.ts
  createMockDocumentSnapshot,
  createMockQuerySnapshot,
  mockFirebaseAuth,
  mockFirestore,
  resetFirebaseMocks,
  createMockBatch,
  createMockOnSnapshot,
  FirebaseError,
  FirebaseErrorCodes,
  createFirebaseError,
  waitFor as waitForAsync, // Rename to avoid conflict with RTL's waitFor
  flushPromises,
} from './firebase-mocks';

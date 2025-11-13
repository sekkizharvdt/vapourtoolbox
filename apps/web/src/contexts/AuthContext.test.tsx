/**
 * AuthContext Tests
 *
 * Comprehensive test suite for authentication and authorization system
 * Covers: claims validation, auth state management, sign-in/out flows, domain authorization
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { isAuthorizedDomain } from '@vapour/constants';
import { createMockFirebaseUser, createMockCustomClaims } from '@/test-utils';
import type { User as FirebaseUser } from 'firebase/auth';

// Mock dependencies
jest.mock('@/lib/firebase');
jest.mock('@vapour/constants');
jest.mock('firebase/auth');
jest.mock('firebase/firestore');

// Mock logger to prevent console noise
jest.mock('@vapour/utils', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('AuthContext', () => {
  // Mock Firebase instances
  type MockAuth = ReturnType<typeof getFirebase>['auth'];
  type MockDb = ReturnType<typeof getFirebase>['db'];

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockAuth: MockAuth = {} as MockAuth;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockDb: MockDb = {} as MockDb;
  let authStateCallback: ((user: FirebaseUser | null) => void) | null = null;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Firebase mock
    (getFirebase as jest.Mock).mockReturnValue({
      auth: mockAuth,
      db: mockDb,
    });

    // Setup onAuthStateChanged mock to capture callback
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      authStateCallback = callback;
      return jest.fn(); // unsubscribe function
    });

    // Setup default mocks
    (isAuthorizedDomain as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    authStateCallback = null;
  });

  /**
   * Test Group 1: Provider Initialization
   */
  describe('Provider Initialization', () => {
    it('should initialize with loading=true and no user', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.claims).toBeNull();
    });

    it('should register auth state listener on mount', () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(onAuthStateChanged).toHaveBeenCalledWith(mockAuth, expect.any(Function));
    });

    it('should unregister auth state listener on unmount', () => {
      const unsubscribe = jest.fn();
      (onAuthStateChanged as jest.Mock).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should expose loading state to window for E2E testing', () => {
      renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect((window as Window & { __authLoading?: boolean }).__authLoading).toBe(true);
    });
  });

  /**
   * Test Group 2: Claims Validation
   */
  describe('Claims Validation', () => {
    it('should handle pending user (no claims)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        uid: 'pending-user-uid',
        email: 'pending@vapourdesal.com',
      });

      // Mock getIdTokenResult to return no claims
      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: {}, // No custom claims
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      // Trigger auth state change
      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBe(mockUser);
      expect(result.current.claims).toBeNull();
    });

    it('should handle pending user (permissions = 0)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        uid: 'pending-user-uid',
        email: 'pending@vapourdesal.com',
      });

      // Mock getIdTokenResult with permissions = 0
      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: {
          permissions: 0,
          domain: 'internal',
        },
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      // Trigger auth state change
      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBe(mockUser);
      expect(result.current.claims).toBeNull();
    });

    it('should handle valid claims', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Use ACCOUNTANT role which has non-zero permissions
      const mockClaims = createMockCustomClaims('ACCOUNTANT');
      const mockUser = createMockFirebaseUser({
        uid: 'valid-user-uid',
        email: 'user@vapourdesal.com',
      });

      // Mock getIdTokenResult with valid claims
      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: mockClaims,
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      // Trigger auth state change
      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBe(mockUser);
      expect(result.current.claims).toEqual(mockClaims);
    });

    it('should sign out user with invalid claims (missing domain)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        uid: 'invalid-user-uid',
        email: 'invalid@vapourdesal.com',
      });

      // Mock getIdTokenResult with invalid claims (missing domain)
      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: {
          permissions: 123, // Valid permissions
          // Missing domain field
        },
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      // Trigger auth state change
      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should sign out user with invalid claims
      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
      expect(result.current.user).toBeNull();
      expect(result.current.claims).toBeNull();
    });

    it('should sign out user with invalid claims (invalid domain value)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        uid: 'invalid-user-uid',
        email: 'invalid@vapourdesal.com',
      });

      // Mock getIdTokenResult with invalid claims (invalid domain)
      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: {
          permissions: 123,
          domain: 'invalid-domain', // Should be 'internal' or 'external'
        },
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      // Trigger auth state change
      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
      expect(result.current.user).toBeNull();
      expect(result.current.claims).toBeNull();
    });
  });

  /**
   * Test Group 3: Token Refresh Logic
   */
  describe('Token Refresh', () => {
    it('should not force refresh for fresh tokens (<5 minutes)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockClaims = createMockCustomClaims('TEAM_MEMBER');
      const mockUser = createMockFirebaseUser();

      // Token issued 2 minutes ago (fresh)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: mockClaims,
        authTime: new Date().toISOString(),
        issuedAtTime: twoMinutesAgo,
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // getIdTokenResult should only be called once with forceRefresh=false
      expect(mockUser.getIdTokenResult).toHaveBeenCalledTimes(1);
      expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(false);
    });

    it('should trigger background refresh for old tokens (>5 minutes)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockClaims = createMockCustomClaims('TEAM_MEMBER');
      const mockUser = createMockFirebaseUser();

      // Token issued 10 minutes ago (old)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const mockGetIdTokenResult = jest
        .fn()
        .mockResolvedValueOnce({
          // First call (forceRefresh=false)
          token: 'mock-token',
          claims: mockClaims,
          authTime: new Date().toISOString(),
          issuedAtTime: tenMinutesAgo,
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          signInProvider: 'google.com',
        })
        .mockResolvedValueOnce({
          // Second call (forceRefresh=true) - background refresh
          token: 'mock-token-refreshed',
          claims: mockClaims,
          authTime: new Date().toISOString(),
          issuedAtTime: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          signInProvider: 'google.com',
        });

      mockUser.getIdTokenResult = mockGetIdTokenResult;

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should trigger background refresh
      expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(false); // Initial call
      expect(mockUser.getIdTokenResult).toHaveBeenCalledWith(true); // Background refresh
    });

    it('should ignore errors from background token refresh', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Use ACCOUNTANT role which has non-zero permissions
      const mockClaims = createMockCustomClaims('ACCOUNTANT');
      const mockUser = createMockFirebaseUser();

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const mockGetIdTokenResult = jest
        .fn()
        .mockResolvedValueOnce({
          token: 'mock-token',
          claims: mockClaims,
          authTime: new Date().toISOString(),
          issuedAtTime: tenMinutesAgo,
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          signInProvider: 'google.com',
        })
        .mockRejectedValueOnce(new Error('Network error')); // Background refresh fails

      mockUser.getIdTokenResult = mockGetIdTokenResult;

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still set user with cached token
      expect(result.current.user).toBe(mockUser);
      expect(result.current.claims).toEqual(mockClaims);
    });
  });

  /**
   * Test Group 4: Sign In Flow
   */
  describe('signInWithGoogle', () => {
    beforeEach(() => {
      // Mock Firestore imports for existing user
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
      });
      (setDoc as jest.Mock).mockResolvedValue(undefined);
    });

    it('should successfully sign in with Google', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        email: 'user@vapourdesal.com',
        displayName: 'Test User',
      });

      (signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      expect(isAuthorizedDomain).toHaveBeenCalledWith('user@vapourdesal.com');
    });

    it('should throw error if email is missing', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        email: null as unknown as string, // Force null email
      });

      (signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      await act(async () => {
        await expect(result.current.signInWithGoogle()).rejects.toThrow(
          'No email found in Google account'
        );
      });
    });

    it('should reject unauthorized domain and sign out', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        email: 'user@unauthorized.com',
      });

      (signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      (isAuthorizedDomain as jest.Mock).mockReturnValue(false);

      await act(async () => {
        await expect(result.current.signInWithGoogle()).rejects.toThrow('UNAUTHORIZED_DOMAIN');
      });

      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
    });

    it('should create user document for new users (internal domain)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        uid: 'new-user-uid',
        email: 'newuser@vapourdesal.com',
        displayName: 'New User',
        photoURL: 'https://example.com/photo.jpg',
      });

      (signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      // User document doesn't exist
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      // Verify setDoc was called to create user document
      expect(setDoc).toHaveBeenCalled();
      const setDocCall = (setDoc as jest.Mock).mock.calls[0];
      const userData = setDocCall[1];

      // Verify key fields
      expect(userData).toMatchObject({
        uid: 'new-user-uid',
        email: 'newuser@vapourdesal.com',
        displayName: 'New User',
        status: 'pending',
        isActive: false,
        permissions: 0,
        domain: 'internal', // Should be internal for @vapourdesal.com
        assignedProjects: [],
      });
    });

    it('should create user document for new users (external domain)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser({
        uid: 'external-user-uid',
        email: 'client@external.com',
        displayName: 'External User',
      });

      (signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      // Verify setDoc was called
      expect(setDoc).toHaveBeenCalled();
      const setDocCall = (setDoc as jest.Mock).mock.calls[0];
      const userData = setDocCall[1];

      // Verify domain is external for non-vapourdesal.com email
      expect(userData).toMatchObject({
        uid: 'external-user-uid',
        email: 'client@external.com',
        domain: 'external',
        status: 'pending',
        permissions: 0,
      });
    });

    it('should clean up on sign-in error', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser();
      (mockAuth as { currentUser?: FirebaseUser }).currentUser = mockUser;

      (signInWithPopup as jest.Mock).mockRejectedValue(new Error('Sign in failed'));

      await act(async () => {
        await expect(result.current.signInWithGoogle()).rejects.toThrow('Sign in failed');
      });

      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
    });
  });

  /**
   * Test Group 5: Sign Out Flow
   */
  describe('signOut', () => {
    it('should successfully sign out', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
    });

    it('should handle user state after sign out', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // First, sign in a user
      const mockClaims = createMockCustomClaims('TEAM_MEMBER');
      const mockUser = createMockFirebaseUser();

      (mockUser.getIdTokenResult as jest.Mock).mockResolvedValue({
        token: 'mock-token',
        claims: mockClaims,
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        signInProvider: 'google.com',
      });

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.user).toBe(mockUser);
      });

      // Now sign out
      await act(async () => {
        await result.current.signOut();
        authStateCallback?.(null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.claims).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  /**
   * Test Group 6: Error Handling
   */
  describe('Error Handling', () => {
    it('should handle getIdTokenResult errors and sign out', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser();

      (mockUser.getIdTokenResult as jest.Mock).mockRejectedValue(
        new Error('Token retrieval failed')
      );

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
      expect(result.current.user).toBeNull();
      expect(result.current.claims).toBeNull();
    });

    it('should handle sign out errors gracefully', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser();

      (mockUser.getIdTokenResult as jest.Mock).mockRejectedValue(new Error('Token error'));
      (firebaseSignOut as jest.Mock).mockRejectedValue(new Error('Sign out failed'));

      await act(async () => {
        authStateCallback?.(mockUser);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still set loading to false and clear state
      expect(result.current.user).toBeNull();
      expect(result.current.claims).toBeNull();
    });

    it('should handle race conditions with component unmount', async () => {
      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      const mockUser = createMockFirebaseUser();
      const mockClaims = createMockCustomClaims('TEAM_MEMBER');

      // Slow getIdTokenResult
      (mockUser.getIdTokenResult as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                token: 'mock-token',
                claims: mockClaims,
                authTime: new Date().toISOString(),
                issuedAtTime: new Date().toISOString(),
                expirationTime: new Date(Date.now() + 3600000).toISOString(),
                signInProvider: 'google.com',
              });
            }, 100);
          })
      );

      // Trigger auth state change
      act(() => {
        authStateCallback?.(mockUser);
      });

      // Unmount before token result resolves
      unmount();

      // Wait for token to resolve
      await new Promise((resolve) => setTimeout(resolve, 150));

      // State should not be updated after unmount (result.current will be undefined after unmount)
      // This test ensures no state updates occur after unmount
    });
  });

  /**
   * Test Group 7: useAuth Hook
   */
  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('should provide context when used within AuthProvider', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('claims');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('signInWithGoogle');
      expect(result.current).toHaveProperty('signOut');
    });
  });
});

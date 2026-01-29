'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { getFirebase } from '@/lib/firebase';
import type { CustomClaims } from '@vapour/types';
import { isAuthorizedDomain, PERMISSION_PRESETS } from '@vapour/constants';
import { createLogger } from '@vapour/utils';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

const logger = createLogger('Auth');

/**
 * Claims validation result
 */
type ClaimsValidationResult =
  | { status: 'valid'; claims: CustomClaims }
  | { status: 'pending' }
  | { status: 'invalid' };

/**
 * Validate custom claims structure
 * SECURITY: Prevents application crashes and auth bypass from malformed claims
 *
 * Returns status:
 * - 'valid': Claims are properly structured
 * - 'pending': User has no claims yet (awaiting admin approval)
 * - 'invalid': Claims exist but are malformed (security issue)
 */
function validateClaims(claims: unknown): ClaimsValidationResult {
  // Type guard: Check if claims is an object
  if (!claims || typeof claims !== 'object') {
    return { status: 'pending' };
  }

  const claimsObj = claims as Record<string, unknown>;

  // If no permissions property exists, user is pending approval
  if (typeof claimsObj.permissions !== 'number') {
    return { status: 'pending' };
  }

  // If permissions is 0, user has no permissions (pending approval)
  if (claimsObj.permissions === 0) {
    return { status: 'pending' };
  }

  // Check domain field
  if (!claimsObj.domain || !['internal', 'external'].includes(claimsObj.domain as string)) {
    logger.error('Invalid claims: missing or invalid domain field', { claims });
    return { status: 'invalid' };
  }

  return { status: 'valid', claims: claimsObj as unknown as CustomClaims };
}

interface AuthContextType {
  user: FirebaseUser | null;
  claims: CustomClaims | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailLinkSignIn: (email: string, link: string) => Promise<void>;
  isEmailLinkSignIn: (link: string) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [claims, setClaims] = useState<CustomClaims | null>(null);
  const [loading, setLoading] = useState(true);

  // Expose auth state and test sign-in methods to window for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as Window & {
        __authLoading?: boolean;
        __authUser?: boolean;
        __authClaims?: boolean;
        __e2eSignIn?: (email: string, password: string) => Promise<void>;
        __e2eSignInWithToken?: (token: string) => Promise<void>;
      };
      win.__authLoading = loading;
      win.__authUser = !!user;
      win.__authClaims = !!claims;

      // Only expose test sign-in methods when using emulator
      if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
        const extWin = win as Window & {
          __authLoading?: boolean;
          __authUser?: boolean;
          __authClaims?: boolean;
          __e2eSignIn?: (email: string, password: string) => Promise<void>;
          __e2eSignInWithToken?: (token: string) => Promise<void>;
          __e2eForceTokenRefresh?: () => Promise<void>;
        };

        // Email/password sign-in (requires provider to be enabled)
        extWin.__e2eSignIn = async (email: string, password: string) => {
          const { auth } = getFirebase();
          await signInWithEmailAndPassword(auth, email, password);
        };

        // Custom token sign-in (works without any provider enabled)
        // This is the preferred method for E2E tests
        extWin.__e2eSignInWithToken = async (token: string) => {
          const { auth } = getFirebase();
          await signInWithCustomToken(auth, token);
        };

        // Force token refresh - needed after Admin SDK sets claims
        // The onAuthStateChanged listener will pick up new claims after refresh
        extWin.__e2eForceTokenRefresh = async () => {
          const { auth } = getFirebase();
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true); // force refresh
            // Trigger a re-evaluation of claims by the auth state listener
            // We need to manually trigger onAuthStateChanged since getIdToken alone doesn't
            const idTokenResult = await auth.currentUser.getIdTokenResult(true);
            logger.debug('E2E: Forced token refresh', { claims: idTokenResult.claims });
          }
        };
      }
    }
  }, [loading, user, claims]);

  useEffect(() => {
    const { auth } = getFirebase();
    let isMounted = true; // Track if component is mounted

    logger.debug('Setting up auth listener');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      logger.debug('Auth state changed', {
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid,
      });

      try {
        if (firebaseUser) {
          try {
            // Get token (use cached version for fast initial load)
            // Only force refresh if token is older than 5 minutes
            const idTokenResult = await firebaseUser.getIdTokenResult(false);

            // Check if component was unmounted during async operation
            if (!isMounted) {
              return;
            }

            // Check if token is older than 5 minutes
            const tokenAge = Date.now() - new Date(idTokenResult.issuedAtTime).getTime();
            const FIVE_MINUTES = 5 * 60 * 1000;

            // If token is old, refresh it in background (don't block UI)
            if (tokenAge > FIVE_MINUTES) {
              firebaseUser.getIdTokenResult(true).catch(() => {
                // Ignore refresh errors - we'll use cached token
              });
            }

            // Validate claims structure
            const result = validateClaims(idTokenResult.claims);

            // Check again before state update
            if (!isMounted) {
              return;
            }

            if (result.status === 'pending') {
              // User authenticated but no claims yet - awaiting admin approval
              // Batch state updates to prevent intermediate renders
              setUser(firebaseUser);
              setClaims(null); // No claims yet
              setLoading(false);
              // Dashboard layout will redirect to /pending-approval
              return;
            }

            if (result.status === 'invalid') {
              // Claims exist but are malformed - security issue
              logger.error('User has invalid custom claims. Signing out.');
              await firebaseSignOut(auth);

              // Check again before state update
              if (!isMounted) {
                return;
              }

              // Batch state updates
              setUser(null);
              setClaims(null);
              setLoading(false);
              return;
            }

            // Valid claims - batch state updates to prevent race conditions
            setUser(firebaseUser);
            setClaims(result.claims);
            setLoading(false);
          } catch (error) {
            logger.error('Error validating user claims', { error });

            // Check if component is still mounted before async signOut
            if (!isMounted) {
              return;
            }

            // Ensure loading is set to false even on error
            try {
              await firebaseSignOut(auth);
            } catch (signOutError) {
              logger.error('Error signing out after validation failure', { error: signOutError });
            }

            // Check again before final state update
            if (!isMounted) {
              return;
            }

            // Batch state updates
            setUser(null);
            setClaims(null);
            setLoading(false);
          }
        } else {
          // Check before state update
          if (!isMounted) {
            return;
          }

          // Batch state updates
          setUser(null);
          setClaims(null);
          setLoading(false);
        }
      } catch (error) {
        // Catch any unexpected errors in the outer try block
        logger.error('Unexpected error in auth state change handler', { error });

        // Check before state update
        if (!isMounted) {
          return;
        }

        // Batch state updates
        setUser(null);
        setClaims(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false; // Mark as unmounted
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { auth, db } = getFirebase();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      if (!email) {
        throw new Error('No email found in Google account');
      }

      // Validate domain is authorized
      if (!isAuthorizedDomain(email)) {
        // Sign out immediately
        await firebaseSignOut(auth);
        throw new Error('UNAUTHORIZED_DOMAIN');
      }

      // Check if user document exists in Firestore
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // If user document doesn't exist, create it
      if (!userDocSnap.exists()) {
        // Calculate domain from email (@vapourdesal.com = internal, others = external)
        const isInternalUser = email.endsWith('@vapourdesal.com');
        const domain = isInternalUser ? 'internal' : 'external';

        // Auto-approve internal users with VIEWER permissions
        // External users remain pending until admin approves
        const userStatus = isInternalUser ? 'active' : 'pending';
        const userIsActive = isInternalUser;
        const userPermissions = isInternalUser ? PERMISSION_PRESETS.VIEWER : 0;

        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: email,
          displayName: result.user.displayName || '',
          photoURL: result.user.photoURL || '',
          status: userStatus,
          isActive: userIsActive,
          permissions: userPermissions,
          domain: domain,
          assignedProjects: [],
          department: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (isInternalUser) {
          logger.info('Auto-approved internal user with VIEWER permissions', { email });
        }
      }

      // Audit log: successful Google sign-in
      const auditContext = createAuditContext(
        result.user.uid,
        email,
        result.user.displayName || email
      );
      await logAuditEvent(
        db,
        auditContext,
        'LOGIN_SUCCESS',
        'USER',
        result.user.uid,
        `User signed in via Google: ${email}`,
        {
          metadata: {
            authMethod: 'google',
            isNewUser: !userDocSnap.exists(),
          },
        }
      );

      // Success - user will be handled by onAuthStateChanged
    } catch (error: unknown) {
      // Audit log: failed Google sign-in
      const { db: auditDb } = getFirebase();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during Google sign-in';
      await logAuditEvent(
        auditDb,
        createAuditContext('unknown', 'unknown', 'unknown'),
        'LOGIN_FAILED',
        'USER',
        'unknown',
        `Google sign-in failed: ${errorMessage}`,
        {
          success: false,
          errorMessage,
          metadata: { authMethod: 'google' },
        }
      );

      // Clean up on error
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
      throw error;
    }
  };

  /**
   * Send a sign-in link to the user's email
   * Used for passwordless authentication (external users without Google)
   */
  const sendEmailLink = async (email: string) => {
    const { auth } = getFirebase();

    // Validate domain is authorized
    if (!isAuthorizedDomain(email)) {
      throw new Error('UNAUTHORIZED_DOMAIN');
    }

    // Action code settings for email link
    const actionCodeSettings = {
      // URL to redirect to after clicking the link
      url: `${window.location.origin}/auth/email-link`,
      handleCodeInApp: true,
    };

    await sendSignInLinkToEmail(auth, email, actionCodeSettings);

    // Store email in localStorage for retrieval on callback page
    window.localStorage.setItem('emailForSignIn', email);
  };

  /**
   * Complete the email link sign-in process
   * Called from the callback page after user clicks the link
   */
  const completeEmailLinkSignIn = async (email: string, link: string) => {
    const { auth, db } = getFirebase();

    // Validate domain is authorized
    if (!isAuthorizedDomain(email)) {
      // Audit log: unauthorized domain attempt
      await logAuditEvent(
        db,
        createAuditContext('unknown', email, email),
        'LOGIN_FAILED',
        'USER',
        'unknown',
        `Email link sign-in failed: unauthorized domain for ${email}`,
        {
          success: false,
          errorMessage: 'UNAUTHORIZED_DOMAIN',
          metadata: { authMethod: 'email_link' },
        }
      );
      throw new Error('UNAUTHORIZED_DOMAIN');
    }

    try {
      const result = await signInWithEmailLink(auth, email, link);

      // Clear stored email
      window.localStorage.removeItem('emailForSignIn');

      // Check if user document exists in Firestore
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // If user document doesn't exist, create it
      if (!userDocSnap.exists()) {
        // Calculate domain from email (@vapourdesal.com = internal, others = external)
        const isInternalUser = email.endsWith('@vapourdesal.com');
        const domain = isInternalUser ? 'internal' : 'external';

        // Auto-approve internal users with VIEWER permissions
        // External users remain pending until admin approves
        const userStatus = isInternalUser ? 'active' : 'pending';
        const userIsActive = isInternalUser;
        const userPermissions = isInternalUser ? PERMISSION_PRESETS.VIEWER : 0;

        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: email,
          displayName: result.user.displayName || email.split('@')[0] || '',
          photoURL: result.user.photoURL || '',
          status: userStatus,
          isActive: userIsActive,
          permissions: userPermissions,
          domain: domain,
          assignedProjects: [],
          department: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (isInternalUser) {
          logger.info('Auto-approved internal user with VIEWER permissions', { email });
        }
      }

      // Audit log: successful email link sign-in
      const auditContext = createAuditContext(
        result.user.uid,
        email,
        result.user.displayName || email.split('@')[0] || email
      );
      await logAuditEvent(
        db,
        auditContext,
        'LOGIN_SUCCESS',
        'USER',
        result.user.uid,
        `User signed in via email link: ${email}`,
        {
          metadata: {
            authMethod: 'email_link',
            isNewUser: !userDocSnap.exists(),
          },
        }
      );
    } catch (error) {
      // Audit log: failed email link sign-in
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during email link sign-in';
      await logAuditEvent(
        db,
        createAuditContext('unknown', email, email),
        'LOGIN_FAILED',
        'USER',
        'unknown',
        `Email link sign-in failed for ${email}: ${errorMessage}`,
        {
          success: false,
          errorMessage,
          metadata: { authMethod: 'email_link' },
        }
      );
      throw error;
    }
  };

  /**
   * Check if a URL is a sign-in email link
   */
  const isEmailLinkSignIn = (link: string): boolean => {
    const { auth } = getFirebase();
    return isSignInWithEmailLink(auth, link);
  };

  const signOut = async () => {
    const { auth, db } = getFirebase();

    // Capture user info before signing out for audit log
    const currentUser = auth.currentUser;
    if (currentUser) {
      const auditContext = createAuditContext(
        currentUser.uid,
        currentUser.email || '',
        currentUser.displayName || currentUser.email || ''
      );
      await logAuditEvent(
        db,
        auditContext,
        'LOGOUT',
        'USER',
        currentUser.uid,
        `User signed out: ${currentUser.email}`
      );
    }

    await firebaseSignOut(auth);
  };

  const value = useMemo(
    () => ({
      user,
      claims,
      loading,
      signInWithGoogle,
      sendEmailLink,
      completeEmailLinkSignIn,
      isEmailLinkSignIn,
      signOut,
    }),
    [user, claims, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

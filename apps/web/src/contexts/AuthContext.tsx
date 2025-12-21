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

  // Expose auth loading state and test sign-in methods to window for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as Window & {
        __authLoading?: boolean;
        __e2eSignIn?: (email: string, password: string) => Promise<void>;
        __e2eSignInWithToken?: (token: string) => Promise<void>;
      };
      win.__authLoading = loading;

      // Only expose test sign-in methods when using emulator
      if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
        // Email/password sign-in (requires provider to be enabled)
        win.__e2eSignIn = async (email: string, password: string) => {
          const { auth } = getFirebase();
          await signInWithEmailAndPassword(auth, email, password);
        };

        // Custom token sign-in (works without any provider enabled)
        // This is the preferred method for E2E tests
        win.__e2eSignInWithToken = async (token: string) => {
          const { auth } = getFirebase();
          await signInWithCustomToken(auth, token);
        };
      }
    }
  }, [loading]);

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

      // Success - user will be handled by onAuthStateChanged
    } catch (error: unknown) {
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
      throw new Error('UNAUTHORIZED_DOMAIN');
    }

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
  };

  /**
   * Check if a URL is a sign-in email link
   */
  const isEmailLinkSignIn = (link: string): boolean => {
    const { auth } = getFirebase();
    return isSignInWithEmailLink(auth, link);
  };

  const signOut = async () => {
    const { auth } = getFirebase();
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

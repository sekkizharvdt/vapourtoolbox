'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebase } from '@/lib/firebase';
import type { CustomClaims } from '@vapour/types';
import { isAuthorizedDomain } from '@vapour/constants';
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [claims, setClaims] = useState<CustomClaims | null>(null);
  const [loading, setLoading] = useState(true);

  // Expose auth loading state to window for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { __authLoading?: boolean }).__authLoading = loading;
    }
  }, [loading]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[AuthContext] Starting auth setup...');
    const { auth } = getFirebase();
    // eslint-disable-next-line no-console
    console.log('[AuthContext] Firebase auth obtained');
    let isMounted = true; // Track if component is mounted

    logger.debug('Setting up auth listener');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // eslint-disable-next-line no-console
      console.log('[AuthContext] onAuthStateChanged fired', {
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid,
        isMounted,
      });
      logger.debug('Auth state changed', {
        hasUser: !!firebaseUser,
        uid: firebaseUser?.uid,
      });

      try {
        if (firebaseUser) {
          try {
            // eslint-disable-next-line no-console
            console.log('[AuthContext] Getting ID token...');
            // Get token (use cached version for fast initial load)
            // Only force refresh if token is older than 5 minutes
            const idTokenResult = await firebaseUser.getIdTokenResult(false);
            // eslint-disable-next-line no-console
            console.log('[AuthContext] ID token obtained');

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
            // eslint-disable-next-line no-console
            console.log('[AuthContext] Validating claims...', idTokenResult.claims);
            const result = validateClaims(idTokenResult.claims);
            // eslint-disable-next-line no-console
            console.log('[AuthContext] Claims validation result:', result.status);

            // Check again before state update
            if (!isMounted) {
              // eslint-disable-next-line no-console
              console.log('[AuthContext] Component unmounted, aborting');
              return;
            }

            if (result.status === 'pending') {
              // User authenticated but no claims yet - awaiting admin approval
              // eslint-disable-next-line no-console
              console.log('[AuthContext] Claims pending, setting loading=false');
              // Batch state updates to prevent intermediate renders
              setUser(firebaseUser);
              setClaims(null); // No claims yet
              setLoading(false);
              // Dashboard layout will redirect to /pending-approval
              return;
            }

            if (result.status === 'invalid') {
              // Claims exist but are malformed - security issue
              // eslint-disable-next-line no-console
              console.log('[AuthContext] Invalid claims, signing out');
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
            // eslint-disable-next-line no-console
            console.log('[AuthContext] Valid claims, setting loading=false');
            setUser(firebaseUser);
            setClaims(result.claims);
            setLoading(false);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[AuthContext] Error validating claims:', error);
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
          // eslint-disable-next-line no-console
          console.log('[AuthContext] No user, setting loading=false');
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
        // eslint-disable-next-line no-console
        console.error('[AuthContext] Unexpected error:', error);
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

      // If user document doesn't exist, create it with pending status
      if (!userDocSnap.exists()) {
        // Calculate domain from email (@vapourdesal.com = internal, others = external)
        const domain = email.endsWith('@vapourdesal.com') ? 'internal' : 'external';

        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: email,
          displayName: result.user.displayName || '',
          photoURL: result.user.photoURL || '',
          status: 'pending',
          isActive: false,
          permissions: 0, // No permissions until admin approves
          domain: domain,
          assignedProjects: [],
          department: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
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

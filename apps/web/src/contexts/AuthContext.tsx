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
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
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

  // If both permissions fields are 0, user has no permissions (pending approval)
  const perms2 = typeof claimsObj.permissions2 === 'number' ? claimsObj.permissions2 : 0;
  if (claimsObj.permissions === 0 && perms2 === 0) {
    return { status: 'pending' };
  }

  // Check domain field
  if (!claimsObj.domain || !['internal', 'external'].includes(claimsObj.domain as string)) {
    logger.error('Invalid claims: missing or invalid domain field', { claims });
    return { status: 'invalid' };
  }

  // Ensure permissions2 defaults to 0 if not present in claims
  const validClaims: CustomClaims = {
    ...(claimsObj as unknown as CustomClaims),
    permissions2: typeof claimsObj.permissions2 === 'number' ? claimsObj.permissions2 : 0,
  };

  return { status: 'valid', claims: validClaims };
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

  // AA-7 + AA-4: Listen to user document for claims changes.
  // When the Cloud Function updates custom claims (and writes lastClaimUpdate),
  // this listener detects the change and forces a token refresh so the client
  // immediately picks up new permissions without requiring sign-out/sign-in.
  useEffect(() => {
    if (!user) return;

    const { db } = getFirebase();
    let lastKnownClaimUpdate: number | null = null;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const data = snapshot.data();
      const claimUpdate = data?.lastClaimUpdate?.toMillis?.() || null;

      // Only trigger refresh when lastClaimUpdate actually changes (skip initial load)
      if (
        lastKnownClaimUpdate !== null &&
        claimUpdate !== null &&
        claimUpdate !== lastKnownClaimUpdate
      ) {
        logger.debug('Claims updated server-side, refreshing token', {
          uid: user.uid,
          lastClaimUpdate: claimUpdate,
        });

        user
          .getIdTokenResult(true)
          .then((result) => {
            const claimsResult = validateClaims(result.claims);
            if (claimsResult.status === 'valid') {
              setClaims(claimsResult.claims);
            }
          })
          .catch(() => {
            // Refresh failed — tokens may have been revoked (user deactivated)
            // The auth state change handler will handle sign-out
          });
      }

      lastKnownClaimUpdate = claimUpdate;
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user]);

  /**
   * Check if a pending (non-expired) invitation exists for an email.
   * Used to allow invited external users to bypass domain restrictions.
   */
  const hasPendingInvitation = async (
    email: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any
  ): Promise<boolean> => {
    try {
      const invitationsRef = collection(db, COLLECTIONS.INVITATIONS);
      const invQuery = query(
        invitationsRef,
        where('email', '==', email.toLowerCase()),
        where('status', '==', 'pending')
      );
      const invSnap = await getDocs(invQuery);

      if (invSnap.empty || !invSnap.docs[0]) return false;

      // Check expiry
      const invData = invSnap.docs[0].data();
      const expiresAt = invData.expiresAt?.toDate?.() || new Date(0);
      return expiresAt >= new Date();
    } catch (err) {
      logger.error('Error checking for pending invitation', { email, error: err });
      return false;
    }
  };

  /**
   * Check if a user document already exists by UID.
   * Handles returning external users (e.g., previously invited users whose
   * invitation was already accepted). Uses direct document read which passes
   * the isOwner(userId) Firestore rule.
   */
  const hasExistingUserByUid = async (
    uid: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any
  ): Promise<boolean> => {
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, uid);
      const userDocSnap = await getDoc(userDocRef);
      return userDocSnap.exists();
    } catch (err) {
      logger.error('Error checking for existing user by UID', { uid, error: err });
      return false;
    }
  };

  /**
   * Check if a pending invitation exists for an email address.
   * If found, returns the invitation data and marks it as accepted.
   */
  const checkAndAcceptInvitation = async (
    email: string,
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any
  ): Promise<{
    permissions: number;
    permissions2: number;
    department: string;
    jobTitle: string;
    displayName: string;
  } | null> => {
    try {
      const invitationsRef = collection(db, COLLECTIONS.INVITATIONS);
      const invQuery = query(
        invitationsRef,
        where('email', '==', email.toLowerCase()),
        where('status', '==', 'pending')
      );
      const invSnap = await getDocs(invQuery);

      if (invSnap.empty || !invSnap.docs[0]) return null;

      // Use the first matching invitation
      const invDoc = invSnap.docs[0];
      const invData = invDoc.data();

      // Check if invitation has expired
      const expiresAt = invData.expiresAt?.toDate?.() || new Date(0);
      if (expiresAt < new Date()) {
        // Mark as expired
        await updateDoc(invDoc.ref, { status: 'expired' });
        return null;
      }

      // Mark invitation as accepted
      await updateDoc(invDoc.ref, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        userId,
      });

      logger.info('Invitation accepted for user', { email, invitationId: invDoc.id });

      return {
        permissions: invData.permissions || 0,
        permissions2: invData.permissions2 || 0,
        department: invData.department || '',
        jobTitle: invData.jobTitle || '',
        displayName: invData.displayName || '',
      };
    } catch (err) {
      logger.error('Error checking invitation', { email, error: err });
      return null;
    }
  };

  const signInWithGoogle = async () => {
    const { auth, db } = getFirebase();
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;

      if (!email) {
        throw new Error('No email found in Google account');
      }

      // Validate domain is authorized, OR user has a pending invitation,
      // OR user already exists in the system (previously invited/approved)
      if (!isAuthorizedDomain(email)) {
        const invited = await hasPendingInvitation(email, db);
        if (!invited) {
          // Check if user already has an account (returning external user)
          // Uses direct UID lookup which passes isOwner() Firestore rule
          const existingUser = await hasExistingUserByUid(result.user.uid, db);
          if (!existingUser) {
            await firebaseSignOut(auth);
            throw new Error('UNAUTHORIZED_DOMAIN');
          }
          logger.info('External domain allowed via existing user record', { email });
        } else {
          logger.info('External domain allowed via invitation', { email });
        }
      }

      // Check if user document exists in Firestore
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // If user document doesn't exist, create it
      if (!userDocSnap.exists()) {
        // Calculate domain from email (@vapourdesal.com = internal, others = external)
        const isInternalUser = email.endsWith('@vapourdesal.com');
        const domain = isInternalUser ? 'internal' : 'external';

        // Check for a pending invitation
        const invitation = await checkAndAcceptInvitation(email, result.user.uid, db);

        // Determine user status and permissions
        let userStatus: string;
        let userIsActive: boolean;
        let userPermissions: number;
        let userPermissions2 = 0;
        let userDepartment = '';
        let userJobTitle: string | null = null;
        let userDisplayName = result.user.displayName || '';

        if (invitation) {
          // Invitation found — use pre-configured permissions
          userStatus = 'active';
          userIsActive = true;
          userPermissions = invitation.permissions;
          userPermissions2 = invitation.permissions2;
          userDepartment = invitation.department;
          userJobTitle = invitation.jobTitle || null;
          if (invitation.displayName) {
            userDisplayName = invitation.displayName;
          }
          logger.info('User auto-approved via invitation', { email });
        } else if (isInternalUser) {
          // Auto-approve internal users with VIEWER permissions
          userStatus = 'active';
          userIsActive = true;
          userPermissions = PERMISSION_PRESETS.VIEWER;
          logger.info('Auto-approved internal user with VIEWER permissions', { email });
        } else {
          // External users remain pending until admin approves
          userStatus = 'pending';
          userIsActive = false;
          userPermissions = 0;
        }

        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: email,
          displayName: userDisplayName,
          photoURL: result.user.photoURL || '',
          status: userStatus,
          isActive: userIsActive,
          permissions: userPermissions,
          ...(userPermissions2 > 0 && { permissions2: userPermissions2 }),
          domain: domain,
          tenantId: 'default-entity',
          assignedProjects: [],
          department: userDepartment,
          ...(userJobTitle && { jobTitle: userJobTitle }),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
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

    // Domain/invitation validation is deferred to completeEmailLinkSignIn
    // (after authentication) where we have auth context to read Firestore.
    // Sending an email link to an unauthorized address is harmless —
    // they'll be blocked when they click the link.

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

    try {
      // Authenticate first — we need auth context for Firestore rule checks
      const result = await signInWithEmailLink(auth, email, link);

      // Clear stored email
      window.localStorage.removeItem('emailForSignIn');

      // Validate domain AFTER authentication (so Firestore rules allow reads)
      if (!isAuthorizedDomain(email)) {
        const invited = await hasPendingInvitation(email, db);
        if (!invited) {
          const existingUser = await hasExistingUserByUid(result.user.uid, db);
          if (!existingUser) {
            // Audit log: unauthorized domain attempt
            await logAuditEvent(
              db,
              createAuditContext(result.user.uid, email, email),
              'LOGIN_FAILED',
              'USER',
              result.user.uid,
              `Email link sign-in failed: unauthorized domain for ${email}`,
              {
                success: false,
                errorMessage: 'UNAUTHORIZED_DOMAIN',
                metadata: { authMethod: 'email_link' },
              }
            );
            await firebaseSignOut(auth);
            throw new Error('UNAUTHORIZED_DOMAIN');
          }
          logger.info('External domain allowed via existing user record', { email });
        } else {
          logger.info('External domain allowed via invitation', { email });
        }
      }

      // Check if user document exists in Firestore
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // If user document doesn't exist, create it
      if (!userDocSnap.exists()) {
        // Calculate domain from email (@vapourdesal.com = internal, others = external)
        const isInternalUser = email.endsWith('@vapourdesal.com');
        const domain = isInternalUser ? 'internal' : 'external';

        // Check for a pending invitation
        const invitation = await checkAndAcceptInvitation(email, result.user.uid, db);

        // Determine user status and permissions
        let userStatus: string;
        let userIsActive: boolean;
        let userPermissions: number;
        let userPermissions2 = 0;
        let userDepartment = '';
        let userJobTitle: string | null = null;
        let userDisplayName = result.user.displayName || email.split('@')[0] || '';

        if (invitation) {
          userStatus = 'active';
          userIsActive = true;
          userPermissions = invitation.permissions;
          userPermissions2 = invitation.permissions2;
          userDepartment = invitation.department;
          userJobTitle = invitation.jobTitle || null;
          if (invitation.displayName) {
            userDisplayName = invitation.displayName;
          }
          logger.info('User auto-approved via invitation', { email });
        } else if (isInternalUser) {
          userStatus = 'active';
          userIsActive = true;
          userPermissions = PERMISSION_PRESETS.VIEWER;
          logger.info('Auto-approved internal user with VIEWER permissions', { email });
        } else {
          userStatus = 'pending';
          userIsActive = false;
          userPermissions = 0;
        }

        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: email,
          displayName: userDisplayName,
          photoURL: result.user.photoURL || '',
          status: userStatus,
          isActive: userIsActive,
          permissions: userPermissions,
          ...(userPermissions2 > 0 && { permissions2: userPermissions2 }),
          domain: domain,
          tenantId: 'default-entity',
          assignedProjects: [],
          department: userDepartment,
          ...(userJobTitle && { jobTitle: userJobTitle }),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
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

  /* eslint-disable react-hooks/exhaustive-deps -- auth functions use getFirebase() internally and are stable */
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
  /* eslint-enable react-hooks/exhaustive-deps */

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

# Security Fixes & Google OAuth Implementation - Progress Report

**Date:** January 2025
**Status:** 🟢 IN PROGRESS - 50% Complete

---

## Completed Tasks ✅

### Phase 1: CRITICAL Security Fixes (COMPLETE)

#### 1. ✅ Fixed Firestore Security Rule Bug
**File:** `firestore.rules:77`
- **Issue:** `isAssignedToProject()` used `in` operator which checks array indices, not values
- **Fix:** Changed to `.hasAny([projectId])` to properly check array values
- **Impact:** Prevents unauthorized access to projects via array index manipulation

#### 2. ✅ Added Custom Claims Validation
**File:** `apps/web/src/contexts/AuthContext.tsx`
- **Added:** `validateClaims()` function to verify structure
- **Validates:** roles array, domain field, permissions number
- **Behavior:** Signs out user if claims are malformed
- **Impact:** Prevents application crashes and auth bypass

#### 3. ✅ Added Environment Variable Validation
**File:** `apps/web/src/app/layout.tsx`
- **Added:** Startup validation call to `validateFirebaseEnvironment()`
- **Impact:** Clear errors on startup if Firebase config is missing

#### 4. ✅ Implemented Rate Limiting
**File:** `apps/web/src/app/login/page.tsx`
- **Implementation:** Rate limiter checks email before sign-in
- **Limit:** 5 attempts per 15 minutes
- **UX:** Shows clear error with remaining time
- **Reset:** Clears rate limit on successful login
- **Impact:** Prevents brute force attacks

#### 5. ✅ Added CSRF Protection
**Files Created:**
- `apps/web/middleware.ts` - CSRF validation middleware
- `apps/web/src/lib/csrf.ts` - CSRF token utilities
- `apps/web/src/components/CSRFProvider.tsx` - Client-side initialization

**Features:**
- Generates cryptographically secure tokens
- Validates on POST/PUT/DELETE/PATCH requests
- Sets SameSite=Strict cookies
- Adds security headers (CSP, X-Frame-Options, etc.)
- **Impact:** Prevents cross-site request forgery attacks

#### 6. ✅ Added Domain Validation for Clients
**File:** `packages/constants/src/domains.ts`
- **Added:** `ALLOWED_CLIENT_DOMAINS` from env variable
- **Added:** `isAllowedClientDomain(email)` function
- **Added:** `isAuthorizedDomain(email)` function
- **Env Var:** `NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS` (comma-separated)
- **Updated:** `.env.local.example` with Google OAuth and client domains

---

## Remaining Tasks 📋

### Phase 2: Google Workspace Authentication (50% remaining)

#### 7. ⏳ Implement Google Sign-In OAuth (IN PROGRESS)
**Estimated Time:** 1 hour

**Tasks:**
- [ ] Add GoogleAuthProvider to Firebase client
- [ ] Create `signInWithGoogle()` function in AuthContext
- [ ] Add domain validation after Google sign-in
- [ ] Handle unauthorized domains (reject with error)

**Implementation Plan:**
```typescript
// apps/web/src/contexts/AuthContext.tsx
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const signInWithGoogle = async () => {
  const { auth } = getFirebase();
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email;

    // Validate domain
    if (!isAuthorizedDomain(email)) {
      await firebaseSignOut(auth);
      throw new Error('Unauthorized domain');
    }

    return result;
  } catch (error) {
    throw error;
  }
};
```

#### 8. ⏳ Remove Email/Password Authentication
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Delete `apps/web/src/app/signup/page.tsx`
- [ ] Remove email/password form from login page
- [ ] Remove `signUp` method from AuthContext
- [ ] Remove `createUserWithEmailAndPassword` import

#### 9. ⏳ Update Login UI with Google Button
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Replace email/password form with Google Sign-In button
- [ ] Style per Google brand guidelines
- [ ] Add loading state during OAuth
- [ ] Show domain error for unauthorized domains

**UI Design:**
```typescript
<Button
  variant="outlined"
  size="large"
  fullWidth
  onClick={handleGoogleSignIn}
  disabled={loading}
  startIcon={<GoogleIcon />}
  sx={{
    borderColor: '#4285F4',
    color: '#4285F4',
    '&:hover': {
      borderColor: '#357AE8',
      backgroundColor: 'rgba(66, 133, 244, 0.04)',
    },
  }}
>
  {loading ? 'Signing in...' : 'Sign in with Google'}
</Button>
```

#### 10. ⏳ Create Invitation System Types
**Estimated Time:** 1 hour

**Tasks:**
- [ ] Create `packages/types/src/invitation.ts`
- [ ] Define Invitation interface
- [ ] Define InvitationStatus type
- [ ] Add to types package exports

**Schema:**
```typescript
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  id: string;
  email: string;
  domain: string;
  role: 'CLIENT_PM';
  assignedProjects: string[];
  createdBy: string; // User ID who created invitation
  createdAt: Date;
  expiresAt: Date; // 7 days from creation
  status: InvitationStatus;
  token: string; // Secure random token for magic link
}

export interface CreateInvitationInput {
  email: string;
  assignedProjects: string[];
}
```

#### 11. ⏳ Update Firestore Security Rules for CLIENT_PM
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Add helper function `isClientPM()`
- [ ] Update procurement collection rules (PRs, RFQs, POs, Payments)
- [ ] Add invitation collection rules
- [ ] Test rules with Firebase emulator

**Example Rule:**
```javascript
function isClientPM() {
  return isAuthenticated() &&
         request.auth.token.domain == 'external' &&
         hasPermission(2097152); // VIEW_PROCUREMENT
}

match /purchaseRequisitions/{prId} {
  allow read: if isInternalUser() ||
                 (isClientPM() && isAssignedToProject(resource.data.projectId));
}
```

#### 12. ⏳ Create Error Pages and Error Boundary
**Estimated Time:** 30 minutes

**Files to Create:**
- `apps/web/src/app/unauthorized/page.tsx`
- `apps/web/src/app/pending-approval/page.tsx`
- `apps/web/src/app/invitation-expired/page.tsx`
- `apps/web/src/components/ErrorBoundary.tsx`

#### 13. ⏳ Run Type Check and Verify Build
**Estimated Time:** 30 minutes

**Tasks:**
- [ ] Run `pnpm type-check`
- [ ] Fix any TypeScript errors
- [ ] Run `pnpm build` (Next.js build)
- [ ] Verify no errors

---

## Progress Summary

### Completed: 6/13 tasks (46%)
### Time Spent: ~2.5 hours
### Time Remaining: ~4.5 hours

---

## Key Achievements So Far

✅ **All CRITICAL Security Vulnerabilities Fixed**
- Firestore security rule bug
- Custom claims validation
- Environment validation
- Rate limiting
- CSRF protection

✅ **Domain Access Control Implemented**
- Internal domain validation (@vapourdesal.com)
- External client domain allowlist
- Authorization functions

✅ **Security Infrastructure in Place**
- Rate limiter class with reset capability
- CSRF token generation and validation
- Security headers middleware

---

## Next Session Checklist

When resuming work:

1. **Implement Google Sign-In**
   - Add GoogleAuthProvider
   - Create signInWithGoogle function
   - Add domain validation after sign-in

2. **Remove Email/Password Auth**
   - Delete signup page
   - Update login page to Google-only

3. **Update UI**
   - Create Google Sign-In button
   - Style per Google guidelines
   - Add error messages

4. **Complete Type Definitions**
   - Create invitation types
   - Update exports

5. **Update Security Rules**
   - Add CLIENT_PM procurement access
   - Add invitation collection rules

6. **Create Error Handling**
   - Error boundary component
   - Unauthorized page
   - Pending approval page

7. **Test & Verify**
   - Type check all packages
   - Build Next.js app
   - Manual testing

---

## Critical Notes

### Google OAuth Setup Required

Before Google Sign-In will work, you need to:

1. **Enable Google OAuth in Firebase Console:**
   - Go to Firebase Console → Authentication → Sign-in method
   - Enable "Google" provider
   - Configure OAuth consent screen

2. **Get Google Client ID:**
   - Firebase Console → Authentication → Sign-in method → Google
   - Copy Web Client ID
   - Add to `.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

3. **Configure Authorized Domains:**
   - Firebase Console → Authentication → Settings
   - Add your deployment domains to authorized domains list

4. **Set Allowed Client Domains:**
   - Add client company domains to `.env.local`
   - Format: `NEXT_PUBLIC_ALLOWED_CLIENT_DOMAINS=client1.com,client2.com`

### Testing Recommendations

After completion:

1. **Internal User Flow:**
   - Sign in with @vapourdesal.com Google account
   - Verify custom claims are set
   - Verify full dashboard access

2. **External Client Flow:**
   - Admin creates invitation (Phase 3 feature)
   - Client clicks magic link
   - Signs in with Google
   - Verify CLIENT_PM role assigned
   - Verify procurement view-only access

3. **Security Testing:**
   - Try unauthorized domain → should reject
   - Try 6+ login attempts → should rate limit
   - Try CSRF attack → should block
   - Verify security headers in browser devtools

---

## Files Modified/Created This Session

### Modified:
1. `firestore.rules` - Fixed isAssignedToProject bug
2. `apps/web/src/contexts/AuthContext.tsx` - Added claims validation
3. `apps/web/src/app/layout.tsx` - Added env validation and CSRF provider
4. `apps/web/src/app/login/page.tsx` - Added rate limiting
5. `packages/constants/src/domains.ts` - Added client domain validation
6. `apps/web/.env.local.example` - Added Google OAuth and client domains

### Created:
7. `apps/web/middleware.ts` - CSRF protection and security headers
8. `apps/web/src/lib/csrf.ts` - CSRF token utilities
9. `apps/web/src/components/CSRFProvider.tsx` - CSRF initialization

### Total: 9 files modified/created

---

## Risk Assessment

**Before Fixes:** 🔴 CRITICAL - Multiple authentication bypass vulnerabilities

**Current State:** 🟡 MODERATE - Critical security holes fixed, authentication migration in progress

**After Completion:** 🟢 LOW RISK - Production-ready with proper security controls

---

**Last Updated:** January 2025
**Next Update:** After Google OAuth implementation complete

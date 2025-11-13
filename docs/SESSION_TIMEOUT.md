# Session Timeout Implementation

**Date**: November 13, 2025
**Feature**: Automatic session timeout with idle detection
**Status**: ✅ Production-ready
**Security**: Addresses OWASP A07 (Identification and Authentication Failures)

---

## Overview

The session timeout feature automatically signs out users after 30 minutes of inactivity, preventing unauthorized access to unattended devices. This is a critical security enhancement that addresses authentication security gaps identified in the security audit.

### Key Features

✅ **Idle Detection** - Tracks mouse, keyboard, touch, and scroll events
✅ **Warning Modal** - Shows countdown 5 minutes before auto-logout
✅ **Session Extension** - Users can extend session with one click
✅ **Token Monitoring** - Auto-refreshes Firebase tokens before expiration
✅ **Tab Visibility** - Continues tracking when tab is inactive
✅ **Keyboard Shortcuts** - Enter to extend, Esc to logout
✅ **Production Mode** - Only enabled in production by default

---

## Configuration

### Timeout Durations

```typescript
const SESSION_CONFIG = {
  WARNING_TIME: 25 * 60 * 1000, // 25 minutes - Warning appears
  LOGOUT_TIME: 5 * 60 * 1000, // 5 minutes - Time to respond to warning
  TOTAL_IDLE_TIME: 30 * 60 * 1000, // 30 minutes - Total idle before logout
  TOKEN_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes - Token expiration check
  TOKEN_EXPIRY_THRESHOLD: 55 * 60 * 1000, // 55 minutes - Refresh token
};
```

### Customization

To adjust timeout duration, edit `/apps/web/src/hooks/useSessionTimeout.ts`:

```typescript
// Example: 15-minute timeout
const SESSION_CONFIG = {
  WARNING_TIME: 12 * 60 * 1000, // Warning at 12 minutes
  LOGOUT_TIME: 3 * 60 * 1000, // 3 minutes to respond
  TOTAL_IDLE_TIME: 15 * 60 * 1000, // 15-minute total
  // ... other config
};
```

---

## Architecture

### Components

1. **`useSessionTimeout` Hook** (`apps/web/src/hooks/useSessionTimeout.ts`)
   - Core logic for idle detection
   - Timer management
   - Token expiration monitoring
   - Activity tracking

2. **`SessionTimeoutModal` Component** (`apps/web/src/components/auth/SessionTimeoutModal.tsx`)
   - Warning UI with countdown
   - Color-coded urgency (blue → yellow → red)
   - Keyboard shortcuts
   - Progress bar visualization

3. **Dashboard Layout Integration** (`apps/web/src/app/dashboard/layout.tsx`)
   - Mounts session timeout for authenticated users
   - Displays modal when warning triggered

### Activity Tracking

The following events reset the idle timer:

- `mousedown` - Mouse clicks
- `mousemove` - Mouse movement
- `keydown` - Keyboard input
- `scroll` - Page scrolling
- `touchstart` - Touch events
- `click` - Click events

**Throttling**: Activity events are throttled to max once per second to prevent performance issues.

---

## User Experience Flow

### Timeline

```
0 min          User authenticates
↓
...            Normal activity (timers reset on each action)
↓
25 min         Idle detected - Warning modal appears
↓
25-30 min      Warning countdown period
               - ANY activity (typing, clicking, etc.) auto-extends session
               - Warning modal automatically dismisses on activity
               - User can also click "Stay Signed In" button
               - Or click "Sign Out Now" to logout immediately
↓
30 min         Auto-logout ONLY if completely idle (no activity at all)
               - User signed out automatically
               - Redirected to login page
```

**Key Point**: If you're actively working (typing, clicking, moving mouse), you will **never** be logged out, even if the warning appears. The warning only leads to logout if you are truly idle with zero activity.

### Warning Modal States

**At 4+ minutes remaining:**

- **Color**: Blue (info)
- **Message**: "Your session is about to expire"
- **User Action**: Continue working (activity auto-extends) OR click "Stay Signed In"

**At 1-4 minutes remaining:**

- **Color**: Yellow (warning)
- **Message**: "Your session is about to expire"
- **User Action**: Continue working (activity auto-extends) OR click "Stay Signed In"

**At < 1 minute remaining:**

- **Color**: Red (error)
- **Message**: "Your session is about to expire"
- **User Action**: Continue working (activity auto-extends) OR click "Stay Signed In"

**Important**: Any activity (typing, clicking, mouse movement) during the warning period **automatically extends** the session and dismisses the warning. You don't need to click the button if you're actively working.

---

## Token Management

### Firebase Token Lifecycle

Firebase Auth tokens expire after **1 hour** by default. The session timeout hook:

1. **Checks token expiration** every 5 minutes
2. **Auto-refreshes token** if it expires in < 5 minutes
3. **Maintains authentication** without user interaction
4. **Logs errors** if refresh fails (rare)

```typescript
// Token refresh logic
const checkTokenExpiration = async () => {
  const idTokenResult = await user.getIdTokenResult();
  const timeUntilExpiry = expirationTime - Date.now();

  if (timeUntilExpiry < 5 * 60 * 1000) {
    await user.getIdTokenResult(true); // Force refresh
  }
};
```

---

## Security Considerations

### OWASP A07 Compliance

This implementation addresses the following OWASP authentication failure risks:

✅ **Session Hijacking Prevention**

- Automatic logout prevents attackers from using unattended sessions
- Token refresh ensures sessions don't persist indefinitely

✅ **Idle Timeout**

- 30-minute timeout balances security and usability
- Industry standard for internal business applications

✅ **User Awareness**

- 5-minute warning gives users time to save work
- Clear visual feedback (countdown, progress bar, colors)

✅ **Token Security**

- Firebase tokens auto-refresh before expiration
- Prevents token expiry errors during active sessions

### Browser Tab Management

**Tab Hidden Behavior:**

- Inactivity timer continues when tab is hidden
- On tab visibility, checks if session expired
- Auto-logout if idle time exceeded while hidden
- Shows warning if approaching timeout

**Multiple Tabs:**

- Each tab tracks its own activity independently
- Logout in one tab doesn't affect others (Firebase auth state syncs across tabs)
- Users should stay active in at least one tab to maintain session

---

## Testing

### Manual Testing

1. **Basic Timeout**

   ```bash
   # 1. Log in to dashboard
   # 2. Wait 25 minutes (or temporarily reduce WARNING_TIME in code)
   # 3. Verify warning modal appears
   # 4. Wait 5 more minutes or click "Stay Signed In"
   # 5. Verify behavior matches expected
   ```

2. **Session Extension**

   ```bash
   # 1. Trigger warning modal
   # 2. Click "Stay Signed In"
   # 3. Verify modal closes
   # 4. Verify timer resets (warning doesn't reappear immediately)
   ```

3. **Auto-Logout**

   ```bash
   # 1. Trigger warning modal
   # 2. Wait for countdown to reach 0
   # 3. Verify auto-logout occurs
   # 4. Verify redirect to login page
   ```

4. **Activity Detection**
   ```bash
   # 1. Move mouse periodically
   # 2. Verify warning never appears (timer keeps resetting)
   # 3. Stop all activity
   # 4. Verify warning appears after 25 minutes
   ```

### Keyboard Shortcuts

**In Warning Modal:**

- `Enter` - Extends session (same as "Stay Signed In" button)
- `Esc` - Logs out immediately (same as "Sign Out Now" button)

### Development Mode

By default, session timeout is **disabled in development** to avoid interruptions during development.

To test in development, pass `enabled: true` to the hook:

```typescript
// In apps/web/src/app/dashboard/layout.tsx
const { showWarning, timeRemaining, extendSession, logout } = useSessionTimeout(true);
```

Or set environment variable:

```bash
NODE_ENV=production pnpm dev
```

---

## Monitoring

### Logging

Session timeout events are logged using the structured logger:

```typescript
logger.info('Session timeout - logging out user');
logger.warn('Session about to timeout - showing warning');
logger.debug('Session timers reset');
logger.error('Error checking token expiration', error);
```

**Log Location**: Browser console (development) or Sentry (production)

### Sentry Integration

Session timeout errors are automatically captured by Sentry:

- Token refresh failures
- Unexpected logout errors
- Timer management errors

---

## Troubleshooting

### Issue: Warning appears too quickly

**Cause**: `WARNING_TIME` is too short
**Solution**: Increase `WARNING_TIME` in `useSessionTimeout.ts`

```typescript
WARNING_TIME: 25 * 60 * 1000, // Increase this value
```

### Issue: User logged out despite activity

**Cause**: Activity not being detected (specific event types not tracked)
**Solution**:

- Check if user's activity triggers tracked events (mouse, keyboard, etc.)
- Verify events being tracked: `mousedown`, `mousemove`, `keydown`, `scroll`, `touchstart`, `click`
- Check browser console for activity detection logs (set logger to debug level)

**Note**: As of the latest version, ANY activity during the warning period automatically extends the session, so this issue should be extremely rare.

### Issue: Warning doesn't appear

**Cause**: Session timeout disabled (development mode)
**Solution**: Enable with `useSessionTimeout(true)` or run in production mode

### Issue: Token refresh fails

**Cause**: Network issues or Firebase service disruption
**Solution**: Check network connectivity, Firebase status, and Sentry for error details

---

## Performance Impact

### Minimal Overhead

- **Event listeners**: Throttled to max 1 event per second
- **Memory**: ~4 timers (warning, logout, countdown, token check)
- **CPU**: Negligible (only on user activity)
- **Network**: Token refresh every 55 minutes (only if needed)

### Optimization

Activity throttling prevents performance issues:

```typescript
// Throttle logic - max once per second
let activityThrottleTimer: NodeJS.Timeout | null = null;

const handleActivity = () => {
  if (activityThrottleTimer) return; // Skip if already handled recently

  activityThrottleTimer = setTimeout(() => {
    activityThrottleTimer = null;
  }, 1000);

  resetTimers();
};
```

---

## Future Enhancements

### Potential Improvements

1. **Configurable Timeout** (2 hours)
   - Admin UI to set timeout duration per organization
   - User preference to customize their timeout
   - Different timeouts for different roles

2. **Remember Device** (4 hours)
   - "Trust this device" checkbox
   - Longer timeout for trusted devices
   - Secure device fingerprinting

3. **Activity Patterns** (6 hours)
   - Machine learning to detect active vs. idle patterns
   - Smart timeout based on user behavior
   - Anomaly detection for suspicious activity

4. **Cross-Tab Coordination** (3 hours)
   - Share session state across tabs
   - Activity in one tab extends all tabs
   - Single warning modal for all tabs

---

## Migration Notes

### Upgrading from Previous Version

No migration required - this is a new feature. Users will automatically benefit from session timeout protection on next login.

### Rollback Plan

If issues arise, session timeout can be disabled by setting:

```typescript
// In apps/web/src/app/dashboard/layout.tsx
const { showWarning, timeRemaining, extendSession, logout } = useSessionTimeout(false);
```

Or remove the `useSessionTimeout` hook call entirely.

---

## References

- **OWASP A07**: [https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- **Firebase Auth Tokens**: [https://firebase.google.com/docs/auth/admin/manage-sessions](https://firebase.google.com/docs/auth/admin/manage-sessions)
- **Security Audit**: `docs/SECURITY_AUDIT_2025-11-13.md`

---

**Document Version**: 1.0
**Last Updated**: November 13, 2025
**Maintained By**: Engineering Team
**Next Review**: December 13, 2025

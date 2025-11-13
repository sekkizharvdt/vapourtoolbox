'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@vapour/utils';

const logger = createLogger('SessionTimeout');

/**
 * Session timeout configuration
 */
const SESSION_CONFIG = {
  // Time before warning modal appears (25 minutes)
  WARNING_TIME: 25 * 60 * 1000,

  // Time until auto-logout after warning (5 minutes)
  LOGOUT_TIME: 5 * 60 * 1000,

  // Total idle time before logout (30 minutes)
  TOTAL_IDLE_TIME: 30 * 60 * 1000,

  // Token refresh interval (check every 5 minutes)
  TOKEN_CHECK_INTERVAL: 5 * 60 * 1000,

  // Firebase token expires after 1 hour by default
  TOKEN_EXPIRY_THRESHOLD: 55 * 60 * 1000, // Refresh 5 minutes before expiry
};

/**
 * Session timeout state
 */
export interface SessionTimeoutState {
  /** Whether warning modal should be shown */
  showWarning: boolean;

  /** Time remaining until auto-logout (in seconds) */
  timeRemaining: number;

  /** Whether session is currently active */
  isActive: boolean;

  /** Manually extend session */
  extendSession: () => void;

  /** Manually trigger logout */
  logout: () => void;
}

/**
 * Custom hook for session timeout management
 *
 * Features:
 * - Tracks user activity (mouse, keyboard, touch events)
 * - Shows warning modal 5 minutes before timeout
 * - Auto-logout after 30 minutes of inactivity
 * - Monitors Firebase token expiration
 * - Auto-refreshes token when needed
 *
 * @param enabled - Whether session timeout is enabled (default: true in production)
 * @returns Session timeout state and controls
 */
export function useSessionTimeout(
  enabled: boolean = process.env.NODE_ENV === 'production'
): SessionTimeoutState {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(SESSION_CONFIG.LOGOUT_TIME / 1000);
  const [isActive, setIsActive] = useState(true);

  // Refs for timers (prevent stale closures)
  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clear all timers
   */
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (tokenCheckTimerRef.current) {
      clearInterval(tokenCheckTimerRef.current);
      tokenCheckTimerRef.current = null;
    }
  }, []);

  /**
   * Handle automatic logout
   */
  const handleAutoLogout = useCallback(async () => {
    logger.info('Session timeout - logging out user');
    clearAllTimers();
    setShowWarning(false);
    setIsActive(false);

    try {
      await signOut();
    } catch (error) {
      logger.error('Error during auto-logout', error);
    }
  }, [signOut, clearAllTimers]);

  /**
   * Start countdown timer for warning modal
   */
  const startCountdown = useCallback(() => {
    // Initial time
    setTimeRemaining(SESSION_CONFIG.LOGOUT_TIME / 1000);

    // Update every second
    countdownTimerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /**
   * Show warning modal and start logout timer
   */
  const handleShowWarning = useCallback(() => {
    logger.warn('Session about to timeout - showing warning');
    setShowWarning(true);
    startCountdown();

    // Start logout timer
    logoutTimerRef.current = setTimeout(() => {
      handleAutoLogout();
    }, SESSION_CONFIG.LOGOUT_TIME);
  }, [handleAutoLogout, startCountdown]);

  /**
   * Reset session timers (called on user activity)
   */
  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    clearAllTimers();

    // Reset warning state
    setShowWarning(false);
    setIsActive(true);

    // Set new warning timer
    warningTimerRef.current = setTimeout(() => {
      handleShowWarning();
    }, SESSION_CONFIG.WARNING_TIME);

    logger.debug('Session timers reset');
  }, [handleShowWarning, clearAllTimers]);

  /**
   * Extend session (called when user clicks "Stay Signed In")
   */
  const extendSession = useCallback(() => {
    logger.info('Session extended by user');
    resetTimers();
  }, [resetTimers]);

  /**
   * Manual logout
   */
  const logout = useCallback(async () => {
    logger.info('Manual logout triggered');
    clearAllTimers();
    setShowWarning(false);
    setIsActive(false);

    try {
      await signOut();
    } catch (error) {
      logger.error('Error during manual logout', error);
    }
  }, [signOut, clearAllTimers]);

  /**
   * Check and refresh Firebase token if needed
   */
  const checkTokenExpiration = useCallback(async () => {
    if (!user) return;

    try {
      const idTokenResult = await user.getIdTokenResult();
      const expirationTime = new Date(idTokenResult.expirationTime).getTime();
      const now = Date.now();
      const timeUntilExpiry = expirationTime - now;

      // If token expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < SESSION_CONFIG.TOKEN_EXPIRY_THRESHOLD) {
        logger.info('Token expiring soon, refreshing');
        await user.getIdTokenResult(true); // Force refresh
        logger.info('Token refreshed successfully');
      }
    } catch (error) {
      logger.error('Error checking token expiration', error);
    }
  }, [user]);

  /**
   * Track user activity
   */
  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle activity handler (max once per second)
    let activityThrottleTimer: NodeJS.Timeout | null = null;

    const handleActivity = () => {
      if (activityThrottleTimer) return;

      activityThrottleTimer = setTimeout(() => {
        activityThrottleTimer = null;
      }, 1000);

      // Only reset if not showing warning
      // (if warning is shown, user must click "Stay Signed In")
      if (!showWarning) {
        resetTimers();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize timers
    resetTimers();

    // Start token check interval
    tokenCheckTimerRef.current = setInterval(() => {
      checkTokenExpiration();
    }, SESSION_CONFIG.TOKEN_CHECK_INTERVAL);

    // Initial token check
    checkTokenExpiration();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });

      if (activityThrottleTimer) {
        clearTimeout(activityThrottleTimer);
      }

      clearAllTimers();
    };
  }, [enabled, user, showWarning, resetTimers, checkTokenExpiration, clearAllTimers]);

  /**
   * Monitor visibility change (tab becomes inactive)
   */
  useEffect(() => {
    if (!enabled || !user) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden - continue counting inactivity
        logger.debug('Tab hidden - inactivity continues');
      } else {
        // Tab became visible - check if session is still valid
        logger.debug('Tab visible - checking session validity');

        const inactiveDuration = Date.now() - lastActivityRef.current;

        // If inactive for more than total idle time, logout immediately
        if (inactiveDuration >= SESSION_CONFIG.TOTAL_IDLE_TIME) {
          logger.warn('Session expired while tab was inactive');
          handleAutoLogout();
        }
        // If inactive for more than warning time but less than total, show warning
        else if (inactiveDuration >= SESSION_CONFIG.WARNING_TIME) {
          handleShowWarning();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, user, handleAutoLogout, handleShowWarning]);

  return {
    showWarning,
    timeRemaining,
    isActive,
    extendSession,
    logout,
  };
}

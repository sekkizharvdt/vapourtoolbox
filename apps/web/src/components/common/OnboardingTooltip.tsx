'use client';

/**
 * Onboarding Tooltip System
 *
 * Provides contextual tooltips for onboarding new users.
 * Features:
 * - Dismissible tooltips that remember state
 * - Sequential tours
 * - Contextual help based on user's current location
 * - First-time feature discovery
 */

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import {
  TooltipProps,
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Popper,
  ClickAwayListener,
  Fade,
  Badge,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

/**
 * Tooltip definition
 */
export interface OnboardingTooltipDef {
  id: string;
  title: string;
  content: string;
  placement?: TooltipProps['placement'];
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Module/page this tooltip belongs to */
  module?: string;
  /** Order in a tour sequence */
  tourOrder?: number;
  /** Tour group ID */
  tourId?: string;
}

/**
 * Onboarding context type
 */
interface OnboardingContextType {
  /** Dismissed tooltip IDs */
  dismissedTooltips: Set<string>;
  /** Mark a tooltip as dismissed */
  dismissTooltip: (id: string) => void;
  /** Reset all dismissed tooltips */
  resetTooltips: () => void;
  /** Check if a tooltip has been dismissed */
  isTooltipDismissed: (id: string) => boolean;
  /** Current active tour */
  activeTour: string | null;
  /** Current step in active tour */
  currentTourStep: number;
  /** Start a tour */
  startTour: (tourId: string) => void;
  /** End current tour */
  endTour: () => void;
  /** Go to next step in tour */
  nextStep: () => void;
  /** Go to previous step in tour */
  prevStep: () => void;
  /** Registered tooltips */
  tooltips: Map<string, OnboardingTooltipDef>;
  /** Register a tooltip */
  registerTooltip: (tooltip: OnboardingTooltipDef) => void;
  /** Unregister a tooltip */
  unregisterTooltip: (id: string) => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = 'vapour_dismissed_tooltips';

/**
 * Hook to use onboarding context
 */
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

/**
 * Onboarding Provider Props
 */
interface OnboardingProviderProps {
  children: React.ReactNode;
}

/**
 * Onboarding Provider
 */
export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [dismissedTooltips, setDismissedTooltips] = useState<Set<string>>(new Set());
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [tooltips, setTooltips] = useState<Map<string, OnboardingTooltipDef>>(new Map());

  // Load dismissed tooltips from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setDismissedTooltips(new Set(parsed));
        } catch {
          // Invalid storage, reset
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, []);

  // Save dismissed tooltips to localStorage
  const saveDismissed = useCallback((dismissed: Set<string>) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
    }
  }, []);

  const dismissTooltip = useCallback(
    (id: string) => {
      setDismissedTooltips((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveDismissed(next);
        return next;
      });
    },
    [saveDismissed]
  );

  const resetTooltips = useCallback(() => {
    setDismissedTooltips(new Set());
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const isTooltipDismissed = useCallback(
    (id: string) => dismissedTooltips.has(id),
    [dismissedTooltips]
  );

  const startTour = useCallback((tourId: string) => {
    setActiveTour(tourId);
    setCurrentTourStep(0);
  }, []);

  const endTour = useCallback(() => {
    setActiveTour(null);
    setCurrentTourStep(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentTourStep((prev) => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setCurrentTourStep((prev) => Math.max(0, prev - 1));
  }, []);

  const registerTooltip = useCallback((tooltip: OnboardingTooltipDef) => {
    setTooltips((prev) => {
      const next = new Map(prev);
      next.set(tooltip.id, tooltip);
      return next;
    });
  }, []);

  const unregisterTooltip = useCallback((id: string) => {
    setTooltips((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<OnboardingContextType>(
    () => ({
      dismissedTooltips,
      dismissTooltip,
      resetTooltips,
      isTooltipDismissed,
      activeTour,
      currentTourStep,
      startTour,
      endTour,
      nextStep,
      prevStep,
      tooltips,
      registerTooltip,
      unregisterTooltip,
    }),
    [
      dismissedTooltips,
      dismissTooltip,
      resetTooltips,
      isTooltipDismissed,
      activeTour,
      currentTourStep,
      startTour,
      endTour,
      nextStep,
      prevStep,
      tooltips,
      registerTooltip,
      unregisterTooltip,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/**
 * Onboarding Tooltip Component Props
 */
interface OnboardingTooltipProps {
  id: string;
  title: string;
  content: string;
  children: React.ReactElement;
  placement?: TooltipProps['placement'];
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Show even if dismissed (for help buttons) */
  alwaysShow?: boolean;
  /** Show tooltip on first render */
  showOnMount?: boolean;
  /** Delay before showing (ms) */
  delay?: number;
}

/**
 * Onboarding Tooltip Component
 */
export function OnboardingTooltip({
  id,
  title,
  content,
  children,
  placement = 'bottom',
  action,
  alwaysShow = false,
  showOnMount = false,
  delay = 500,
}: OnboardingTooltipProps) {
  const { isTooltipDismissed, dismissTooltip } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const isDismissed = isTooltipDismissed(id);
  const shouldShow = alwaysShow || !isDismissed;

  // Show on mount after delay
  useEffect(() => {
    if (showOnMount && shouldShow && anchorEl) {
      const timer = setTimeout(() => {
        setOpen(true);
      }, delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showOnMount, shouldShow, anchorEl, delay]);

  const handleClose = () => {
    setOpen(false);
    if (!alwaysShow) {
      dismissTooltip(id);
    }
  };

  const handleAction = () => {
    action?.onClick();
    handleClose();
  };

  if (!shouldShow && !open) {
    return children;
  }

  return (
    <>
      <Box
        component="span"
        ref={setAnchorEl}
        onClick={() => setOpen(true)}
        sx={{ display: 'inline-flex' }}
      >
        {children}
      </Box>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement={placement}
        transition
        sx={{ zIndex: 1500 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={8}
              sx={{
                p: 2,
                maxWidth: 300,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <LightbulbIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
                      {title}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleClose}
                      sx={{ mt: -0.5, mr: -0.5 }}
                      aria-label="Close tooltip"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2 : 0 }}>
                    {content}
                  </Typography>
                  {action && (
                    <Button size="small" variant="contained" onClick={handleAction}>
                      {action.label}
                    </Button>
                  )}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
}

/**
 * Feature Spotlight Component
 * Highlights a new feature with a pulsing indicator
 */
interface FeatureSpotlightProps {
  id: string;
  title: string;
  content: string;
  children: React.ReactElement;
  placement?: TooltipProps['placement'];
  /** Show badge indicator */
  showBadge?: boolean;
}

export function FeatureSpotlight({
  id,
  title,
  content,
  children,
  placement = 'top',
  showBadge = true,
}: FeatureSpotlightProps) {
  const { isTooltipDismissed, dismissTooltip } = useOnboarding();

  const isDismissed = isTooltipDismissed(id);

  const handleClose = () => {
    dismissTooltip(id);
  };

  if (isDismissed) {
    return children;
  }

  return (
    <OnboardingTooltip
      id={id}
      title={title}
      content={content}
      placement={placement}
      action={{ label: 'Got it', onClick: handleClose }}
    >
      {showBadge ? (
        <Badge
          badgeContent={<LightbulbIcon sx={{ fontSize: 12 }} />}
          color="primary"
          overlap="circular"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{
            '& .MuiBadge-badge': {
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)', opacity: 1 },
                '50%': { transform: 'scale(1.1)', opacity: 0.7 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
            },
          }}
        >
          {children}
        </Badge>
      ) : (
        children
      )}
    </OnboardingTooltip>
  );
}

/**
 * Contextual Help Button
 * A small help icon that shows a tooltip when clicked
 */
interface ContextualHelpProps {
  id: string;
  title: string;
  content: string;
  placement?: TooltipProps['placement'];
}

export function ContextualHelp({ id, title, content, placement = 'top' }: ContextualHelpProps) {
  return (
    <OnboardingTooltip id={id} title={title} content={content} placement={placement} alwaysShow>
      <IconButton size="small" sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }} aria-label="Help">
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
    </OnboardingTooltip>
  );
}

/**
 * Tour Step Component
 * Used within a guided tour
 */
interface TourStepProps {
  tourId: string;
  step: number;
  title: string;
  content: string;
  children: React.ReactElement;
  placement?: TooltipProps['placement'];
  totalSteps: number;
}

export function TourStep({
  tourId,
  step,
  title,
  content,
  children,
  placement = 'bottom',
  totalSteps,
}: TourStepProps) {
  const { activeTour, currentTourStep, nextStep, prevStep, endTour } = useOnboarding();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const isActive = activeTour === tourId && currentTourStep === step;

  const handleNext = () => {
    if (currentTourStep < totalSteps - 1) {
      nextStep();
    } else {
      endTour();
    }
  };

  if (!isActive) {
    return children;
  }

  return (
    <>
      <Box
        component="span"
        ref={setAnchorEl}
        sx={{
          display: 'inline-flex',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: -4,
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 1,
            animation: 'pulse 1.5s infinite',
          },
        }}
      >
        {children}
      </Box>

      <Popper open={isActive} anchorEl={anchorEl} placement={placement} sx={{ zIndex: 1500 }}>
        <Paper
          elevation={8}
          sx={{
            p: 2,
            maxWidth: 350,
            borderRadius: 2,
            border: '2px solid',
            borderColor: 'primary.main',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {step + 1} / {totalSteps}
            </Typography>
            <IconButton size="small" onClick={endTour} aria-label="End tour">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {content}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              size="small"
              startIcon={<NavigateBeforeIcon />}
              onClick={prevStep}
              disabled={step === 0}
            >
              Back
            </Button>
            <Button
              size="small"
              variant="contained"
              endIcon={<NavigateNextIcon />}
              onClick={handleNext}
            >
              {step === totalSteps - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </Paper>
      </Popper>
    </>
  );
}

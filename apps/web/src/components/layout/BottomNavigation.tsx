'use client';

/**
 * Mobile Bottom Navigation Component
 *
 * Provides quick access to the most frequently used modules on mobile devices.
 * Hidden on tablet and desktop (md breakpoint and above).
 */

import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  AccessTime as FlowIcon,
  Description as DocsIcon,
  Assignment as ProjectsIcon,
  ShoppingCart as ProcurementIcon,
  MoreHoriz as MoreIcon,
} from '@mui/icons-material';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Flow', icon: <FlowIcon />, path: '/flow' },
  { label: 'Docs', icon: <DocsIcon />, path: '/documents' },
  { label: 'Projects', icon: <ProjectsIcon />, path: '/projects' },
  { label: 'Proc', icon: <ProcurementIcon />, path: '/procurement' },
  { label: 'More', icon: <MoreIcon />, path: null }, // Opens sidebar drawer
];

interface MobileBottomNavProps {
  /** Callback when "More" button is clicked to open sidebar */
  onMoreClick: () => void;
}

/**
 * Mobile bottom navigation bar
 *
 * Features:
 * - Shows 4 most-used modules + "More" button
 * - Highlights current route
 * - Hidden on tablet/desktop (uses sidebar instead)
 * - "More" opens the full sidebar drawer
 */
export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Find which nav item matches current path (-1 if none)
  const currentValue = NAV_ITEMS.findIndex((item) => item.path && pathname.startsWith(item.path));

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    const item = NAV_ITEMS[newValue];
    if (!item) return;
    if (item.path) {
      router.push(item.path);
    } else {
      // "More" button - open sidebar drawer
      onMoreClick();
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: { xs: 'block', md: 'none' },
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: 1,
        borderColor: 'divider',
      }}
      elevation={3}
    >
      <BottomNavigation
        value={currentValue >= 0 ? currentValue : false}
        onChange={handleChange}
        showLabels
        sx={{
          height: 56,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '6px 12px 8px',
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.7rem',
            '&.Mui-selected': {
              fontSize: '0.7rem',
            },
          },
        }}
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction key={item.label} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}

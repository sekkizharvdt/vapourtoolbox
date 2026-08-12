'use client';

/**
 * Flow Sub-navigation
 *
 * The sidebar carries Flow as a single entry with no children, so before this
 * existed the only route to Team Board, Meetings and Portfolio was the hub page
 * of cards at /flow. Now that /flow is My Work, they live here — one click from
 * anywhere in the module instead of a trip back through a menu.
 */

import { usePathname, useRouter } from 'next/navigation';
import { Box, Tabs, Tab } from '@mui/material';
import {
  Assignment as MyWorkIcon,
  Groups as TeamIcon,
  EventNote as MeetingsIcon,
  RateReview as PortfolioIcon,
} from '@mui/icons-material';

const FLOW_TABS = [
  { label: 'My Work', path: '/flow', icon: <MyWorkIcon fontSize="small" /> },
  { label: 'Team', path: '/flow/team', icon: <TeamIcon fontSize="small" /> },
  { label: 'Meetings', path: '/flow/meetings', icon: <MeetingsIcon fontSize="small" /> },
  { label: 'Portfolio', path: '/flow/portfolio', icon: <PortfolioIcon fontSize="small" /> },
] as const;

export function FlowNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Longest matching prefix wins, so /flow/meetings/<id> keeps Meetings active
  // while bare /flow only matches My Work.
  const active =
    [...FLOW_TABS]
      .filter((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`))
      .sort((a, b) => b.path.length - a.path.length)[0]?.path ?? false;

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
      <Tabs value={active} onChange={(_, path: string) => router.push(path)} variant="scrollable">
        {FLOW_TABS.map((tab) => (
          <Tab
            key={tab.path}
            value={tab.path}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

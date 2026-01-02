'use client';

import { useState } from 'react';
import { Typography, Box, Tabs, Tab, IconButton, Breadcrumbs, Link } from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canApproveLeaves } from '@vapour/constants';
import MyLeavesTab from '@/components/hr/leaves/MyLeavesTab';
import TeamRequestsTab from '@/components/hr/leaves/TeamRequestsTab';
import LeaveSummaryTab from '@/components/hr/leaves/LeaveSummaryTab';

type MainTabValue = 'my-leaves' | 'team-requests' | 'summary';

export default function LeavesPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [tab, setTab] = useState<MainTabValue>('my-leaves');
  const [refreshKey, setRefreshKey] = useState(0);

  const permissions2 = claims?.permissions2 ?? 0;
  const hasApproveAccess = canApproveLeaves(permissions2);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/hr"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          HR
        </Link>
        <Typography color="text.primary">Leaves</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Leaves
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage leave requests, view balances, and track team leave usage
          </Typography>
        </Box>
        <IconButton onClick={handleRefresh} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab label="My Leaves" value="my-leaves" />
          {hasApproveAccess && <Tab label="Team Requests" value="team-requests" />}
          {hasApproveAccess && <Tab label="Leave Summary" value="summary" />}
        </Tabs>
      </Box>

      {tab === 'my-leaves' && <MyLeavesTab key={refreshKey} />}
      {tab === 'team-requests' && hasApproveAccess && <TeamRequestsTab key={refreshKey} />}
      {tab === 'summary' && hasApproveAccess && <LeaveSummaryTab key={refreshKey} />}
    </>
  );
}

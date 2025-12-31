'use client';

/**
 * Admin HR Setup Page
 *
 * Admin-only page for HR configuration:
 * - Leave Types: Configure leave types, quotas, and policies
 * - Leave Balances: View and initialize user leave balances
 */

import { useState } from 'react';
import { Box, Container, Typography, Tabs, Tab, Breadcrumbs, Link } from '@mui/material';
import {
  Home as HomeIcon,
  EventNote as LeaveTypesIcon,
  AccountBalance as BalancesIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import LeaveTypesTab from './components/LeaveTypesTab';
import LeaveBalancesTab from './components/LeaveBalancesTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`hr-setup-tabpanel-${index}`}
      aria-labelledby={`hr-setup-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `hr-setup-tab-${index}`,
    'aria-controls': `hr-setup-tabpanel-${index}`,
  };
}

export default function HRSetupPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [tabValue, setTabValue] = useState(0);

  const permissions = claims?.permissions ?? 0;
  const hasAdminAccess = hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!hasAdminAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            HR Setup
          </Typography>
          <Typography color="error">
            You do not have permission to access HR setup. Admin access required.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/admin"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/admin');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Admin
        </Link>
        <Typography color="text.primary">HR Setup</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          HR Setup
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure leave types, quotas, and manage employee leave balances
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="HR setup tabs">
          <Tab
            icon={<LeaveTypesIcon />}
            iconPosition="start"
            label="Leave Types"
            {...a11yProps(0)}
          />
          <Tab
            icon={<BalancesIcon />}
            iconPosition="start"
            label="Leave Balances"
            {...a11yProps(1)}
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <LeaveTypesTab />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <LeaveBalancesTab />
      </TabPanel>
    </Container>
  );
}

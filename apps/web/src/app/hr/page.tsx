'use client';

import { Typography, Box, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import {
  EventNote as LeaveIcon,
  CalendarMonth as CalendarIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Flight as TravelIcon,
  Celebration as HolidayIcon,
  Assessment as SummaryIcon,
  People as PeopleIcon,
  WorkOutline as OnDutyIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canManageHRSettings, canApproveLeaves } from '@vapour/constants';

interface HRModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
  requiresPermission?: (permissions2: number) => boolean;
}

export default function HRPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // HR is open to all users for basic functions
  // Advanced functions check permissions via requiresPermission
  const permissions2 = claims?.permissions2 ?? 0;

  const modules: HRModule[] = [
    {
      title: 'My Leaves',
      description: 'View your leave balance, history, and apply for new leave',
      icon: <HistoryIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/leaves/my-leaves',
    },
    {
      title: 'On-Duty Requests',
      description: 'Apply to work on holidays and earn compensatory leave',
      icon: <OnDutyIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/hr/on-duty/my-requests',
    },
    {
      title: 'Leave Requests',
      description: 'Review and approve/reject team leave requests',
      icon: <LeaveIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/leaves',
      requiresPermission: canApproveLeaves,
    },
    {
      title: 'Travel Expenses',
      description: 'Submit travel expense reports and track reimbursements',
      icon: <TravelIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/travel-expenses',
    },
    {
      title: 'Team Calendar',
      description: 'View team leave calendar and plan resource availability',
      icon: <CalendarIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/leaves/calendar',
    },
    {
      title: 'Leave Settings',
      description: 'Configure leave types, quotas, and policies',
      icon: <SettingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/hr-setup',
      requiresPermission: canManageHRSettings,
    },
    {
      title: 'Holiday Settings',
      description: 'Manage company holidays (Diwali, Pongal, etc.)',
      icon: <HolidayIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/hr/settings/holidays',
      requiresPermission: canManageHRSettings,
    },
    {
      title: 'Leave Summary',
      description: 'View leave balances and usage for all employees',
      icon: <SummaryIcon sx={{ fontSize: 48, color: 'info.main' }} />,
      path: '/hr/settings/leave-summary',
      requiresPermission: canApproveLeaves,
    },
    {
      title: 'Employee Directory',
      description: 'View employee details, emergency contacts, and blood groups',
      icon: <PeopleIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/hr/employees',
    },
  ];

  // Filter modules based on permissions
  const accessibleModules = modules.filter((module) => {
    if (!module.requiresPermission) return true;
    return module.requiresPermission(permissions2);
  });

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          HR & Leave Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage leave requests, balances, and HR settings
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {accessibleModules.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                ...(module.comingSoon && {
                  opacity: 0.7,
                  backgroundColor: 'action.hover',
                }),
              }}
            >
              {module.comingSoon && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}
                >
                  Coming Soon
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{module.icon}</Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => router.push(module.path)}
                  disabled={module.comingSoon}
                >
                  {module.comingSoon ? 'Coming Soon' : 'Open'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

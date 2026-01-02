'use client';

import { Typography, Box, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import {
  EventNote as LeaveIcon,
  CalendarMonth as CalendarIcon,
  Flight as TravelIcon,
  Celebration as HolidayIcon,
  People as PeopleIcon,
  WorkOutline as OnDutyIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

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

  const modules: HRModule[] = [
    {
      title: 'Leaves',
      description: 'Manage leave requests, view balances, and track team leave usage',
      icon: <LeaveIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/leaves',
    },
    {
      title: 'On-Duty Requests',
      description: 'Apply to work on holidays and earn compensatory leave',
      icon: <OnDutyIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/hr/on-duty/my-requests',
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
      title: 'Holidays',
      description: 'View company holidays for the current year',
      icon: <HolidayIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/hr/holidays',
    },
    {
      title: 'Employee Directory',
      description: 'View employee details, emergency contacts, and blood groups',
      icon: <PeopleIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/hr/employees',
    },
  ];

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
        {modules.map((module) => (
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

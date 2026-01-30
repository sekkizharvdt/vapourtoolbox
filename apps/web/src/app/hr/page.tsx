'use client';

import {
  EventNote as LeaveIcon,
  CalendarMonth as CalendarIcon,
  Flight as TravelIcon,
  Celebration as HolidayIcon,
  People as PeopleIcon,
  WorkOutline as OnDutyIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canApproveLeaves } from '@vapour/constants';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

export default function HRPage() {
  const { claims } = useAuth();
  const permissions2 = claims?.permissions2 ?? 0;
  const hasApproveAccess = canApproveLeaves(permissions2);

  const allModules: (ModuleItem & { requiresApproveLeaves?: boolean })[] = [
    {
      id: 'leaves',
      title: 'Leaves',
      description: 'Manage leave requests, view balances, and track team leave usage',
      icon: <LeaveIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/leaves',
    },
    {
      id: 'on-duty',
      title: 'On-Duty Requests',
      description: 'Apply to work on holidays and earn compensatory leave',
      icon: <OnDutyIcon sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/hr/on-duty/my-requests',
    },
    {
      id: 'travel-expenses',
      title: 'Travel Expenses',
      description: 'Submit travel expense reports and track reimbursements',
      icon: <TravelIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/travel-expenses',
    },
    {
      id: 'team-calendar',
      title: 'Team Calendar',
      description: 'View team leave calendar and plan resource availability',
      icon: <CalendarIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/hr/leaves/calendar',
      requiresApproveLeaves: true,
    },
    {
      id: 'holidays',
      title: 'Holidays',
      description: 'View company holidays for the current year',
      icon: <HolidayIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/hr/holidays',
    },
    {
      id: 'employees',
      title: 'Employee Directory',
      description: 'View employee details, emergency contacts, and blood groups',
      icon: <PeopleIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/hr/employees',
    },
  ];

  // Filter modules based on user permissions
  const visibleModules = allModules.filter((module) => {
    if (module.requiresApproveLeaves && !hasApproveAccess) {
      return false;
    }
    return true;
  });

  return (
    <ModuleLandingPage
      title="HR & Leave Management"
      description="Manage leave requests, balances, and HR settings"
      items={visibleModules}
      newAction={{
        label: 'Apply Leave',
        path: '/hr/leaves/new',
      }}
    />
  );
}

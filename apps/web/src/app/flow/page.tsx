'use client';

/**
 * Flow Module - Hub Dashboard
 *
 * Card-based navigation organized by workflow sections:
 * - Daily Work: Tasks and system notifications
 * - Collaboration: Team board and meeting minutes
 */

import {
  CheckCircle as TasksIcon,
  Inbox as InboxIcon,
  Groups as TeamIcon,
  EventNote as MeetingsIcon,
} from '@mui/icons-material';
import { ModuleLandingPage, type ModuleSection } from '@/components/modules';

export default function FlowPage() {
  const sections: ModuleSection[] = [
    {
      id: 'daily-work',
      title: 'Daily Work',
      description: 'Your tasks and system notifications in one place',
      items: [
        {
          id: 'tasks',
          title: 'My Tasks',
          description: 'View and manage your personal task list',
          icon: <TasksIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
          path: '/flow/tasks',
        },
        {
          id: 'inbox',
          title: 'Inbox',
          description: 'System notifications from procurement, documents, HR, and more',
          icon: <InboxIcon sx={{ fontSize: 48, color: 'info.main' }} />,
          path: '/flow/inbox',
        },
      ],
    },
    {
      id: 'collaboration',
      title: 'Collaboration',
      description: 'Team visibility and meeting management',
      items: [
        {
          id: 'team',
          title: 'Team Board',
          description: 'See what everyone on the team is working on',
          icon: <TeamIcon sx={{ fontSize: 48, color: 'success.main' }} />,
          path: '/flow/team',
        },
        {
          id: 'meetings',
          title: 'Meeting Minutes',
          description: 'Record meetings and auto-generate action items as tasks',
          icon: <MeetingsIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
          path: '/flow/meetings',
        },
      ],
    },
  ];

  return (
    <ModuleLandingPage
      title="Flow"
      description="Tasks, notifications, and team collaboration"
      sections={sections}
      newAction={{
        label: 'New Task',
        path: '/flow/tasks?new=true',
      }}
    />
  );
}

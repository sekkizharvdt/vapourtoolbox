'use client';

/**
 * Flow Section
 *
 * Documentation for the Flow module - tasks, inbox, team board, and meeting minutes.
 */

import { Box, Typography, Alert, Divider } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InboxIcon from '@mui/icons-material/Inbox';
import GroupsIcon from '@mui/icons-material/Groups';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { FeatureCard, StepGuide } from './helpers';

export function FlowSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Flow is your unified task and collaboration hub. It brings together your tasks, approvals,
        team visibility, and meeting minutes in one place. Tasks are created automatically when
        actions are needed across the system.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Key Features
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <FeatureCard
          icon={<AssignmentIcon color="primary" />}
          title="My Tasks"
          description="View all tasks assigned to you with filter chips (All, Pending, Completed). Click any task to take action directly."
        />
        <FeatureCard
          icon={<InboxIcon color="primary" />}
          title="Inbox"
          description="All actionable notifications — approvals, mentions, and assignments in one place."
        />
        <FeatureCard
          icon={<GroupsIcon color="primary" />}
          title="Team Board"
          description="See team members and their current tasks at a glance. Quickly check workload distribution."
        />
        <FeatureCard
          icon={<EventNoteIcon color="primary" />}
          title="Meeting Minutes"
          description="Create and manage meeting minutes with action items, responsible persons, and due dates."
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        How Tasks Work
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Task Appears in My Tasks',
            description:
              'When someone submits a leave request, expense report, or any item needing your action, a task is automatically created and assigned to you.',
          },
          {
            title: 'Click to Take Action',
            description:
              'Click the task card to navigate directly to the page where you can approve, review, or complete the action.',
          },
          {
            title: 'Task Auto-Completes',
            description:
              'Once you take the action (approve, reject, etc.), the task is automatically marked as complete.',
          },
        ]}
      />

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Tip:</strong> Use the filter chips on My Tasks to quickly switch between All,
          Pending, and Completed tasks. The default view shows tasks assigned to you.
        </Typography>
      </Alert>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Meeting Minutes
      </Typography>
      <Typography variant="body2" paragraph>
        Meeting Minutes follow a two-step workflow:
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Create Meeting',
            description:
              'Start a new meeting by entering the title, date, and attendees. Add agenda items and discussion points.',
          },
          {
            title: 'Add Action Items',
            description:
              'Record action items with descriptions, responsible persons, and due dates in a table format.',
          },
          {
            title: 'Finalize',
            description:
              'Finalize the meeting to lock it and automatically create tasks for each action item assigned to team members.',
          },
        ]}
      />
    </Box>
  );
}

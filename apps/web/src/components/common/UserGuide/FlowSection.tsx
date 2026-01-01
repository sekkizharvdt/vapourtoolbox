'use client';

/**
 * Flow Section
 *
 * Documentation for the Flow module - task inbox and notifications.
 */

import { Box, Typography, Alert, Divider } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CategoryIcon from '@mui/icons-material/Category';
import { FeatureCard, StepGuide } from './helpers';

export function FlowSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Flow is your unified task inbox. It shows all pending tasks, approvals, and notifications
        organized by project and category. Tasks are created automatically when actions are needed
        across the system.
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
          title="Action-Oriented Tasks"
          description="Click any task to go directly to where you can take action. Tasks auto-complete when the action is performed."
        />
        <FeatureCard
          icon={<CategoryIcon color="primary" />}
          title="Channel Organization"
          description="Tasks are organized into channels: Approvals, HR, Procurement, and more. Filter by what matters to you."
        />
        <FeatureCard
          icon={<NotificationsActiveIcon color="primary" />}
          title="Real-time Updates"
          description="Tasks appear instantly when someone needs your action. No refresh needed."
        />
        <FeatureCard
          icon={<CheckCircleIcon color="success" />}
          title="Auto-Completion"
          description="Most tasks complete automatically when you take action on the linked page."
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        How Tasks Work
      </Typography>
      <StepGuide
        steps={[
          {
            title: 'Task Appears in Flow',
            description:
              'When someone submits a leave request, expense report, or any item needing your action, a task is created.',
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
          <strong>Tip:</strong> The &quot;Action Required&quot; chip indicates tasks waiting for
          your action. Click anywhere on the task card to go to the action page.
        </Typography>
      </Alert>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Task Channels
      </Typography>
      <Typography variant="body2" paragraph>
        Tasks are organized into channels based on their type:
      </Typography>
      <Box component="ul" sx={{ pl: 3, mt: 0 }}>
        <li>
          <Typography variant="body2">
            <strong>Approvals</strong> - Leave requests, expense approvals, PO approvals
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>HR</strong> - Leave and expense related tasks
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Procurement</strong> - Purchase requests, RFQs, goods receipts
          </Typography>
        </li>
        <li>
          <Typography variant="body2">
            <strong>Accounting</strong> - Invoice approvals, payment tasks
          </Typography>
        </li>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Mentions
      </Typography>
      <Typography variant="body2" paragraph>
        Use @username to mention team members in messages. They&apos;ll receive a notification and
        can view their mentions in the Flow module.
      </Typography>
    </Box>
  );
}

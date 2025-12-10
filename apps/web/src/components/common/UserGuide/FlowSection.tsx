'use client';

/**
 * Flow Section
 */

import { Box, Typography, Alert } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import { FeatureCard } from './helpers';

export function FlowSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Flow is your task management and communication hub. It combines project tasks, team
        messaging, and time tracking in one place.
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
          title="Task Management"
          description="Create, assign, and track tasks. Set priorities, due dates, and dependencies."
        />
        <FeatureCard
          icon={<PeopleIcon color="primary" />}
          title="Team Channels"
          description="Communicate with your team in project or topic-based channels."
        />
      </Box>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Mentions
      </Typography>
      <Typography variant="body2" paragraph>
        Use @username to mention team members in messages. They&apos;ll receive a notification and
        the mention will appear in their &quot;Today&apos;s Focus&quot; on the dashboard.
      </Typography>

      <Alert severity="info">
        <Typography variant="body2">
          Click the &quot;Unread Mentions&quot; card on your dashboard to quickly see all messages
          where you&apos;ve been mentioned.
        </Typography>
      </Alert>
    </Box>
  );
}

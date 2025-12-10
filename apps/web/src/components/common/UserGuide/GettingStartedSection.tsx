'use client';

/**
 * Getting Started Section
 */

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Alert } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { FeatureCard } from './helpers';

export function GettingStartedSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Welcome to Vapour Toolbox! This guide will help you navigate the application and make the
        most of its features.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Quick Start
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <FeatureCard
          icon={<DashboardIcon color="primary" />}
          title="Dashboard"
          description="View your tasks, approvals, and activity at a glance. Your daily focus items appear here."
        />
        <FeatureCard
          icon={<SearchIcon color="primary" />}
          title="Command Palette"
          description="Press ⌘K (or Ctrl+K) to quickly navigate anywhere or perform actions."
        />
        <FeatureCard
          icon={<KeyboardIcon color="primary" />}
          title="Keyboard Shortcuts"
          description="Press Shift+? to see all available keyboard shortcuts for faster navigation."
        />
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Pro Tip:</strong> Use the command palette (⌘K) to quickly search for anything -
          pages, projects, proposals, or actions.
        </Typography>
      </Alert>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Navigation
      </Typography>

      <Typography variant="body2" paragraph>
        The sidebar on the left provides access to all modules. You can collapse it by clicking the
        toggle button to get more screen space. Your sidebar preference is saved automatically.
      </Typography>

      <List dense>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Click any module icon to navigate" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Use keyboard shortcuts for quick access (G then D for Dashboard)" />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <CheckCircleIcon color="success" fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="The notification bell shows unread notifications" />
        </ListItem>
      </List>
    </Box>
  );
}

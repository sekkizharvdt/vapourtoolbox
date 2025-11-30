'use client';

/**
 * ChannelHeader Component
 *
 * Header for the channel view showing:
 * - Channel name and icon
 * - Workspace/project context
 * - Search/filter options
 */

import { memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Menu as MenuIcon,
  Tag as HashIcon,
} from '@mui/icons-material';
import type { DefaultTaskChannelId } from '@vapour/types';
import { TASK_CHANNEL_DEFINITIONS } from '@vapour/types';
import { channelIcons, viewIcons } from './channelIcons';

interface ChannelHeaderProps {
  workspaceName: string;
  channelId?: DefaultTaskChannelId;
  view: 'channel' | 'my-tasks' | 'mentions';
  taskCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const ChannelHeader = memo(function ChannelHeader({
  workspaceName,
  channelId,
  view,
  taskCount,
  searchQuery,
  onSearchChange,
  onToggleSidebar,
  showSidebarToggle = false,
}: ChannelHeaderProps) {
  // Get channel info
  const channel = channelId ? TASK_CHANNEL_DEFINITIONS[channelId] : null;

  // Determine title and icon based on view
  let title: string;
  let icon: React.ReactNode;
  let description: string | undefined;

  if (view === 'my-tasks') {
    title = 'My Tasks';
    icon = viewIcons.myTasksLarge;
    description = 'All tasks assigned to you across all projects';
  } else if (view === 'mentions') {
    title = '@Mentions';
    icon = viewIcons.mentionsLarge;
    description = 'Messages where you were mentioned';
  } else if (channel) {
    title = `#${channel.name.toLowerCase()}`;
    icon = channelIcons[channel.icon] || <HashIcon />;
    description = channel.description;
  } else {
    title = 'Tasks';
    icon = <HashIcon />;
  }

  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        {/* Sidebar Toggle (mobile) */}
        {showSidebarToggle && onToggleSidebar && (
          <IconButton onClick={onToggleSidebar} edge="start" sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        )}

        {/* Channel Icon */}
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>

        {/* Title and Context */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" fontWeight={600} noWrap>
              {title}
            </Typography>
            {view === 'channel' && (
              <Typography variant="body2" color="text.secondary" noWrap>
                — {workspaceName}
              </Typography>
            )}
          </Stack>
          {description && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {description}
            </Typography>
          )}
        </Box>

        {/* Task Count */}
        <Chip
          label={`${taskCount} task${taskCount !== 1 ? 's' : ''}`}
          size="small"
          variant="outlined"
        />

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ width: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Filter Button (placeholder for future) */}
        <Tooltip title="Filter tasks">
          <IconButton size="small">
            <FilterIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
});

export default ChannelHeader;

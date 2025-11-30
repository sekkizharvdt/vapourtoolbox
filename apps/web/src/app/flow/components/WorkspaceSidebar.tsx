'use client';

/**
 * WorkspaceSidebar Component
 *
 * Slack-like sidebar showing project workspaces and their channels
 * - Project workspaces (collapsible)
 * - Pre-Sales workspace for proposals/enquiries
 * - My Tasks quick filter
 * - Unread counts per channel
 */

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Badge,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Tag as HashIcon,
  Folder as FolderIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type {
  TaskWorkspace,
  TaskChannel,
  TaskNotification,
  DefaultTaskChannelId,
} from '@vapour/types';
import { getChannelUnreadCounts } from '@/lib/tasks/channelService';
import { channelIconsSmall, viewIcons } from './channelIcons';

interface WorkspaceSidebarProps {
  workspaces: TaskWorkspace[];
  selectedWorkspaceId: string | null;
  selectedChannelId: DefaultTaskChannelId | null;
  selectedView: 'channel' | 'my-tasks' | 'mentions';
  tasksByWorkspace: Record<string, TaskNotification[]>;
  onSelectChannel: (workspaceId: string, channelId: DefaultTaskChannelId) => void;
  onSelectMyTasks: () => void;
  onSelectMentions: () => void;
  onClose?: () => void;
  mentionsCount?: number;
  myTasksCount?: number;
}

// Memoized channel item component
const ChannelItem = memo(function ChannelItem({
  channel,
  selected,
  unreadCount,
  onClick,
}: {
  channel: TaskChannel;
  selected: boolean;
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <ListItem disablePadding sx={{ pl: 2 }}>
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{
          borderRadius: 1,
          py: 0.5,
          minHeight: 32,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              bgcolor: 'primary.dark',
            },
            '& .MuiListItemIcon-root': {
              color: 'primary.contrastText',
            },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
          {channelIconsSmall[channel.icon] || <HashIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText
          primary={channel.name}
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: unreadCount > 0 ? 600 : 400,
            noWrap: true,
          }}
        />
        {unreadCount > 0 && (
          <Badge badgeContent={unreadCount} color="error" max={99} sx={{ mr: 1 }} />
        )}
      </ListItemButton>
    </ListItem>
  );
});

// Memoized workspace section component
const WorkspaceSection = memo(function WorkspaceSection({
  workspace,
  expanded,
  selectedChannelId,
  unreadCounts,
  onToggle,
  onSelectChannel,
}: {
  workspace: TaskWorkspace;
  expanded: boolean;
  selectedChannelId: DefaultTaskChannelId | null;
  unreadCounts: Record<string, number>;
  onToggle: () => void;
  onSelectChannel: (channelId: DefaultTaskChannelId) => void;
}) {
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton onClick={onToggle} sx={{ py: 1 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <FolderIcon
              fontSize="small"
              color={workspace.type === 'pre-sales' ? 'secondary' : 'primary'}
            />
          </ListItemIcon>
          <ListItemText
            primary={workspace.name}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: 600,
              noWrap: true,
            }}
          />
          {!expanded && totalUnread > 0 && (
            <Badge badgeContent={totalUnread} color="error" max={99} sx={{ mr: 1 }} />
          )}
        </ListItemButton>
      </ListItem>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {workspace.channels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              selected={selectedChannelId === channel.id}
              unreadCount={unreadCounts[channel.id] || 0}
              onClick={() => onSelectChannel(channel.id as DefaultTaskChannelId)}
            />
          ))}
        </List>
      </Collapse>
    </>
  );
});

export const WorkspaceSidebar = memo(function WorkspaceSidebar({
  workspaces,
  selectedWorkspaceId,
  selectedChannelId,
  selectedView,
  tasksByWorkspace,
  onSelectChannel,
  onSelectMyTasks,
  onSelectMentions,
  onClose,
  mentionsCount = 0,
  myTasksCount = 0,
}: WorkspaceSidebarProps) {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());

  // Auto-expand selected workspace
  useEffect(() => {
    if (selectedWorkspaceId) {
      setExpandedWorkspaces((prev) => new Set(prev).add(selectedWorkspaceId));
    }
  }, [selectedWorkspaceId]);

  // Toggle workspace expansion
  const handleToggleWorkspace = useCallback((workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }, []);

  // Calculate unread counts per workspace
  const workspaceUnreadCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};

    workspaces.forEach((workspace) => {
      const tasks = tasksByWorkspace[workspace.id] || [];
      counts[workspace.id] = getChannelUnreadCounts(tasks, workspace.channels);
    });

    return counts;
  }, [workspaces, tasksByWorkspace]);

  return (
    <Box
      sx={{
        width: 260,
        height: '100%',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Tasks
        </Typography>
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Quick Filters */}
      <List dense>
        {/* My Tasks */}
        <ListItem disablePadding>
          <ListItemButton
            selected={selectedView === 'my-tasks'}
            onClick={onSelectMyTasks}
            sx={{
              borderRadius: 1,
              mx: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{viewIcons.myTasks}</ListItemIcon>
            <ListItemText
              primary="My Tasks"
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: myTasksCount > 0 ? 600 : 400,
              }}
            />
            {myTasksCount > 0 && <Badge badgeContent={myTasksCount} color="primary" max={99} />}
          </ListItemButton>
        </ListItem>

        {/* @Mentions (placeholder for Phase C) */}
        <ListItem disablePadding>
          <ListItemButton
            selected={selectedView === 'mentions'}
            onClick={onSelectMentions}
            sx={{
              borderRadius: 1,
              mx: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{viewIcons.mentions}</ListItemIcon>
            <ListItemText
              primary="@Mentions"
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: mentionsCount > 0 ? 600 : 400,
              }}
            />
            {mentionsCount > 0 && <Badge badgeContent={mentionsCount} color="error" max={99} />}
          </ListItemButton>
        </ListItem>
      </List>

      <Divider sx={{ my: 1 }} />

      {/* Workspaces */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, py: 1, display: 'block', fontWeight: 600 }}
        >
          WORKSPACES
        </Typography>
        <List dense>
          {workspaces.map((workspace) => (
            <WorkspaceSection
              key={workspace.id}
              workspace={workspace}
              expanded={expandedWorkspaces.has(workspace.id)}
              selectedChannelId={selectedWorkspaceId === workspace.id ? selectedChannelId : null}
              unreadCounts={workspaceUnreadCounts[workspace.id] || {}}
              onToggle={() => handleToggleWorkspace(workspace.id)}
              onSelectChannel={(channelId) => onSelectChannel(workspace.id, channelId)}
            />
          ))}
        </List>
      </Box>
    </Box>
  );
});

export default WorkspaceSidebar;

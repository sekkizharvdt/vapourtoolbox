'use client';

/**
 * Task Notification Bell Component
 *
 * Bell icon with badge showing unread count
 * Opens dropdown/panel with recent task notifications
 */

import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  Chip,
  Stack,
  Button,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { TaskNotification } from '@vapour/types';

interface TaskNotificationBellProps {
  unreadCount: number;
  recentNotifications: TaskNotification[];
  onMarkAllRead?: () => void;
  onNotificationClick?: (notification: TaskNotification) => void;
}

export default function TaskNotificationBell({
  unreadCount,
  recentNotifications,
  onMarkAllRead,
  onNotificationClick,
}: TaskNotificationBellProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: TaskNotification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    handleClose();
    router.push(notification.linkUrl);
  };

  const handleViewAll = () => {
    handleClose();
    router.push('/tasks');
  };

  const handleMarkAllRead = () => {
    if (onMarkAllRead) {
      onMarkAllRead();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
      default:
        return 'default';
    }
  };

  const getStatusIcon = (notification: TaskNotification) => {
    if (notification.status === 'completed') {
      return <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />;
    }
    if (notification.status === 'in_progress') {
      return <ScheduleIcon sx={{ fontSize: 16, color: 'primary.main' }} />;
    }
    if (!notification.read) {
      return <CircleIcon sx={{ fontSize: 10, color: 'primary.main' }} />;
    }
    return null;
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label="task notifications"
        aria-controls={open ? 'notification-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        id="notification-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 600,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Header */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Button size="small" onClick={handleMarkAllRead}>
                Mark all read
              </Button>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Notification List */}
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {recentNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            recentNotifications.map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  whiteSpace: 'normal',
                  alignItems: 'flex-start',
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: notification.read ? 'transparent' : 'action.hover',
                  '&:hover': {
                    backgroundColor: notification.read ? 'action.hover' : 'action.selected',
                  },
                }}
              >
                <Stack spacing={1} sx={{ width: '100%' }}>
                  {/* Title and Status */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getStatusIcon(notification)}
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: notification.read ? 400 : 600,
                        flexGrow: 1,
                      }}
                    >
                      {notification.title}
                    </Typography>
                  </Stack>

                  {/* Message */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {notification.message}
                  </Typography>

                  {/* Priority and Type */}
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={notification.priority}
                      size="small"
                      color={getPriorityColor(notification.priority) as any}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={notification.type}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Stack>

                  {/* Time - if we add createdAt formatting */}
                  <Typography variant="caption" color="text.secondary">
                    {notification.createdAt
                      ? new Date(notification.createdAt.toMillis()).toLocaleString()
                      : ''}
                  </Typography>
                </Stack>
              </MenuItem>
            ))
          )}
        </Box>

        <Divider />

        {/* Footer */}
        <Box sx={{ p: 1 }}>
          <Button fullWidth onClick={handleViewAll}>
            View All Notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
}

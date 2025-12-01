'use client';

/**
 * Notification Center Component
 *
 * A comprehensive notification center with:
 * - Real-time notifications
 * - Digest settings
 * - Notification grouping
 * - Mark all as read
 * - Filter by type
 */

import { useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Badge,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Button,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  Stack,
  Skeleton,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

/**
 * Notification item structure
 */
export interface Notification {
  id: string;
  type: 'task' | 'mention' | 'approval' | 'document' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

/**
 * Digest settings
 */
export interface DigestSettings {
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM format
  quietHoursEnd: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

interface NotificationCenterProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading?: boolean;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notification: Notification) => void;
  digestSettings?: DigestSettings;
  onDigestSettingsChange?: (settings: DigestSettings) => void;
}

const defaultDigestSettings: DigestSettings = {
  enabled: false,
  frequency: 'immediate',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  emailNotifications: true,
  pushNotifications: false,
};

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: Notification['type']) {
  const iconMap = {
    task: <AssignmentIcon />,
    mention: <AlternateEmailIcon />,
    approval: <ShoppingCartIcon />,
    document: <DescriptionIcon />,
    system: <NotificationsIcon />,
  };
  return iconMap[type];
}

/**
 * Notification Item Component
 */
function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  return (
    <ListItem disablePadding>
      <ListItemButton
        onClick={onClick}
        sx={{
          bgcolor: notification.read ? 'transparent' : 'action.hover',
          '&:hover': {
            bgcolor: notification.read ? 'action.hover' : 'action.selected',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>{getNotificationIcon(notification.type)}</ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="body2"
                fontWeight={notification.read ? 400 : 600}
                sx={{ flexGrow: 1 }}
              >
                {notification.title}
              </Typography>
              {!notification.read && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                  }}
                />
              )}
            </Box>
          }
          secondary={
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {notification.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
              </Typography>
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Digest Settings Panel
 */
function DigestSettingsPanel({
  settings,
  onChange,
}: {
  settings: DigestSettings;
  onChange: (settings: DigestSettings) => void;
}) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Notification Preferences
      </Typography>

      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enabled}
              onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
              size="small"
            />
          }
          label="Enable digest mode"
        />

        {settings.enabled && (
          <Box sx={{ pl: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Notification Frequency
            </Typography>
            <Stack direction="row" spacing={1}>
              {(['immediate', 'hourly', 'daily', 'weekly'] as const).map((freq) => (
                <Chip
                  key={freq}
                  label={freq.charAt(0).toUpperCase() + freq.slice(1)}
                  size="small"
                  variant={settings.frequency === freq ? 'filled' : 'outlined'}
                  onClick={() => onChange({ ...settings, frequency: freq })}
                  color={settings.frequency === freq ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Divider />

        <FormControlLabel
          control={
            <Switch
              checked={settings.quietHoursEnabled}
              onChange={(e) => onChange({ ...settings, quietHoursEnabled: e.target.checked })}
              size="small"
            />
          }
          label="Quiet hours"
        />

        {settings.quietHoursEnabled && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
            No notifications between {settings.quietHoursStart} - {settings.quietHoursEnd}
          </Typography>
        )}

        <Divider />

        <FormControlLabel
          control={
            <Switch
              checked={settings.emailNotifications}
              onChange={(e) => onChange({ ...settings, emailNotifications: e.target.checked })}
              size="small"
            />
          }
          label="Email notifications"
        />

        <FormControlLabel
          control={
            <Switch
              checked={settings.pushNotifications}
              onChange={(e) => onChange({ ...settings, pushNotifications: e.target.checked })}
              size="small"
            />
          }
          label="Push notifications"
        />
      </Stack>
    </Box>
  );
}

/**
 * Main Notification Center Component
 */
export function NotificationCenter({
  notifications,
  unreadCount,
  isLoading = false,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  digestSettings = defaultDigestSettings,
  onDigestSettingsChange,
}: NotificationCenterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Notification['type'] | 'all'>('all');

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter((n) => n.type === typeFilter);
    }

    // Filter by tab (all vs unread)
    if (activeTab === 1) {
      filtered = filtered.filter((n) => !n.read);
    }

    return filtered;
  }, [notifications, typeFilter, activeTab]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { today: Notification[]; yesterday: Notification[]; older: Notification[] } = {
      today: [],
      yesterday: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filteredNotifications.forEach((n) => {
      const notifDate = new Date(n.timestamp);
      if (notifDate >= today) {
        groups.today.push(n);
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(n);
      } else {
        groups.older.push(n);
      }
    });

    return groups;
  }, [filteredNotifications]);

  const handleNotificationClick = (notification: Notification) => {
    onMarkAsRead?.(notification.id);
    onNotificationClick?.(notification);
    if (notification.link) {
      router.push(notification.link);
    }
    setOpen(false);
  };

  const handleMarkAllAsRead = () => {
    onMarkAllAsRead?.();
  };

  return (
    <>
      {/* Notification Bell Button */}
      <Tooltip title="Notifications">
        <IconButton color="inherit" onClick={() => setOpen(true)}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notification Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 400 } },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6">Notifications</Typography>
          <Box>
            <Tooltip title="Filter">
              <IconButton size="small" onClick={(e) => setFilterAnchor(e.currentTarget)}>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Filter Menu */}
        <Menu
          anchorEl={filterAnchor}
          open={Boolean(filterAnchor)}
          onClose={() => setFilterAnchor(null)}
        >
          <MenuItem
            selected={typeFilter === 'all'}
            onClick={() => {
              setTypeFilter('all');
              setFilterAnchor(null);
            }}
          >
            All
          </MenuItem>
          <MenuItem
            selected={typeFilter === 'task'}
            onClick={() => {
              setTypeFilter('task');
              setFilterAnchor(null);
            }}
          >
            Tasks
          </MenuItem>
          <MenuItem
            selected={typeFilter === 'mention'}
            onClick={() => {
              setTypeFilter('mention');
              setFilterAnchor(null);
            }}
          >
            Mentions
          </MenuItem>
          <MenuItem
            selected={typeFilter === 'approval'}
            onClick={() => {
              setTypeFilter('approval');
              setFilterAnchor(null);
            }}
          >
            Approvals
          </MenuItem>
          <MenuItem
            selected={typeFilter === 'document'}
            onClick={() => {
              setTypeFilter('document');
              setFilterAnchor(null);
            }}
          >
            Documents
          </MenuItem>
        </Menu>

        {/* Settings Panel */}
        {showSettings && onDigestSettingsChange && (
          <>
            <DigestSettingsPanel settings={digestSettings} onChange={onDigestSettingsChange} />
            <Divider />
          </>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All" />
          <Tab
            label={
              <Badge badgeContent={unreadCount} color="primary" max={99}>
                Unread
              </Badge>
            }
          />
        </Tabs>

        {/* Actions */}
        {unreadCount > 0 && (
          <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Button size="small" startIcon={<DoneAllIcon />} onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          </Box>
        )}

        {/* Notification List */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {isLoading ? (
            <List>
              {[1, 2, 3, 4, 5].map((i) => (
                <ListItem key={i}>
                  <ListItemIcon>
                    <Skeleton variant="circular" width={24} height={24} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Skeleton width="80%" />}
                    secondary={<Skeleton width="60%" />}
                  />
                </ListItem>
              ))}
            </List>
          ) : filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                {activeTab === 1 ? 'No unread notifications' : 'No notifications'}
              </Typography>
            </Box>
          ) : (
            <List dense>
              {/* Today */}
              {groupedNotifications.today.length > 0 && (
                <>
                  <ListItem>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      TODAY
                    </Typography>
                  </ListItem>
                  {groupedNotifications.today.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </>
              )}

              {/* Yesterday */}
              {groupedNotifications.yesterday.length > 0 && (
                <>
                  <ListItem>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      YESTERDAY
                    </Typography>
                  </ListItem>
                  {groupedNotifications.yesterday.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </>
              )}

              {/* Older */}
              {groupedNotifications.older.length > 0 && (
                <>
                  <ListItem>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      OLDER
                    </Typography>
                  </ListItem>
                  {groupedNotifications.older.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </>
              )}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button fullWidth variant="text" onClick={() => router.push('/flow')}>
            View All in Flow
          </Button>
        </Box>
      </Drawer>
    </>
  );
}

export { defaultDigestSettings };

'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Skeleton,
  Button,
  Divider,
  Avatar,
  Stack,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import DescriptionIcon from '@mui/icons-material/Description';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import { useActivityDashboard, type ActionItem } from '@/lib/hooks/useActivityDashboard';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

/**
 * Get icon for action item type
 */
function getActionIcon(type: ActionItem['type']) {
  const iconMap: Record<ActionItem['type'], React.ReactNode> = {
    task: <AssignmentIcon />,
    mention: <AlternateEmailIcon />,
    po_approval: <ShoppingCartIcon />,
    pr_approval: <ReceiptLongIcon />,
    bill_approval: <ReceiptLongIcon />,
    proposal_review: <DescriptionIcon />,
    invoice_pending: <ReceiptLongIcon />,
    document_review: <DescriptionIcon />,
    rfq_response: <ShoppingCartIcon />,
    leave_approval: <PeopleIcon />,
  };
  return iconMap[type] || <AssignmentIcon />;
}

/**
 * Get color for priority
 */
function getPriorityColor(priority: ActionItem['priority']) {
  const colorMap: Record<ActionItem['priority'], 'error' | 'warning' | 'info' | 'default'> = {
    urgent: 'error',
    high: 'warning',
    medium: 'info',
    low: 'default',
  };
  return colorMap[priority];
}

/**
 * Summary Card Component
 */
function SummaryCard({
  title,
  count,
  icon,
  color,
  onClick,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: 4,
            }
          : {},
      }}
      onClick={onClick}
    >
      <CardContent sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: color,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {count}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/**
 * Action Item Component
 */
function ActionItemRow({ item, onClick }: { item: ActionItem; onClick: () => void }) {
  return (
    <ListItem disablePadding>
      <ListItemButton onClick={onClick} sx={{ borderRadius: 1 }}>
        <ListItemIcon sx={{ minWidth: 40 }}>{getActionIcon(item.type)}</ListItemIcon>
        <ListItemText
          primary={item.title}
          secondary={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.description && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                  {item.description}
                </Typography>
              )}
              {item.dueDate && (
                <Typography variant="caption" color="text.secondary">
                  Due {formatDistanceToNow(item.dueDate, { addSuffix: true })}
                </Typography>
              )}
            </Box>
          }
          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
        />
        <Chip
          label={item.priority}
          size="small"
          color={getPriorityColor(item.priority)}
          variant="outlined"
          sx={{ ml: 1, textTransform: 'capitalize' }}
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Max items shown per group in "Today's Focus" before collapsing into a
 * "Show N more" link. Keeps the dashboard scannable even with long queues.
 */
const MAX_PER_GROUP = 5;

/**
 * "Show N more" row — links into the relevant module's filtered view so the
 * user can see the full group.
 */
function ShowMoreRow({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <ListItem disablePadding>
      <ListItemButton onClick={onClick} sx={{ borderRadius: 1, pl: 7 }}>
        <ListItemText
          primary={
            <Typography variant="caption" color="primary" fontWeight={500}>
              Show {count} more →
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Loading skeleton for action items
 */
function ActionItemSkeleton() {
  return (
    <ListItem disablePadding>
      <ListItemButton sx={{ borderRadius: 1 }}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Skeleton variant="circular" width={24} height={24} />
        </ListItemIcon>
        <ListItemText primary={<Skeleton width="60%" />} secondary={<Skeleton width="40%" />} />
        <Skeleton width={60} height={24} sx={{ ml: 1 }} />
      </ListItemButton>
    </ListItem>
  );
}

/**
 * Main Activity Dashboard Component
 */
export function ActivityDashboard() {
  const router = useRouter();
  const { claims } = useAuth();
  const perms = claims?.permissions || 0;
  const canViewEnquiries = hasPermission(perms, PERMISSION_FLAGS.VIEW_PROPOSALS);
  const canCreatePR = hasPermission(perms, PERMISSION_FLAGS.MANAGE_PROCUREMENT);
  const canUploadDocument =
    hasPermission(perms, PERMISSION_FLAGS.MANAGE_DOCUMENTS) ||
    hasPermission(perms, PERMISSION_FLAGS.SUBMIT_DOCUMENTS);
  const { actionItems, summary, isLoading, lastUpdated, refetch } = useActivityDashboard();

  const handleActionClick = (item: ActionItem) => {
    router.push(item.link);
  };

  // Group action items by type for better organization
  const groupedItems = useMemo(() => {
    const groups: {
      urgent: ActionItem[];
      tasks: ActionItem[];
      approvals: ActionItem[];
      other: ActionItem[];
    } = {
      urgent: [],
      tasks: [],
      approvals: [],
      other: [],
    };

    actionItems.data.forEach((item) => {
      if (item.priority === 'urgent') {
        groups.urgent.push(item);
      } else if (item.type === 'task') {
        groups.tasks.push(item);
      } else if (
        item.type === 'po_approval' ||
        item.type === 'pr_approval' ||
        item.type === 'bill_approval' ||
        item.type === 'leave_approval'
      ) {
        groups.approvals.push(item);
      } else {
        groups.other.push(item);
      }
    });

    return groups;
  }, [actionItems.data]);

  return (
    <Box sx={{ mb: 4 }}>
      {/* Summary Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
          mb: 4,
        }}
      >
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="circular" width={48} height={48} />
                    <Box>
                      <Skeleton width={40} height={32} />
                      <Skeleton width={80} height={20} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <SummaryCard
              title="Tasks Today"
              count={summary.data?.tasksToday || 0}
              icon={<AssignmentIcon />}
              color="#0891B2"
              onClick={() => router.push('/flow')}
            />
            <SummaryCard
              title="Pending Approvals"
              count={summary.data?.pendingApprovals || 0}
              icon={<CheckCircleIcon />}
              color="#10B981"
              onClick={() => router.push('/pending-approval')}
            />
            <SummaryCard
              title="Unread Mentions"
              count={summary.data?.unreadMentions || 0}
              icon={<AlternateEmailIcon />}
              color="#8B5CF6"
              onClick={() => router.push('/flow?view=mentions')}
            />
            <SummaryCard
              title="Overdue"
              count={summary.data?.overdueItems || 0}
              icon={<WarningIcon />}
              // Always red; lighter shade when zero so the card still reads as informative, not disabled
              color={summary.data?.overdueItems ? '#EF4444' : '#FCA5A5'}
              onClick={() => router.push('/flow?filter=overdue')}
            />
          </>
        )}
      </Box>

      {/* Today's Focus Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon color="primary" />
              <Typography variant="h6">Today&apos;s Focus</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {lastUpdated && !isLoading && (
                <Typography variant="caption" color="text.secondary">
                  Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                </Typography>
              )}
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => refetch()}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          {isLoading ? (
            <List dense>
              {[1, 2, 3, 4, 5].map((i) => (
                <ActionItemSkeleton key={i} />
              ))}
            </List>
          ) : actionItems.data.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                You&apos;re all caught up!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No pending items requiring your attention
              </Typography>
            </Box>
          ) : (
            <List dense>
              {/* Each group caps at MAX_PER_GROUP items. Extra items are not
                  hidden — there's a "Show N more" link that deep-links into the
                  relevant module so the user can see the full queue. */}
              {/* Urgent Items */}
              {groupedItems.urgent.length > 0 && (
                <>
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 600 }}
                  >
                    URGENT
                  </Typography>
                  {groupedItems.urgent.slice(0, MAX_PER_GROUP).map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      onClick={() => handleActionClick(item)}
                    />
                  ))}
                  {groupedItems.urgent.length > MAX_PER_GROUP && (
                    <ShowMoreRow
                      count={groupedItems.urgent.length - MAX_PER_GROUP}
                      onClick={() => router.push('/flow?filter=urgent')}
                    />
                  )}
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {/* Tasks */}
              {groupedItems.tasks.length > 0 && (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 600 }}
                  >
                    TASKS
                  </Typography>
                  {groupedItems.tasks.slice(0, MAX_PER_GROUP).map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      onClick={() => handleActionClick(item)}
                    />
                  ))}
                  {groupedItems.tasks.length > MAX_PER_GROUP && (
                    <ShowMoreRow
                      count={groupedItems.tasks.length - MAX_PER_GROUP}
                      onClick={() => router.push('/flow')}
                    />
                  )}
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {/* Approvals */}
              {groupedItems.approvals.length > 0 && (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 600 }}
                  >
                    AWAITING APPROVAL
                  </Typography>
                  {groupedItems.approvals.slice(0, MAX_PER_GROUP).map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      onClick={() => handleActionClick(item)}
                    />
                  ))}
                  {groupedItems.approvals.length > MAX_PER_GROUP && (
                    <ShowMoreRow
                      count={groupedItems.approvals.length - MAX_PER_GROUP}
                      onClick={() => router.push('/pending-approval')}
                    />
                  )}
                  <Divider sx={{ my: 1 }} />
                </>
              )}

              {/* Other Items */}
              {groupedItems.other.length > 0 && (
                <>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 2, py: 0.5, display: 'block', fontWeight: 600 }}
                  >
                    OTHER ITEMS
                  </Typography>
                  {groupedItems.other.slice(0, MAX_PER_GROUP).map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      onClick={() => handleActionClick(item)}
                    />
                  ))}
                  {groupedItems.other.length > MAX_PER_GROUP && (
                    <ShowMoreRow
                      count={groupedItems.other.length - MAX_PER_GROUP}
                      onClick={() => router.push('/flow')}
                    />
                  )}
                </>
              )}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {canViewEnquiries && (
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/proposals/enquiries')}
              >
                View Enquiries
              </Button>
            )}
            {canCreatePR && (
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/procurement/purchase-requests/new')}
              >
                New PR
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => router.push('/flow')}
            >
              Log Time
            </Button>
            {canUploadDocument && (
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/documents')}
              >
                Upload Document
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

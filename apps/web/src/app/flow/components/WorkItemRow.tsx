'use client';

/**
 * Work Item Row
 *
 * One row for both halves of My Work — a notification derived from a source
 * document, and a manual task someone typed. The union in `lib/tasks/workItems`
 * already decided what each row may offer, so this component only renders; it
 * never re-derives whether something can be completed.
 *
 * Actions sit on hover (always visible on touch), which is what keeps a
 * 50-row list from turning into a wall of buttons.
 */

import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  RadioButtonUnchecked as OpenIcon,
  CheckCircleOutline as CompleteIcon,
  DoneAll as DismissIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenLinkIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { isOverdue, type WorkItem, type WorkItemSource } from '@/lib/tasks/workItems';

interface WorkItemRowProps {
  item: WorkItem;
  onComplete: (item: WorkItem) => void;
  onDismiss: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
}

const SOURCE_LABELS: Record<WorkItemSource, string> = {
  meeting: 'Meeting',
  project: 'Project',
  proposal: 'Proposal',
  procurement: 'Procurement',
  accounting: 'Accounting',
  hr: 'HR',
  documents: 'Documents',
  enquiries: 'Enquiries',
  feedback: 'Feedback',
  general: 'General',
};

const PRIORITY_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

/** Left edge carries priority, so urgency reads without a chip per row. */
const PRIORITY_EDGE: Record<string, string> = {
  URGENT: 'error.main',
  HIGH: 'warning.main',
  MEDIUM: 'info.main',
  LOW: 'divider',
};

function dueLabel(item: WorkItem): string | null {
  const due = item.dueDate as { toDate?: () => Date } | undefined;
  if (!due?.toDate) return null;

  const date = due.toDate();
  const now = new Date();
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function ageLabel(item: WorkItem): string | null {
  const created = item.createdAt as { toDate?: () => Date } | undefined;
  if (!created?.toDate) return null;
  return formatDistanceToNow(created.toDate(), { addSuffix: true });
}

export function WorkItemRow({ item, onComplete, onDismiss, onDelete }: WorkItemRowProps) {
  const router = useRouter();
  const overdue = isOverdue(item);
  const due = dueLabel(item);
  const age = ageLabel(item);
  const clickable = Boolean(item.linkUrl);

  return (
    <Box
      onClick={clickable ? () => router.push(item.linkUrl!) : undefined}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderLeft: 3,
        borderLeftColor: PRIORITY_EDGE[item.priority] ?? 'divider',
        borderBottom: 1,
        borderBottomColor: 'divider',
        cursor: clickable ? 'pointer' : 'default',
        '&:hover': { bgcolor: 'action.hover' },
        // Actions stay hidden until hover on pointer devices; on touch, where
        // there is no hover, they are always visible.
        '& .work-item-actions': { opacity: { xs: 1, md: 0 } },
        '&:hover .work-item-actions': { opacity: 1 },
      }}
    >
      <Box sx={{ pt: 0.25, color: 'action.active', display: 'flex' }}>
        <OpenIcon fontSize="small" />
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: item.priority === 'URGENT' ? 600 : 500 }}>
          {item.title}
        </Typography>

        {item.subtitle && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.subtitle}
          </Typography>
        )}

        <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            label={
              item.sourceLabel
                ? `${SOURCE_LABELS[item.source]} · ${item.sourceLabel}`
                : SOURCE_LABELS[item.source]
            }
            size="small"
            variant="outlined"
            sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.65rem' } }}
          />

          {due && (
            <Chip
              label={due}
              size="small"
              color={overdue ? 'error' : 'default'}
              variant={overdue ? 'filled' : 'outlined'}
              sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.65rem' } }}
            />
          )}

          {/* Age is the only urgency signal a notification carries — it has no
              due date — so it is shown when there is no date to show instead. */}
          {!due && age && (
            <Typography variant="caption" color="text.secondary">
              {age}
            </Typography>
          )}

          {item.priority === 'URGENT' && (
            <Chip
              label="URGENT"
              size="small"
              color={PRIORITY_COLORS[item.priority]}
              sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.65rem' } }}
            />
          )}
        </Stack>
      </Box>

      <Stack
        direction="row"
        spacing={0.5}
        className="work-item-actions"
        sx={{ transition: 'opacity 120ms' }}
        onClick={(e) => e.stopPropagation()}
      >
        {item.actions.canComplete && (
          <Tooltip title="Mark as done">
            <IconButton size="small" onClick={() => onComplete(item)} aria-label="Mark as done">
              <CompleteIcon fontSize="small" color="success" />
            </IconButton>
          </Tooltip>
        )}

        {item.actions.canDismiss && (
          <Tooltip title="Dismiss">
            <IconButton size="small" onClick={() => onDismiss(item)} aria-label="Dismiss">
              <DismissIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {item.actions.canDelete && (
          <Tooltip title="Delete task">
            <IconButton size="small" onClick={() => onDelete(item)} aria-label="Delete task">
              <DeleteIcon fontSize="small" color="action" />
            </IconButton>
          </Tooltip>
        )}

        {clickable && (
          <Tooltip title="Open in new tab">
            <IconButton
              size="small"
              onClick={() => window.open(item.linkUrl, '_blank')}
              aria-label="Open in new tab"
            >
              <OpenLinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}

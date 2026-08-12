'use client';

/**
 * Manual Task Card
 *
 * Displays a single task with inline status toggle, priority chip,
 * assignee info, and due date.
 */

import { Card, CardContent, Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import {
  RadioButtonUnchecked as TodoIcon,
  PlayCircleOutline as InProgressIcon,
  CheckCircle as DoneIcon,
  Flag as FlagIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { MANUAL_TASK_STATUS_LABELS } from '@vapour/constants';
import type { ManualTask, ManualTaskStatus } from '@vapour/types';

interface ManualTaskCardProps {
  task: ManualTask;
  onStatusChange: (taskId: string, status: ManualTaskStatus) => void;
  onDelete?: (taskId: string) => void;
}

const PRIORITY_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

/**
 * `in_progress` is no longer reachable from the UI — a task is open or done.
 * The icon case stays so any task left in that state before the change still
 * renders (and can still be completed).
 */
function StatusIcon({ status }: { status: ManualTaskStatus }) {
  switch (status) {
    case 'todo':
      return <TodoIcon color="action" />;
    case 'in_progress':
      return <InProgressIcon color="primary" />;
    case 'done':
      return <DoneIcon color="success" />;
    case 'cancelled':
      return <DoneIcon color="disabled" />;
    default:
      return <TodoIcon color="action" />;
  }
}

function formatDueDate(dueDate?: { toDate: () => Date }): string | null {
  if (!dueDate) return null;
  const date = dueDate.toDate();
  const now = new Date();

  // FL-16: Normalize to date-only for fair timezone-agnostic comparison
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function ManualTaskCard({ task, onStatusChange, onDelete }: ManualTaskCardProps) {
  const dueDateLabel = formatDueDate(task.dueDate as { toDate: () => Date } | undefined);
  const isTerminal = task.status === 'done' || task.status === 'cancelled';
  const isOverdue = (() => {
    if (!task.dueDate || isTerminal) return false;
    const due = (task.dueDate as { toDate: () => Date }).toDate();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return dueDay < today;
  })();

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1,
        opacity: isTerminal ? 0.7 : 1,
        '&:hover': { boxShadow: 2 },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {/* Complete toggle — checkbox semantics: the circle means "not done
              yet, click to complete". It has exactly one meaning, which is what
              a task list leads everyone to expect. Terminal tasks show their
              state and are not clickable. */}
          <Tooltip title={isTerminal ? MANUAL_TASK_STATUS_LABELS[task.status] : 'Mark as done'}>
            <span>
              <IconButton
                size="small"
                disabled={isTerminal}
                onClick={() => onStatusChange(task.id, 'done')}
                sx={{ mt: -0.25 }}
                aria-label={isTerminal ? MANUAL_TASK_STATUS_LABELS[task.status] : 'Mark as done'}
              >
                <StatusIcon status={task.status} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Content */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              sx={{
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                fontWeight: task.priority === 'URGENT' ? 600 : 400,
              }}
            >
              {task.title}
            </Typography>

            {task.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.description}
              </Typography>
            )}

            <Box
              sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}
            >
              <Chip
                icon={<FlagIcon />}
                label={task.priority}
                size="small"
                color={PRIORITY_COLORS[task.priority] || 'default'}
                variant="outlined"
                sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem' } }}
              />

              {task.assigneeName && (
                <Chip
                  label={task.assigneeName}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem' } }}
                />
              )}

              {dueDateLabel && (
                <Chip
                  label={dueDateLabel}
                  size="small"
                  color={isOverdue ? 'error' : 'default'}
                  variant={isOverdue ? 'filled' : 'outlined'}
                  sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem' } }}
                />
              )}

              {task.projectName && (
                <Chip
                  label={task.projectName}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, '& .MuiChip-label': { fontSize: '0.7rem' } }}
                />
              )}
            </Box>
          </Box>

          {/* Delete */}
          {onDelete && task.status !== 'done' && (
            <Tooltip title="Delete task">
              <IconButton
                size="small"
                onClick={() => onDelete(task.id)}
                sx={{ mt: -0.25 }}
                aria-label="Delete task"
              >
                <DeleteIcon fontSize="small" color="action" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

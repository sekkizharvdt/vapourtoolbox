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
  CheckCircleOutline as MarkDoneIcon,
  PlayArrow as StartIcon,
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
          {/* Current status — indicator only. The actions that CHANGE the status
              are the explicit Start / Mark as done buttons on the right, so a
              click can never mean something other than its own label. */}
          <Tooltip title={MANUAL_TASK_STATUS_LABELS[task.status]}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', mt: 0.25, px: 0.5 }}
              aria-label={`Status: ${MANUAL_TASK_STATUS_LABELS[task.status]}`}
            >
              <StatusIcon status={task.status} />
            </Box>
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

          {/* Status actions — one button per transition, labelled with what it does */}
          {task.status === 'todo' && (
            <Tooltip title="Start task">
              <IconButton
                size="small"
                onClick={() => onStatusChange(task.id, 'in_progress')}
                sx={{ mt: -0.25 }}
                aria-label="Start task"
              >
                <StartIcon fontSize="small" color="primary" />
              </IconButton>
            </Tooltip>
          )}

          {!isTerminal && (
            <Tooltip title="Mark as done">
              <IconButton
                size="small"
                onClick={() => onStatusChange(task.id, 'done')}
                sx={{ mt: -0.25 }}
                aria-label="Mark as done"
              >
                <MarkDoneIcon fontSize="small" color="success" />
              </IconButton>
            </Tooltip>
          )}

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

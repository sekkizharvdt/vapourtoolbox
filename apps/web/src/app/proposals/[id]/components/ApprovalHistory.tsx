import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import { Typography, Box, Paper } from '@mui/material';
import {
  Check as ApprovedIcon,
  Close as RejectedIcon,
  ChangeCircle as ChangesIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import type { ApprovalRecord } from '@vapour/types';
import { format } from 'date-fns';

interface ApprovalHistoryProps {
  history: ApprovalRecord[];
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'APPROVED':
      return <ApprovedIcon />;
    case 'REJECTED':
      return <RejectedIcon />;
    case 'REQUESTED_CHANGES':
      return <ChangesIcon />;
    case 'SUBMITTED':
      return <SubmitIcon />;
    default:
      return <SubmitIcon />;
  }
};

const getActionColor = (
  action: string
): 'grey' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
  switch (action) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'REQUESTED_CHANGES':
      return 'warning';
    case 'SUBMITTED':
      return 'info';
    default:
      return 'grey';
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'REQUESTED_CHANGES':
      return 'Requested Changes';
    case 'SUBMITTED':
      return 'Submitted';
    default:
      return action;
  }
};

export default function ApprovalHistory({ history }: ApprovalHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No approval history yet
      </Typography>
    );
  }

  return (
    <Timeline position="right">
      {history.map((record, index) => (
        <TimelineItem key={index}>
          <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
            <Typography variant="caption">
              {record.timestamp?.toDate ? format(record.timestamp.toDate(), 'MMM d, yyyy') : '-'}
            </Typography>
            <Typography variant="caption" display="block">
              {record.timestamp?.toDate ? format(record.timestamp.toDate(), 'h:mm a') : ''}
            </Typography>
          </TimelineOppositeContent>

          <TimelineSeparator>
            <TimelineDot color={getActionColor(record.action)}>
              {getActionIcon(record.action)}
            </TimelineDot>
            {index < history.length - 1 && <TimelineConnector />}
          </TimelineSeparator>

          <TimelineContent>
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {getActionLabel(record.action)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                by {record.approverUserName}
              </Typography>
              {record.comments && (
                <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    &quot;{record.comments}&quot;
                  </Typography>
                </Box>
              )}
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}

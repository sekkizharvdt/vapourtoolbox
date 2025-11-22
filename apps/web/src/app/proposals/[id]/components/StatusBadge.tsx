import { Chip, Tooltip } from '@mui/material';
import type { ProposalStatus } from '@vapour/types';

interface StatusBadgeProps {
  status: ProposalStatus;
}

const STATUS_CONFIG: Record<
  ProposalStatus,
  {
    label: string;
    color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
    tooltip: string;
  }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'default',
    tooltip: 'Proposal is being prepared',
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    color: 'warning',
    tooltip: 'Awaiting internal approval',
  },
  APPROVED: {
    label: 'Approved',
    color: 'info',
    tooltip: 'Approved internally, ready to send to client',
  },
  SUBMITTED: {
    label: 'Submitted',
    color: 'primary',
    tooltip: 'Submitted to client, awaiting response',
  },
  UNDER_NEGOTIATION: {
    label: 'Negotiating',
    color: 'secondary',
    tooltip: 'Under negotiation with client',
  },
  ACCEPTED: {
    label: 'Accepted',
    color: 'success',
    tooltip: 'Client accepted the proposal',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'error',
    tooltip: 'Proposal was rejected',
  },
  EXPIRED: {
    label: 'Expired',
    color: 'error',
    tooltip: 'Proposal validity period has passed',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Tooltip title={config.tooltip} arrow>
      <Chip label={config.label} color={config.color} size="medium" />
    </Tooltip>
  );
}

'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Cancel as CancelIcon } from '@mui/icons-material';
import type { MatchDiscrepancy } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/threeWayMatchHelpers';

interface ApproveDialogProps {
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  loading: boolean;
  variance: number;
}

export function ApproveDialog({ open, onClose, onApprove, loading, variance }: ApproveDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Approve Three-Way Match</DialogTitle>
      <DialogContent>
        <Typography>Are you sure you want to approve this three-way match?</Typography>
        {variance !== 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            This match has a variance of {formatCurrency(variance)}. Approving will mark it as
            &quot;Approved with Variance&quot;.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onApprove}
          variant="contained"
          color="success"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface RejectDialogProps {
  open: boolean;
  onClose: () => void;
  onReject: () => void;
  loading: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
}

export function RejectDialog({
  open,
  onClose,
  onReject,
  loading,
  notes,
  onNotesChange,
}: RejectDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reject Three-Way Match</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>Please provide a reason for rejecting this match:</Typography>
        <TextField
          label="Rejection Reason"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          fullWidth
          multiline
          rows={3}
          required
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onReject}
          variant="contained"
          color="error"
          disabled={loading || !notes.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <CancelIcon />}
        >
          Reject
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type ResolutionType = NonNullable<MatchDiscrepancy['resolution']>;

interface ResolveDiscrepancyDialogProps {
  open: boolean;
  onClose: () => void;
  onResolve: () => void;
  loading: boolean;
  discrepancy: MatchDiscrepancy | null;
  resolutionType: ResolutionType;
  onResolutionTypeChange: (value: ResolutionType) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export function ResolveDiscrepancyDialog({
  open,
  onClose,
  onResolve,
  loading,
  discrepancy,
  resolutionType,
  onResolutionTypeChange,
  notes,
  onNotesChange,
}: ResolveDiscrepancyDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Resolve Discrepancy</DialogTitle>
      <DialogContent>
        {discrepancy && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              <strong>{discrepancy.discrepancyType}</strong>: {discrepancy.description}
            </Alert>
            <FormControl fullWidth>
              <InputLabel>Resolution Type</InputLabel>
              <Select
                value={resolutionType}
                label="Resolution Type"
                onChange={(e) => onResolutionTypeChange(e.target.value as ResolutionType)}
              >
                <MenuItem value="ACCEPTED">Accept Variance</MenuItem>
                <MenuItem value="CORRECTED_BY_VENDOR">Corrected by Vendor</MenuItem>
                <MenuItem value="PRICE_ADJUSTMENT">Price Adjustment</MenuItem>
                <MenuItem value="QUANTITY_ADJUSTMENT">Quantity Adjustment</MenuItem>
                <MenuItem value="WAIVED">Waived</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Resolution Notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onResolve}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
        >
          Resolve
        </Button>
      </DialogActions>
    </Dialog>
  );
}

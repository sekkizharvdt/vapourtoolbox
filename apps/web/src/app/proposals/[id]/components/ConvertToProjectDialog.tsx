import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  AccountTree as ProjectIcon,
  AttachMoney as BudgetIcon,
  CalendarToday as DateIcon,
  ListAlt as DeliverablesIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { convertProposalToProject } from '@/lib/proposals/projectConversion';
import type { Proposal } from '@vapour/types';
import { logger } from '@vapour/logger';

interface ConvertToProjectDialogProps {
  open: boolean;
  proposal: Proposal;
  onClose: () => void;
  onComplete: (projectId: string) => void;
}

export default function ConvertToProjectDialog({
  open,
  proposal,
  onClose,
  onComplete,
}: ConvertToProjectDialogProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    if (!db || !user) return;

    try {
      setConverting(true);
      setError(null);

      const projectId = await convertProposalToProject(
        db,
        proposal.id,
        user.uid,
        user.displayName || 'Unknown',
        proposal
      );

      logger.info('Proposal converted to project', { proposalId: proposal.id, projectId });
      onComplete(projectId);
    } catch (err) {
      logger.error('Error converting proposal to project', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to convert proposal to project');
    } finally {
      setConverting(false);
    }
  };

  const formatCurrency = (money: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ProjectIcon color="primary" />
          <Typography variant="h6">Convert to Project</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          This will create a new project based on this proposal's details. The proposal will be
          linked to the project.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" gutterBottom>
          Project Overview
        </Typography>

        <List dense>
          <ListItem>
            <ListItemIcon>
              <ProjectIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Project Name" secondary={proposal.title} />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <BudgetIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Budget"
              secondary={formatCurrency(proposal.pricing.totalAmount)}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <DateIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Duration"
              secondary={`${proposal.deliveryPeriod.durationInWeeks} weeks`}
            />
          </ListItem>

          {proposal.scopeOfWork?.deliverables && (
            <ListItem>
              <ListItemIcon>
                <DeliverablesIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Deliverables"
                secondary={`${proposal.scopeOfWork.deliverables.length} deliverables defined`}
              />
            </ListItem>
          )}

          <ListItem>
            <ListItemIcon>
              <CheckIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText primary="Client" secondary={proposal.clientName} />
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary">
          The project will be created with:
        </Typography>
        <Box component="ul" sx={{ pl: 2, mt: 1 }}>
          <li>
            <Typography variant="body2">
              Project charter with objectives and deliverables
            </Typography>
          </li>
          <li>
            <Typography variant="body2">Budget from proposal pricing</Typography>
          </li>
          <li>
            <Typography variant="body2">Timeline based on delivery period</Typography>
          </li>
          <li>
            <Typography variant="body2">Client information linked</Typography>
          </li>
          <li>
            <Typography variant="body2">You as the initial project manager</Typography>
          </li>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={converting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConvert}
          disabled={converting}
          startIcon={converting ? <CircularProgress size={20} /> : <ProjectIcon />}
        >
          {converting ? 'Converting...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

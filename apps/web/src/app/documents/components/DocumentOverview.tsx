'use client';

/**
 * Document Overview Tab
 *
 * Shows detailed information about the master document
 */

import {
  Box,
  Grid,
  Paper,
  Typography,
  Stack,
  Divider,
  Chip,
} from '@mui/material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentOverviewProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentOverview({ document }: DocumentOverviewProps) {
  const formatDate = (timestamp: { seconds: number } | undefined) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        {/* Basic Information */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Document Number
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {document.documentNumber}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Title
              </Typography>
              <Typography variant="body1">{document.title}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{document.description || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Discipline Code
              </Typography>
              <Typography variant="body1">{document.disciplineCode}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Sub-Code
              </Typography>
              <Typography variant="body1">{document.subCode || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Document Type
              </Typography>
              <Typography variant="body1">{document.documentType || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Current Revision
              </Typography>
              <Typography variant="body1">{document.currentRevision}</Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Status & Tracking */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Status & Tracking
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Typography variant="body1">{document.status}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Visibility
              </Typography>
              <Typography variant="body1">
                {document.visibility === 'CLIENT_VISIBLE' ? 'Client Visible' : 'Internal Only'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Due Date
              </Typography>
              <Typography variant="body1">{formatDate(document.dueDate)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Estimated Hours
              </Typography>
              <Typography variant="body1">{document.estimatedHours || '-'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Assigned To
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                {document.assignedTo.length > 0 ? (
                  document.assignedTo.map((userId, index) => (
                    <Chip
                      key={userId}
                      label={document.assignedToNames[index] || userId}
                      size="small"
                    />
                  ))
                ) : (
                  <Typography variant="body2">Not assigned</Typography>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Submission Information */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Submission Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Total Submissions
              </Typography>
              <Typography variant="h4">{document.submissionCount}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Last Submission
              </Typography>
              <Typography variant="body1">{formatDate(document.lastSubmissionDate)}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Client Acceptance
              </Typography>
              <Typography variant="body1">{formatDate(document.clientAcceptanceDate)}</Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Linked Items */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Linked Items
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Supply Items
              </Typography>
              <Typography variant="h4">{document.supplyItemCount}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Work Items
              </Typography>
              <Typography variant="h4">{document.workItemCount}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                Document Links
              </Typography>
              <Typography variant="h4">
                {document.predecessors.length + document.successors.length}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Audit Information */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Audit Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Created By
              </Typography>
              <Typography variant="body1">{document.createdByName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(document.createdAt)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body1">{formatDate(document.updatedAt)}</Typography>
            </Grid>
          </Grid>
        </Paper>
      </Stack>
    </Box>
  );
}

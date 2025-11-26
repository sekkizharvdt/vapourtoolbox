'use client';

import { useState } from 'react';

import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  Alert,
  Chip,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Project } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { formatDate } from '@/lib/utils/formatters';

interface CharterTabProps {
  project: Project;
}

export function CharterTab({ project }: CharterTabProps) {
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form state for charter authorization
  const [sponsorName, setSponsorName] = useState(project.charter?.authorization?.sponsorName || '');
  const [sponsorTitle, setSponsorTitle] = useState(
    project.charter?.authorization?.sponsorTitle || ''
  );
  const [budgetAuthority, setBudgetAuthority] = useState(
    project.charter?.authorization?.budgetAuthority || ''
  );

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';

  const charter = project.charter;
  const authorization = charter?.authorization;
  const approvalStatus = authorization?.approvalStatus || 'DRAFT';

  const canApprove = hasManageAccess && approvalStatus !== 'APPROVED';

  const handleSaveAuthorization = async () => {
    if (!sponsorName.trim() || !sponsorTitle.trim()) {
      setError('Sponsor name and title are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      await updateDoc(projectRef, {
        'charter.authorization': {
          sponsorName: sponsorName.trim(),
          sponsorTitle: sponsorTitle.trim(),
          budgetAuthority: budgetAuthority.trim(),
          approvalStatus: 'DRAFT',
          authorizedDate: null,
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
        },
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setEditMode(false);
    } catch (err) {
      console.error('[CharterTab] Error saving authorization:', err);
      setError(err instanceof Error ? err.message : 'Failed to save charter authorization');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    // Import validation function
    const { validateCharterForApproval, getValidationSummary } = await import(
      '@/lib/projects/charterValidationService'
    );

    // Validate charter before approval
    const validationResult = validateCharterForApproval(project.charter);

    if (!validationResult.isValid) {
      const summary = getValidationSummary(validationResult);
      alert(
        `Cannot approve charter - validation failed:\n\n${summary}\n\nPlease complete all required sections before approval.`
      );
      return;
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      const warningMsg = `Charter validation passed with warnings:\n\n${validationResult.warnings.join('\n')}\n\nDo you want to proceed with approval?`;
      if (!window.confirm(warningMsg)) {
        return;
      }
    }

    // Final confirmation
    if (
      !window.confirm(
        'Approve this project charter? This will trigger automatic PR creation for HIGH/CRITICAL procurement items.'
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      // Update charter approval status
      await updateDoc(projectRef, {
        'charter.authorization.approvalStatus': 'APPROVED',
        'charter.authorization.approvedBy': userId,
        'charter.authorization.approvedAt': Timestamp.now(),
        'charter.authorization.authorizedDate': Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Create cost centre for the project
      const { createProjectCostCentre } = await import('@/lib/accounting/costCentreService');
      const budgetAmount = project.budget?.estimated?.amount || null;
      const userName = user?.displayName || user?.email || 'Unknown User';

      const costCentreId = await createProjectCostCentre(
        db,
        project.id,
        project.code,
        project.name,
        budgetAmount,
        userId,
        userName
      );

      // Update project with cost centre ID
      await updateDoc(projectRef, {
        costCentreId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      alert(
        'Charter approved! Cost centre created and Purchase Requests will be automatically created.'
      );
    } catch (err) {
      console.error('[CharterTab] Error approving charter:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve charter');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      await updateDoc(projectRef, {
        'charter.authorization.approvalStatus': 'REJECTED',
        'charter.authorization.rejectionReason': reason,
        'charter.authorization.approvedBy': userId,
        'charter.authorization.approvedAt': Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } catch (err) {
      console.error('[CharterTab] Error rejecting charter:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject charter');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING_APPROVAL':
        return 'warning';
      case 'REJECTED':
        return 'error';
      case 'DRAFT':
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Authorization Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Project Authorization</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={approvalStatus.replace(/_/g, ' ')}
              color={getStatusColor(approvalStatus)}
              size="small"
            />
            {hasManageAccess && !editMode && approvalStatus !== 'APPROVED' && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {editMode ? (
          // Edit Mode
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Sponsor Name"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Sponsor Title"
                value={sponsorTitle}
                onChange={(e) => setSponsorTitle(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Budget Authority"
                value={budgetAuthority}
                onChange={(e) => setBudgetAuthority(e.target.value)}
                placeholder="Person/Department authorizing budget"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={handleSaveAuthorization} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={() => setEditMode(false)} disabled={loading}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        ) : (
          // View Mode
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Sponsor Name
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {authorization?.sponsorName || 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Sponsor Title
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {authorization?.sponsorTitle || 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Budget Authority
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {authorization?.budgetAuthority || 'Not set'}
              </Typography>
            </Grid>
            {authorization?.authorizedDate && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Authorized Date
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDate(authorization.authorizedDate)}
                </Typography>
              </Grid>
            )}
            {authorization?.approvedBy && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Approved By
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {authorization.approvedBy}
                </Typography>
              </Grid>
            )}
            {authorization?.approvedAt && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Approved At
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDate(authorization.approvedAt)}
                </Typography>
              </Grid>
            )}
            {authorization?.rejectionReason && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="error">
                  <Typography variant="body2" fontWeight="medium">
                    Rejection Reason:
                  </Typography>
                  <Typography variant="body2">{authorization.rejectionReason}</Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        )}

        {/* Approval Actions */}
        {canApprove && !editMode && authorization?.sponsorName && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={handleApprove}
              disabled={loading}
            >
              Approve Charter
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={handleReject}
              disabled={loading}
            >
              Reject
            </Button>
          </Box>
        )}

        {!authorization?.sponsorName && !editMode && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Charter authorization information is not set. Click &quot;Edit&quot; to add sponsor
            details.
          </Alert>
        )}
      </Paper>

      {/* Charter Summary Cards */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Objectives
              </Typography>
              <Typography variant="h3">{charter?.objectives?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Defined objectives
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Deliverables
              </Typography>
              <Typography variant="h3">{charter?.deliverables?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Project deliverables
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risks Identified
              </Typography>
              <Typography variant="h3">{charter?.risks?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Risk assessment
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Future: Add objectives, deliverables, scope, risks editing UI */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Charter Details Management
        </Typography>
        <Typography variant="body2">
          Objectives, deliverables, scope, risks, and stakeholder management features are available
          for future enhancement. For now, focus on authorization and approval workflow.
        </Typography>
      </Alert>
    </Box>
  );
}

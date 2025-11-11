'use client';

import { useState } from 'react';

import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { Project, DocumentRequirement } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import {
  addDocumentRequirement,
  updateDocumentRequirement,
  deleteDocumentRequirement,
} from '@/lib/projects/documentRequirementService';

interface DocumentsTabProps {
  project: Project;
}

interface DocumentRequirementFormData {
  documentType: string;
  documentCategory: DocumentRequirement['documentCategory'];
  description: string;
  isRequired: boolean;
  dueDate: string;
  priority: DocumentRequirement['priority'];
  notes: string;
}

const EMPTY_FORM: DocumentRequirementFormData = {
  documentType: '',
  documentCategory: 'OTHER',
  description: '',
  isRequired: true,
  dueDate: '',
  priority: 'MEDIUM',
  notes: '',
};

export function DocumentsTab({ project }: DocumentsTabProps) {
  const { claims, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<DocumentRequirement | null>(null);
  const [formData, setFormData] = useState<DocumentRequirementFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const documentRequirements = project.documentRequirements || [];

  const userId = user?.uid || '';

  const handleAdd = () => {
    setSelectedRequirement(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (requirement: DocumentRequirement) => {
    setSelectedRequirement(requirement);

    let dueDateString = '';
    if (requirement.dueDate) {
      let dateObj: Date;
      if (requirement.dueDate instanceof Date) {
        dateObj = requirement.dueDate;
      } else if (typeof requirement.dueDate === 'object' && 'toDate' in requirement.dueDate) {
        dateObj = requirement.dueDate.toDate();
      } else if (typeof requirement.dueDate === 'string') {
        dateObj = new Date(requirement.dueDate);
      } else {
        dateObj = new Date();
      }
      dueDateString = dateObj.toISOString().split('T')[0] || '';
    }

    setFormData({
      documentType: requirement.documentType,
      documentCategory: requirement.documentCategory,
      description: requirement.description,
      isRequired: requirement.isRequired,
      dueDate: dueDateString,
      priority: requirement.priority,
      notes: requirement.notes || '',
    });
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setSelectedRequirement(null);
    setFormData(EMPTY_FORM);
    setError(null);
  };

  const handleChange =
    (field: keyof DocumentRequirementFormData) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | { target: { value: string } }
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async () => {
    // Validation
    if (!formData.documentType.trim()) {
      setError('Document type is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requirementData: Omit<DocumentRequirement, 'id' | 'status'> = {
        documentType: formData.documentType.trim(),
        documentCategory: formData.documentCategory,
        description: formData.description.trim(),
        isRequired: formData.isRequired,
        dueDate: formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate)) : undefined,
        priority: formData.priority,
        notes: formData.notes || undefined,
        assignedTo: [],
      };

      if (selectedRequirement) {
        // Update existing requirement
        await updateDocumentRequirement(
          project.id,
          selectedRequirement.id,
          requirementData as Partial<DocumentRequirement>,
          userId
        );
      } else {
        // Add new requirement
        await addDocumentRequirement(project.id, requirementData, userId);
      }

      handleClose();
    } catch (err) {
      console.error('[DocumentsTab] Error saving requirement:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document requirement');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (requirement: DocumentRequirement) => {
    if (!window.confirm(`Delete document requirement "${requirement.documentType}"?`)) {
      return;
    }

    try {
      await deleteDocumentRequirement(project.id, requirement.id, userId);
    } catch (err) {
      console.error('[DocumentsTab] Error deleting requirement:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document requirement');
    }
  };

  const getStatusColor = (
    status: DocumentRequirement['status']
  ): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'NOT_SUBMITTED':
        return 'default';
      case 'SUBMITTED':
        return 'primary';
      case 'UNDER_REVIEW':
        return 'secondary';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (
    priority: DocumentRequirement['priority']
  ): 'default' | 'warning' | 'error' => {
    switch (priority) {
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'default';
      default:
        return 'default';
    }
  };

  // Calculate stats
  const stats = {
    total: documentRequirements.length,
    notSubmitted: documentRequirements.filter((r) => r.status === 'NOT_SUBMITTED').length,
    submitted: documentRequirements.filter((r) => r.status === 'SUBMITTED').length,
    underReview: documentRequirements.filter((r) => r.status === 'UNDER_REVIEW').length,
    approved: documentRequirements.filter((r) => r.status === 'APPROVED').length,
    rejected: documentRequirements.filter((r) => r.status === 'REJECTED').length,
  };

  const completionRate = stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : '0';

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Document Requirements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track required documents for this project. Documents uploaded to the system will be
            automatically linked to requirements.
          </Typography>
        </Box>
        {hasManageAccess && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Requirement
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h4">{stats.total}</Typography>
            <Typography variant="caption" color="text.secondary">
              Total
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="h4">{stats.notSubmitted}</Typography>
            <Typography variant="caption">Not Submitted</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
            <Typography variant="h4">{stats.submitted}</Typography>
            <Typography variant="caption">Submitted</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="h4">{stats.underReview}</Typography>
            <Typography variant="caption">Under Review</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="h4">{stats.approved}</Typography>
            <Typography variant="caption">Approved</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h4">{completionRate}%</Typography>
            <Typography variant="caption" color="text.secondary">
              Completion
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Document Completion Progress
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {stats.approved} of {stats.total} approved
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={parseFloat(completionRate)}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      {/* Requirements Table */}
      {documentRequirements.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No document requirements defined yet. Click &quot;Add Requirement&quot; to get started.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Document Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Required</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Linked Document</TableCell>
                {hasManageAccess && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {documentRequirements.map((requirement) => (
                <TableRow key={requirement.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {requirement.documentType}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={requirement.documentCategory.replace(/_/g, ' ')}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {requirement.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={requirement.priority}
                      size="small"
                      color={getPriorityColor(requirement.priority)}
                    />
                  </TableCell>
                  <TableCell>
                    {requirement.isRequired ? (
                      <CheckIcon color="success" fontSize="small" />
                    ) : (
                      <CancelIcon color="disabled" fontSize="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        if (!requirement.dueDate) return '-';
                        let dateObj: Date;
                        if (requirement.dueDate instanceof Date) {
                          dateObj = requirement.dueDate;
                        } else if (
                          typeof requirement.dueDate === 'object' &&
                          'toDate' in requirement.dueDate
                        ) {
                          dateObj = requirement.dueDate.toDate();
                        } else if (typeof requirement.dueDate === 'string') {
                          dateObj = new Date(requirement.dueDate);
                        } else {
                          return '-';
                        }
                        return dateObj.toLocaleDateString('en-IN');
                      })()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={requirement.status.replace(/_/g, ' ')}
                      size="small"
                      color={getStatusColor(requirement.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {requirement.linkedDocumentId ? (
                      <Tooltip title="View Document">
                        <IconButton size="small">
                          <LinkIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not linked
                      </Typography>
                    )}
                  </TableCell>
                  {hasManageAccess && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(requirement)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(requirement)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedRequirement ? 'Edit Document Requirement' : 'Add Document Requirement'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                label="Document Type"
                value={formData.documentType}
                onChange={handleChange('documentType')}
                required
                placeholder="e.g., Technical Specification"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.documentCategory}
                  label="Category"
                  onChange={handleChange('documentCategory')}
                >
                  <MenuItem value="PROJECT_PLAN">Project Plan</MenuItem>
                  <MenuItem value="TECHNICAL_DRAWING">Technical Drawing</MenuItem>
                  <MenuItem value="SPECIFICATION">Specification</MenuItem>
                  <MenuItem value="CONTRACT">Contract</MenuItem>
                  <MenuItem value="PROGRESS_REPORT">Progress Report</MenuItem>
                  <MenuItem value="MEETING_MINUTES">Meeting Minutes</MenuItem>
                  <MenuItem value="COMPLIANCE">Compliance</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={2}
                placeholder="Detailed description of the document requirement"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth required>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={handleChange('priority')}
                >
                  <MenuItem value="HIGH">High</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Required</InputLabel>
                <Select
                  value={formData.isRequired ? 'yes' : 'no'}
                  label="Required"
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isRequired: e.target.value === 'yes' }))
                  }
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={formData.dueDate}
                onChange={handleChange('dueDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={handleChange('notes')}
                multiline
                rows={2}
                placeholder="Additional notes"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? 'Saving...' : selectedRequirement ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

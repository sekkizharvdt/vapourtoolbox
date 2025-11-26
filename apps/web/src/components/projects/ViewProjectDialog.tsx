'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Chip,
  Grid,
  Typography,
  Divider,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material';
import type { Project, ProjectStatus, ProjectPriority } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface ViewProjectDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
}

export function ViewProjectDialog({
  open,
  project,
  onClose,
  onEdit,
  onDelete,
  canManage,
}: ViewProjectDialogProps) {
  if (!project) return null;

  // Get status color
  const getStatusColor = (
    status: ProjectStatus
  ): 'default' | 'primary' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PROPOSAL':
        return 'primary';
      case 'ON_HOLD':
        return 'warning';
      case 'COMPLETED':
        return 'default';
      case 'CANCELLED':
      case 'ARCHIVED':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: ProjectPriority): 'default' | 'warning' | 'error' => {
    switch (priority) {
      case 'CRITICAL':
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


  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ color: 'primary.main' }}>
              <ProjectIcon fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h6">{project.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Code: {project.code}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {canManage && (
              <>
                <IconButton size="small" onClick={onEdit} title="Edit Project">
                  <EditIcon />
                </IconButton>
                <IconButton size="small" color="error" onClick={onDelete} title="Delete Project">
                  <DeleteIcon />
                </IconButton>
              </>
            )}
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Status and Priority */}
        <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
          <Chip label={project.status} color={getStatusColor(project.status)} />
          <Chip label={project.priority} color={getPriorityColor(project.priority)} />
        </Box>

        {/* Description */}
        {project.description && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description
            </Typography>
            <Typography variant="body2">{project.description}</Typography>
          </Box>
        )}

        <Grid container spacing={3}>
          {/* Client Information */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Client Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Client Name
                    </Typography>
                    <Typography variant="body2">{project.client.entityName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Contact Person
                    </Typography>
                    <Typography variant="body2">{project.client.contactPerson}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body2">{project.client.contactEmail}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Phone
                    </Typography>
                    <Typography variant="body2">{project.client.contactPhone}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Project Details */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Project Details
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Project Manager
                    </Typography>
                    <Typography variant="body2">{project.projectManager.userName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Team Size
                    </Typography>
                    <Typography variant="body2">{project.team?.length || 0} members</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Visibility
                    </Typography>
                    <Typography variant="body2">
                      {project.visibility.charAt(0).toUpperCase() + project.visibility.slice(1)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Timeline */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Timeline
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Start Date
                    </Typography>
                    <Typography variant="body2">{formatDate(project.dates.startDate)}</Typography>
                  </Box>
                  {project.dates.endDate && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        End Date
                      </Typography>
                      <Typography variant="body2">{formatDate(project.dates.endDate)}</Typography>
                    </Box>
                  )}
                  {project.dates.actualStartDate && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Actual Start Date
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(project.dates.actualStartDate)}
                      </Typography>
                    </Box>
                  )}
                  {project.dates.actualEndDate && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Actual End Date
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(project.dates.actualEndDate)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Budget */}
          {project.budget && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Budget
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Estimated Budget
                      </Typography>
                      <Typography variant="body2">
                        {project.budget.currency} {project.budget.estimated.amount.toLocaleString()}
                      </Typography>
                    </Box>
                    {project.budget.actual && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Actual Budget
                        </Typography>
                        <Typography variant="body2">
                          {project.budget.currency} {project.budget.actual.amount.toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Additional Info */}
          {(project.category || project.location || project.tags?.length) && (
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Additional Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {project.category && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Category
                        </Typography>
                        <Typography variant="body2">{project.category}</Typography>
                      </Box>
                    )}
                    {project.location && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Location
                        </Typography>
                        <Typography variant="body2">{project.location}</Typography>
                      </Box>
                    )}
                    {project.tags && project.tags.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Tags
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {project.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

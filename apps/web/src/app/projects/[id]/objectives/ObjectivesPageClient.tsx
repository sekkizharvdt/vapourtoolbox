'use client';

import { useState, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project, ProjectObjective, ProjectDeliverable } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { useProjectPage } from '../components/useProjectPage';
import { ProjectSubPageWrapper } from '../components/ProjectSubPageWrapper';
import { formatDate } from '@/lib/utils/formatters';

// Lazy load dialog components
const ObjectiveFormDialog = lazy(() =>
  import('./components/ObjectiveFormDialog').then((m) => ({ default: m.ObjectiveFormDialog }))
);
const DeliverableFormDialog = lazy(() =>
  import('./components/DeliverableFormDialog').then((m) => ({ default: m.DeliverableFormDialog }))
);

// Dialog loading fallback
function DialogLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress />
    </Box>
  );
}

// Helper functions for status/priority colors
function getStatusColor(status: string): 'default' | 'primary' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'ACHIEVED':
    case 'ACCEPTED':
      return 'success';
    case 'IN_PROGRESS':
    case 'SUBMITTED':
      return 'primary';
    case 'AT_RISK':
    case 'REJECTED':
      return 'error';
    case 'PENDING':
    case 'NOT_STARTED':
    default:
      return 'default';
  }
}

function getPriorityColor(priority: string): 'error' | 'warning' | 'default' {
  switch (priority) {
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    default:
      return 'default';
  }
}

// Objectives Content Component
function ObjectivesContent({ project }: { project: Project }) {
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form dialogs
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<ProjectObjective | undefined>();
  const [editingDeliverable, setEditingDeliverable] = useState<ProjectDeliverable | undefined>();

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';

  const objectives = project.charter?.objectives || [];
  const deliverables = project.charter?.deliverables || [];

  const handleSaveObjective = async (
    objectiveData: Omit<ProjectObjective, 'id'> & { id?: string }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      let updatedObjectives: ProjectObjective[];
      if (objectiveData.id) {
        // Update existing
        updatedObjectives = objectives.map(
          (o): ProjectObjective => (o.id === objectiveData.id ? { ...o, ...objectiveData } : o)
        );
      } else {
        // Add new
        const newObjective: ProjectObjective = {
          id: `obj-${crypto.randomUUID().slice(0, 8)}`,
          description: objectiveData.description,
          successCriteria: objectiveData.successCriteria,
          status: objectiveData.status,
          priority: objectiveData.priority,
        };
        updatedObjectives = [...objectives, newObjective];
      }

      await updateDoc(projectRef, {
        'charter.objectives': updatedObjectives,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setObjectiveDialogOpen(false);
      setEditingObjective(undefined);
    } catch (err) {
      console.error('[ObjectivesPage] Error saving objective:', err);
      setError(err instanceof Error ? err.message : 'Failed to save objective');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteObjective = async (objectiveId: string) => {
    if (!window.confirm('Delete this objective?')) return;

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      const updatedObjectives = objectives.filter((o) => o.id !== objectiveId);

      await updateDoc(projectRef, {
        'charter.objectives': updatedObjectives,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } catch (err) {
      console.error('[ObjectivesPage] Error deleting objective:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete objective');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDeliverable = async (
    deliverableData: Omit<ProjectDeliverable, 'id'> & { id?: string }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      let updatedDeliverables: ProjectDeliverable[];
      if (deliverableData.id) {
        // Update existing
        updatedDeliverables = deliverables.map(
          (d): ProjectDeliverable =>
            d.id === deliverableData.id ? { ...d, ...deliverableData } : d
        );
      } else {
        // Add new
        const newDeliverable: ProjectDeliverable = {
          id: `del-${crypto.randomUUID().slice(0, 8)}`,
          name: deliverableData.name,
          description: deliverableData.description,
          type: deliverableData.type,
          status: deliverableData.status,
          acceptanceCriteria: deliverableData.acceptanceCriteria,
        };
        updatedDeliverables = [...deliverables, newDeliverable];
      }

      await updateDoc(projectRef, {
        'charter.deliverables': updatedDeliverables,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setDeliverableDialogOpen(false);
      setEditingDeliverable(undefined);
    } catch (err) {
      console.error('[ObjectivesPage] Error saving deliverable:', err);
      setError(err instanceof Error ? err.message : 'Failed to save deliverable');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeliverable = async (deliverableId: string) => {
    if (!window.confirm('Delete this deliverable?')) return;

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      const updatedDeliverables = deliverables.filter((d) => d.id !== deliverableId);

      await updateDoc(projectRef, {
        'charter.deliverables': updatedDeliverables,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } catch (err) {
      console.error('[ObjectivesPage] Error deleting deliverable:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete deliverable');
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const objectiveStats = {
    total: objectives.length,
    achieved: objectives.filter((o) => o.status === 'ACHIEVED').length,
    inProgress: objectives.filter((o) => o.status === 'IN_PROGRESS').length,
    atRisk: objectives.filter((o) => o.status === 'AT_RISK').length,
  };

  const deliverableStats = {
    total: deliverables.length,
    accepted: deliverables.filter((d) => d.status === 'ACCEPTED').length,
    submitted: deliverables.filter((d) => d.status === 'SUBMITTED').length,
    pending: deliverables.filter((d) => d.status === 'PENDING' || d.status === 'IN_PROGRESS')
      .length,
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FlagIcon color="primary" />
                <Typography variant="h6">Objectives Summary</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4">{objectiveStats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total
                  </Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4" color="success.main">
                    {objectiveStats.achieved}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Achieved
                  </Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4" color="primary.main">
                    {objectiveStats.inProgress}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    In Progress
                  </Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4" color="error.main">
                    {objectiveStats.atRisk}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    At Risk
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CheckIcon color="success" />
                <Typography variant="h6">Deliverables Summary</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4">{deliverableStats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total
                  </Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4" color="success.main">
                    {deliverableStats.accepted}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Accepted
                  </Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4" color="primary.main">
                    {deliverableStats.submitted}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Submitted
                  </Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="h4" color="warning.main">
                    {deliverableStats.pending}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Objectives Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Project Objectives</Typography>
          {hasManageAccess && (
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              size="small"
              onClick={() => {
                setEditingObjective(undefined);
                setObjectiveDialogOpen(true);
              }}
            >
              Add Objective
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />

        {objectives.length === 0 ? (
          <Alert severity="info">
            No objectives defined yet. Add objectives to define project goals.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {objectives.map((objective) => (
              <Grid size={{ xs: 12, md: 6 }} key={objective.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={objective.status.replace(/_/g, ' ')}
                          size="small"
                          color={getStatusColor(objective.status)}
                        />
                        <Chip
                          label={objective.priority}
                          size="small"
                          color={getPriorityColor(objective.priority)}
                          variant="outlined"
                        />
                      </Box>
                      {hasManageAccess && (
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingObjective(objective);
                              setObjectiveDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteObjective(objective.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {objective.description}
                    </Typography>
                    {objective.successCriteria && objective.successCriteria.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Success Criteria:
                        </Typography>
                        <List dense disablePadding>
                          {objective.successCriteria.map((criterion, idx) => (
                            <ListItem key={idx} disablePadding sx={{ pl: 1 }}>
                              <ListItemText
                                primary={`• ${criterion}`}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {objective.targetDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Target: {formatDate(objective.targetDate)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Deliverables Section */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Project Deliverables</Typography>
          {hasManageAccess && (
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              size="small"
              onClick={() => {
                setEditingDeliverable(undefined);
                setDeliverableDialogOpen(true);
              }}
            >
              Add Deliverable
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />

        {deliverables.length === 0 ? (
          <Alert severity="info">
            No deliverables defined yet. Add deliverables to track project outputs.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {deliverables.map((deliverable) => (
              <Grid size={{ xs: 12, md: 6 }} key={deliverable.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={deliverable.status.replace(/_/g, ' ')}
                          size="small"
                          color={getStatusColor(deliverable.status)}
                        />
                        <Chip label={deliverable.type} size="small" variant="outlined" />
                      </Box>
                      {hasManageAccess && (
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingDeliverable(deliverable);
                              setDeliverableDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDeliverable(deliverable.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {deliverable.name}
                    </Typography>
                    {deliverable.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {deliverable.description}
                      </Typography>
                    )}
                    {deliverable.acceptanceCriteria &&
                      deliverable.acceptanceCriteria.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Acceptance Criteria:
                          </Typography>
                          <List dense disablePadding>
                            {deliverable.acceptanceCriteria.map((criterion, idx) => (
                              <ListItem key={idx} disablePadding sx={{ pl: 1 }}>
                                <ListItemText
                                  primary={`• ${criterion}`}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}
                    {deliverable.dueDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Due: {formatDate(deliverable.dueDate)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Dialogs - Lazy loaded */}
      {objectiveDialogOpen && (
        <Suspense fallback={<DialogLoader />}>
          <ObjectiveFormDialog
            open={objectiveDialogOpen}
            onClose={() => {
              setObjectiveDialogOpen(false);
              setEditingObjective(undefined);
            }}
            objective={editingObjective}
            onSave={handleSaveObjective}
            loading={loading}
          />
        </Suspense>
      )}

      {deliverableDialogOpen && (
        <Suspense fallback={<DialogLoader />}>
          <DeliverableFormDialog
            open={deliverableDialogOpen}
            onClose={() => {
              setDeliverableDialogOpen(false);
              setEditingDeliverable(undefined);
            }}
            deliverable={editingDeliverable}
            onSave={handleSaveDeliverable}
            loading={loading}
          />
        </Suspense>
      )}
    </Box>
  );
}

export default function ObjectivesPageClient() {
  const { project, projectId, loading, error, hasViewAccess } = useProjectPage('objectives');

  return (
    <ProjectSubPageWrapper
      project={project}
      projectId={projectId}
      loading={loading}
      error={error}
      hasViewAccess={hasViewAccess}
      title="Objectives & Deliverables"
    >
      {project && <ObjectivesContent project={project} />}
    </ProjectSubPageWrapper>
  );
}

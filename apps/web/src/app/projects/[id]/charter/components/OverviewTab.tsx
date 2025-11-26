'use client';

import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import type { Project } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface OverviewTabProps {
  project: Project;
}

export function OverviewTab({ project }: OverviewTabProps) {
  const formatCurrency = (amount?: number, currency = 'INR') => {
    if (amount === undefined || amount === null) return 'Not set';
    return `${currency} ${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const progress = project.progress?.percentage || 0;
  const charterApproved = project.charter?.authorization?.approvalStatus === 'APPROVED';

  return (
    <Box>
      {/* Key Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Timeline Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CalendarIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Timeline
                </Typography>
              </Box>
              <Typography variant="body2" gutterBottom>
                <strong>Start:</strong> {formatDate(project.dates?.startDate)}
              </Typography>
              <Typography variant="body2">
                <strong>End:</strong> {formatDate(project.dates?.endDate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Budget Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MoneyIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Budget
                </Typography>
              </Box>
              <Typography variant="h6">
                {formatCurrency(project.budget?.estimated?.amount, project.budget?.currency)}
              </Typography>
              {project.budget?.actual && (
                <Typography variant="body2" color="text.secondary">
                  Actual: {formatCurrency(project.budget.actual.amount, project.budget.currency)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Team Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PeopleIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Team
                </Typography>
              </Box>
              <Typography variant="h6">{project.team?.length || 0} Members</Typography>
              <Typography variant="body2" color="text.secondary">
                PM: {project.projectManager?.userName}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AssignmentIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
              </Box>
              <Typography variant="h6">{progress}%</Typography>
              <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Project Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Project Details
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Project Code"
                    secondary={project.code}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Client"
                    secondary={project.client?.entityName}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      <Chip
                        label={project.status}
                        size="small"
                        color={
                          project.status === 'ACTIVE'
                            ? 'success'
                            : project.status === 'COMPLETED'
                              ? 'default'
                              : 'warning'
                        }
                      />
                    }
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Priority"
                    secondary={
                      <Chip
                        label={project.priority}
                        size="small"
                        color={
                          project.priority === 'CRITICAL' || project.priority === 'HIGH'
                            ? 'error'
                            : project.priority === 'MEDIUM'
                              ? 'warning'
                              : 'default'
                        }
                      />
                    }
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  />
                </ListItem>
                {project.location && (
                  <ListItem>
                    <ListItemText
                      primary="Location"
                      secondary={project.location}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                )}
                {project.projectType && (
                  <ListItem>
                    <ListItemText
                      primary="Project Type"
                      secondary={project.projectType.replace(/_/g, ' ')}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Charter Status */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Charter Status
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {project.charter ? (
                <Box>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Authorization Status"
                        secondary={
                          <Chip
                            label={project.charter.authorization.approvalStatus}
                            size="small"
                            color={charterApproved ? 'success' : 'warning'}
                          />
                        }
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Sponsor"
                        secondary={project.charter.authorization.sponsorName}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Objectives"
                        secondary={`${project.charter.objectives?.length || 0} defined`}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Deliverables"
                        secondary={`${project.charter.deliverables?.length || 0} defined`}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Risks"
                        secondary={`${project.charter.risks?.length || 0} identified`}
                        primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  </List>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No charter has been created for this project yet. Navigate to the Charter tab to
                  create one.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Additional Module Data */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Procurement & Vendors
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Procurement Items"
                    secondary={`${project.procurementItems?.length || 0} items planned`}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Outsourcing Vendors"
                    secondary={`${project.vendors?.length || 0} vendors assigned`}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Documents */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Documentation
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Required Documents"
                    secondary={`${project.documentRequirements?.length || 0} documents tracked`}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Submitted"
                    secondary={`${
                      project.documentRequirements?.filter((d) => d.status !== 'NOT_SUBMITTED')
                        .length || 0
                    } submitted`}
                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

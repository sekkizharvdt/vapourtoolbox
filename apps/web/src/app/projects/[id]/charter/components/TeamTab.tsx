'use client';

import { memo, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Alert,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Group as GroupIcon,
  Star as StarIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
} from '@mui/icons-material';
import type { Project, ProjectMember } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface TeamTabProps {
  project: Project;
}

export const TeamTab = memo(function TeamTab({ project }: TeamTabProps) {
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getStringColor = (str: string): string => {
    const colors = [
      '#1976d2',
      '#388e3c',
      '#d32f2f',
      '#7b1fa2',
      '#f57c00',
      '#0288d1',
      '#c2185b',
      '#5d4037',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length] || '#1976d2';
  };

  // Memoize computed team data for performance
  const { activeMembers, inactiveMembers, totalMembers, roleCount, membersByRole } = useMemo(() => {
    const active = project.team?.filter((m) => m.isActive) || [];
    const inactive = project.team?.filter((m) => !m.isActive) || [];
    const total = project.team?.length || 0;
    const roles = new Set(project.team?.map((m) => m.role) || []);

    // Group members by role
    const byRole: Record<string, ProjectMember[]> = {};
    (project.team || []).forEach((member) => {
      const role = member.role;
      if (!byRole[role]) {
        byRole[role] = [];
      }
      byRole[role].push(member);
    });

    return {
      activeMembers: active,
      inactiveMembers: inactive,
      totalMembers: total,
      roleCount: roles.size,
      membersByRole: byRole,
    };
  }, [project.team]);

  return (
    <Box>
      {/* Team Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Members
              </Typography>
              <Typography variant="h4">{totalMembers + 1}</Typography>
              <Typography variant="caption">including PM</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: 'success.light' }}>
            <CardContent>
              <Typography variant="body2" gutterBottom>
                Active Members
              </Typography>
              <Typography variant="h4">{activeMembers.length + 1}</Typography>
              <Typography variant="caption">currently working</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Unique Roles
              </Typography>
              <Typography variant="h4">{roleCount + 1}</Typography>
              <Typography variant="caption">distinct positions</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: inactiveMembers.length > 0 ? 'warning.light' : undefined }}>
            <CardContent>
              <Typography variant="body2" gutterBottom>
                Inactive Members
              </Typography>
              <Typography variant="h4">{inactiveMembers.length}</Typography>
              <Typography variant="caption">no longer on project</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Project Manager Card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <StarIcon color="primary" />
          <Typography variant="h6">Project Manager</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: getStringColor(project.projectManager?.userName || ''),
              width: 56,
              height: 56,
              fontSize: 20,
            }}
          >
            {getInitials(project.projectManager?.userName || 'PM')}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">
              {project.projectManager?.userName || 'Not assigned'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Project Manager
            </Typography>
            <Chip label="Project Lead" size="small" color="primary" sx={{ mt: 1 }} />
          </Box>
        </Box>
      </Paper>

      {/* Team Members Table */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <GroupIcon />
          <Typography variant="h6">Team Members</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {project.team && project.team.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Member</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Assigned Date</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {project.team.map((member) => (
                  <TableRow key={member.userId} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          sx={{
                            bgcolor: getStringColor(member.userName),
                            width: 40,
                            height: 40,
                          }}
                        >
                          {getInitials(member.userName)}
                        </Avatar>
                        <Typography variant="body2" fontWeight="medium">
                          {member.userName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={member.role} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(member.assignedAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      {member.isActive ? (
                        <Chip icon={<ActiveIcon />} label="Active" size="small" color="success" />
                      ) : (
                        <Chip
                          icon={<InactiveIcon />}
                          label="Inactive"
                          size="small"
                          color="default"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No team members assigned yet.
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Team Breakdown by Role */}
      {Object.keys(membersByRole).length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Team Breakdown by Role
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            {Object.entries(membersByRole).map(([role, members]) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={role}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {role}
                    </Typography>
                    <Typography variant="h5">{members.length}</Typography>
                    <Typography variant="caption">
                      {members.filter((m) => m.isActive).length} active
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Future Enhancements Note */}
      <Alert severity="info">
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Team Management Enhancements
        </Typography>
        <Typography variant="body2">
          Future enhancements will include: Add/remove team members, assign roles and permissions,
          track member availability, workload management, performance tracking, and activity logs.
          Team management is currently configured at the project level through the projects list
          page.
        </Typography>
      </Alert>
    </Box>
  );
});

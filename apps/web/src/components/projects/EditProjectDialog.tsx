'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Alert,
  CircularProgress,
  Autocomplete,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  doc,
  Timestamp,
  collection,
  query,
  orderBy,
  getDocs,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  Project,
  ProjectStatus,
  ProjectPriority,
  BusinessEntity,
  ProjectMember,
} from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';

interface EditProjectDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption {
  userId: string;
  userName: string;
  email: string;
}

export function EditProjectDialog({ open, project, onClose, onSuccess }: EditProjectDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PROPOSAL');
  const [priority, setPriority] = useState<ProjectPriority>('MEDIUM');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Client selection
  const [clients, setClients] = useState<BusinessEntity[]>([]);
  const [selectedClient, setSelectedClient] = useState<BusinessEntity | null>(null);
  const [clientsLoading, setClientsLoading] = useState(true);

  // Project manager selection
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedPM, setSelectedPM] = useState<UserOption | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);

  // Team members
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<UserOption | null>(null);
  const [teamMemberRole, setTeamMemberRole] = useState('');

  // Pre-populate form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setStatus(project.status);
      setPriority(project.priority);

      // Handle dates
      if (project.dates.startDate) {
        try {
          const date = project.dates.startDate.toDate();
          setStartDate(date.toISOString().split('T')[0] || '');
        } catch {
          setStartDate('');
        }
      } else {
        setStartDate('');
      }

      if (project.dates.endDate) {
        try {
          const date = project.dates.endDate.toDate();
          setEndDate(date.toISOString().split('T')[0] || '');
        } catch {
          setEndDate('');
        }
      } else {
        setEndDate('');
      }

      // Load existing team members
      setTeamMembers(project.team || []);
    }
  }, [project]);

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      try {
        const { db } = getFirebase();
        const entitiesRef = collection(db, COLLECTIONS.ENTITIES);
        const q = query(
          entitiesRef,
          where('roles', 'array-contains', 'CUSTOMER'),
          where('isActive', '==', true),
          orderBy('name')
        );
        const snapshot = await getDocs(q);
        const clientsList: BusinessEntity[] = [];
        snapshot.forEach((doc) => {
          clientsList.push({ ...doc.data(), id: doc.id } as BusinessEntity);
        });
        setClients(clientsList);

        // Set selected client if editing
        if (project) {
          const client = clientsList.find((c) => c.id === project.client.entityId);
          setSelectedClient(client || null);
        }
      } catch (err) {
        console.error('Error loading clients:', err);
      } finally {
        setClientsLoading(false);
      }
    };

    if (open) {
      loadClients();
    }
  }, [open, project]);

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { db } = getFirebase();
        const usersRef = collection(db, COLLECTIONS.USERS);
        const q = query(
          usersRef,
          where('domain', '==', 'internal'),
          where('isActive', '==', true),
          orderBy('displayName')
        );
        const snapshot = await getDocs(q);
        const usersList: UserOption[] = [];
        snapshot.forEach((doc) => {
          const userData = doc.data();
          usersList.push({
            userId: doc.id,
            userName: userData.displayName || userData.email,
            email: userData.email,
          });
        });
        setUsers(usersList);

        // Set selected PM if editing
        if (project) {
          const pm = usersList.find((u) => u.userId === project.projectManager.userId);
          setSelectedPM(pm || null);
        }
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setUsersLoading(false);
      }
    };

    if (open) {
      loadUsers();
    }
  }, [open, project]);

  // Add team member
  const handleAddTeamMember = () => {
    if (!selectedTeamMember) {
      setError('Please select a team member');
      return;
    }

    if (!teamMemberRole.trim()) {
      setError('Please enter a role for the team member');
      return;
    }

    // Check if member already exists
    if (teamMembers.some((m) => m.userId === selectedTeamMember.userId)) {
      setError('This user is already a team member');
      return;
    }

    // Check if trying to add the PM as a team member
    if (selectedPM && selectedTeamMember.userId === selectedPM.userId) {
      setError('Project Manager is already part of the project');
      return;
    }

    const newMember: ProjectMember = {
      userId: selectedTeamMember.userId,
      userName: selectedTeamMember.userName,
      role: teamMemberRole.trim(),
      assignedAt: Timestamp.now(),
      isActive: true,
    };

    setTeamMembers([...teamMembers, newMember]);
    setSelectedTeamMember(null);
    setTeamMemberRole('');
    setError('');
  };

  // Remove team member
  const handleRemoveTeamMember = (userId: string) => {
    setTeamMembers(teamMembers.filter((m) => m.userId !== userId));
  };

  const handleSubmit = async () => {
    if (!project) return;

    // Validation
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!selectedClient) {
      setError('Client is required');
      return;
    }

    if (!selectedPM) {
      setError('Project manager is required');
      return;
    }

    if (!startDate) {
      setError('Start date is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      // Prepare update data
      const updateData: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        priority,
        client: {
          entityId: selectedClient.id,
          entityName: selectedClient.name,
          contactPerson: selectedClient.contactPerson || '',
          contactEmail: selectedClient.email || '',
          contactPhone: selectedClient.phone || '',
        },
        projectManager: {
          userId: selectedPM.userId,
          userName: selectedPM.userName,
        },
        team: teamMembers,
        dates: {
          ...project.dates,
          startDate: Timestamp.fromDate(new Date(startDate)),
          endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
        },
        updatedAt: Timestamp.now(),
        updatedBy: user?.uid || '',
      };

      // Use batch to update project and users' assignedProjects atomically
      const batch = writeBatch(db);

      // Update project document
      batch.update(projectRef, updateData);

      // Determine which users were added or removed from the team
      const oldTeamUserIds = new Set((project.team || []).map((m) => m.userId));
      const newTeamUserIds = new Set(teamMembers.map((m) => m.userId));

      // Users to add to assignedProjects
      const addedUsers = teamMembers.filter((m) => !oldTeamUserIds.has(m.userId));
      for (const member of addedUsers) {
        const userRef = doc(db, COLLECTIONS.USERS, member.userId);
        batch.update(userRef, {
          assignedProjects: arrayUnion(project.id),
        });
      }

      // Users to remove from assignedProjects
      const removedUserIds = [...oldTeamUserIds].filter((id) => !newTeamUserIds.has(id));
      for (const userId of removedUserIds) {
        const userRef = doc(db, COLLECTIONS.USERS, userId);
        batch.update(userRef, {
          assignedProjects: arrayRemove(project.id),
        });
      }

      // Check if PM changed and update their assignedProjects
      if (project.projectManager.userId !== selectedPM.userId) {
        // Remove project from old PM
        const oldPMRef = doc(db, COLLECTIONS.USERS, project.projectManager.userId);
        batch.update(oldPMRef, {
          assignedProjects: arrayRemove(project.id),
        });

        // Add project to new PM
        const newPMRef = doc(db, COLLECTIONS.USERS, selectedPM.userId);
        batch.update(newPMRef, {
          assignedProjects: arrayUnion(project.id),
        });
      }

      await batch.commit();

      onSuccess();
    } catch (err) {
      console.error('Error updating project:', err);
      setError('Failed to update project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Project</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Project Name */}
          <TextField
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />

          {/* Status and Priority */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth required>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <MenuItem value="PROPOSAL">Proposal</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="ON_HOLD">On Hold</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as ProjectPriority)}
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Client Selection */}
          {clientsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <span>Loading clients...</span>
            </Box>
          ) : (
            <Autocomplete
              options={clients}
              getOptionLabel={(option) => option.name}
              value={selectedClient}
              onChange={(_, newValue) => setSelectedClient(newValue)}
              renderInput={(params) => <TextField {...params} label="Client" required />}
              fullWidth
            />
          )}

          {/* Project Manager Selection */}
          {usersLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <span>Loading users...</span>
            </Box>
          ) : (
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.userName} (${option.email})`}
              value={selectedPM}
              onChange={(_, newValue) => setSelectedPM(newValue)}
              renderInput={(params) => <TextField {...params} label="Project Manager" required />}
              fullWidth
            />
          )}

          {/* Team Members Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Team Members
            </Typography>

            {/* Add Team Member Form */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Autocomplete
                options={users}
                getOptionLabel={(option) => `${option.userName} (${option.email})`}
                value={selectedTeamMember}
                onChange={(_, newValue) => setSelectedTeamMember(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Team Member" size="small" />
                )}
                sx={{ flex: 2 }}
                disabled={usersLoading}
              />
              <TextField
                label="Role"
                value={teamMemberRole}
                onChange={(e) => setTeamMemberRole(e.target.value)}
                size="small"
                placeholder="e.g., Engineer, Site Engineer"
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                onClick={handleAddTeamMember}
                disabled={!selectedTeamMember || !teamMemberRole.trim()}
              >
                Add
              </Button>
            </Box>

            {/* Team Members Table */}
            {teamMembers.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Name</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Role</strong>
                      </TableCell>
                      <TableCell align="center">
                        <strong>Actions</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell>{member.userName}</TableCell>
                        <TableCell>{member.role}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveTeamMember(member.userId)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                No team members added yet. Use the form above to add team members to this project.
              </Alert>
            )}
          </Box>

          {/* Dates */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || clientsLoading || usersLoading}
        >
          {loading ? 'Updating...' : 'Update Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

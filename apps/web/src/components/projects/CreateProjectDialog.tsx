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
import { collection, addDoc, Timestamp, query, orderBy, limit as firestoreLimit, getDocs, where, writeBatch, doc, arrayUnion } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { ProjectStatus, ProjectPriority, BusinessEntity, ProjectMember } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption {
  userId: string;
  userName: string;
  email: string;
}

export function CreateProjectDialog({ open, onClose, onSuccess }: CreateProjectDialogProps) {
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

  // Load clients (entities with CUSTOMER role)
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
      } catch (err) {
        console.error('Error loading clients:', err);
      } finally {
        setClientsLoading(false);
      }
    };

    if (open) {
      loadClients();
    }
  }, [open]);

  // Load users for project manager selection
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
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setUsersLoading(false);
      }
    };

    if (open) {
      loadUsers();
    }
  }, [open]);

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
    if (teamMembers.some(m => m.userId === selectedTeamMember.userId)) {
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
    setTeamMembers(teamMembers.filter(m => m.userId !== userId));
  };

  // Generate next project code
  const generateProjectCode = async (): Promise<string> => {
    const { db } = getFirebase();
    const projectsRef = collection(db, COLLECTIONS.PROJECTS);
    const q = query(projectsRef, orderBy('code', 'desc'), firestoreLimit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty || !snapshot.docs[0]) {
      return 'PRJ-001';
    }

    const lastProject = snapshot.docs[0].data();
    const lastCode = (lastProject?.code as string) || 'PRJ-000';
    const codeParts = lastCode.split('-');
    const lastNumber = parseInt(codeParts[1] || '0');
    const nextNumber = lastNumber + 1;
    return `PRJ-${nextNumber.toString().padStart(3, '0')}`;
  };

  const handleSubmit = async () => {
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
      const projectsRef = collection(db, COLLECTIONS.PROJECTS);

      // Generate project code
      const code = await generateProjectCode();

      // Prepare project data
      const projectData = {
        code,
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
          startDate: Timestamp.fromDate(new Date(startDate)),
          endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
        },
        ownerId: user?.uid || '',
        visibility: 'company' as const,
        isActive: true,
        isDeleted: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user?.uid || '',
        updatedBy: user?.uid || '',
      };

      // Create project and update users' assignedProjects atomically
      const docRef = await addDoc(projectsRef, projectData);
      const projectId = docRef.id;

      // Use batch to update all team members' assignedProjects
      const batch = writeBatch(db);

      // Add project to PM's assignedProjects
      const pmRef = doc(db, COLLECTIONS.USERS, selectedPM.userId);
      batch.update(pmRef, {
        assignedProjects: arrayUnion(projectId),
      });

      // Add project to each team member's assignedProjects
      for (const member of teamMembers) {
        const userRef = doc(db, COLLECTIONS.USERS, member.userId);
        batch.update(userRef, {
          assignedProjects: arrayUnion(projectId),
        });
      }

      await batch.commit();

      // Reset form
      setName('');
      setDescription('');
      setStatus('PROPOSAL');
      setPriority('MEDIUM');
      setStartDate('');
      setEndDate('');
      setSelectedClient(null);
      setSelectedPM(null);
      setTeamMembers([]);
      setSelectedTeamMember(null);
      setTeamMemberRole('');

      onSuccess();
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Project</DialogTitle>
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
            autoFocus
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
              renderInput={(params) => (
                <TextField {...params} label="Client" required />
              )}
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
              renderInput={(params) => (
                <TextField {...params} label="Project Manager" required />
              )}
              fullWidth
            />
          )}

          {/* Team Members Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Team Members (Optional)
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
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell><strong>Role</strong></TableCell>
                      <TableCell align="center"><strong>Actions</strong></TableCell>
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
                No team members added yet. You can add team members now or edit the project later to add them.
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
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

'use client';

/**
 * New Meeting Page — Two-step MoM creation
 *
 * Step 1: Meeting details (title, date, attendees, agenda)
 * Step 2: Action items table (Description | Action | Responsible Person | Due Date)
 *
 * "Save as Draft" saves at any point. "Finalize" creates ManualTasks from action items.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Alert,
  Breadcrumbs,
  Link,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
  CheckCircle as FinalizeIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { createMeeting, addActionItem, finalizeMeeting } from '@/lib/tasks/meetingService';
import { COLLECTIONS } from '@vapour/firebase';
import type { ManualTaskPriority } from '@vapour/types';

interface UserOption {
  uid: string;
  displayName: string;
  department?: string;
  photoURL?: string;
}

interface ActionRow {
  key: string;
  description: string;
  action: string;
  assignee: UserOption | null;
  dueDate: string;
  priority: ManualTaskPriority;
}

const STEPS = ['Meeting Details', 'Action Items'];

let rowCounter = 0;
function newRow(): ActionRow {
  return {
    key: `row-${++rowCounter}`,
    description: '',
    action: '',
    assignee: null,
    dueDate: '',
    priority: 'MEDIUM',
  };
}

export default function NewMeetingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const entityId = claims?.entityId || 'default-entity';

  // Step
  const [activeStep, setActiveStep] = useState(0);

  // Step 1 — Meeting details
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<UserOption[]>([]);
  const [agenda, setAgenda] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2 — Action items
  const [rows, setRows] = useState<ActionRow[]>([newRow()]);

  // Users list
  const [users, setUsers] = useState<UserOption[]>([]);

  // State
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active users
  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      orderBy('displayName', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserOption[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          uid: doc.id,
          displayName: data.displayName || data.email || 'Unknown',
          department: data.department,
          photoURL: data.photoURL,
        });
      });
      setUsers(list);
    });

    return () => unsubscribe();
  }, [db]);

  // Validation
  const step1Valid = title.trim() && meetingDate && attendees.length > 0;

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, newRow()]);
  }, []);

  const handleRemoveRow = useCallback((key: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.key !== key);
    });
  }, []);

  const handleRowChange = useCallback(
    (key: string, field: keyof ActionRow, value: ActionRow[keyof ActionRow]) => {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    },
    []
  );

  const handleSaveDraft = async () => {
    if (!db || !user) return;

    try {
      setSaving(true);
      setError(null);

      const meeting = await createMeeting(
        db,
        {
          title: title.trim(),
          date: Timestamp.fromDate(new Date(meetingDate)),
          ...(duration ? { duration: parseInt(duration) } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          attendeeIds: attendees.map((a) => a.uid),
          attendeeNames: attendees.map((a) => a.displayName),
          ...(agenda.trim() ? { agenda: agenda.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        user.uid,
        user.displayName || user.email || 'Unknown',
        entityId
      );

      // Save action items that have content
      const validRows = rows.filter((r) => r.action.trim() && r.assignee);
      for (const row of validRows) {
        await addActionItem(db, meeting.id, {
          description: row.description.trim(),
          action: row.action.trim(),
          assigneeId: row.assignee!.uid,
          assigneeName: row.assignee!.displayName,
          ...(row.dueDate ? { dueDate: Timestamp.fromDate(new Date(row.dueDate)) } : {}),
          priority: row.priority,
        });
      }

      toast.success('Meeting saved as draft');
      router.push(`/flow/meetings/${meeting.id}`);
    } catch (err) {
      console.error('[NewMeeting] Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save meeting');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!db || !user) return;

    try {
      setSaving(true);
      setError(null);

      // Create meeting
      const meeting = await createMeeting(
        db,
        {
          title: title.trim(),
          date: Timestamp.fromDate(new Date(meetingDate)),
          ...(duration ? { duration: parseInt(duration) } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          attendeeIds: attendees.map((a) => a.uid),
          attendeeNames: attendees.map((a) => a.displayName),
          ...(agenda.trim() ? { agenda: agenda.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        user.uid,
        user.displayName || user.email || 'Unknown',
        entityId
      );

      // Save all action items
      const validRows = rows.filter((r) => r.action.trim() && r.assignee);
      for (const row of validRows) {
        await addActionItem(db, meeting.id, {
          description: row.description.trim(),
          action: row.action.trim(),
          assigneeId: row.assignee!.uid,
          assigneeName: row.assignee!.displayName,
          ...(row.dueDate ? { dueDate: Timestamp.fromDate(new Date(row.dueDate)) } : {}),
          priority: row.priority,
        });
      }

      // Finalize — creates ManualTasks
      const taskCount = await finalizeMeeting(
        db,
        meeting.id,
        user.uid,
        user.displayName || user.email || 'Unknown',
        entityId
      );

      toast.success(`Meeting finalized — ${taskCount} task${taskCount !== 1 ? 's' : ''} created`);
      router.push(`/flow/meetings/${meeting.id}`);
    } catch (err) {
      console.error('[NewMeeting] Finalize failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to finalize meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/flow"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/flow');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Flow
        </Link>
        <Link
          color="inherit"
          href="/flow/meetings"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/flow/meetings');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Meeting Minutes
        </Link>
        <Typography color="text.primary">New Meeting</Typography>
      </Breadcrumbs>

      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        New Meeting
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Step 1: Meeting Details */}
      {activeStep === 0 && (
        <Stack spacing={2.5} sx={{ maxWidth: 600 }}>
          <TextField
            label="Meeting Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            autoFocus
            disabled={saving}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Date"
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              disabled={saving}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Duration (min)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={saving}
              sx={{ width: 140 }}
            />
          </Box>

          <TextField
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            fullWidth
            disabled={saving}
          />

          <Autocomplete
            multiple
            options={users}
            value={attendees}
            onChange={(_, val) => setAttendees(val)}
            getOptionLabel={(o) => o.displayName}
            isOptionEqualToValue={(o, v) => o.uid === v.uid}
            disabled={saving}
            renderOption={(props, option) => {
              const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & {
                key: string;
              };
              return (
                <li key={key} {...rest}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={option.photoURL} sx={{ width: 28, height: 28, fontSize: 14 }}>
                      {option.displayName.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{option.displayName}</Typography>
                      {option.department && (
                        <Typography variant="caption" color="text.secondary">
                          {option.department}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </li>
              );
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    avatar={
                      <Avatar src={option.photoURL} sx={{ width: 24, height: 24 }}>
                        {option.displayName.charAt(0)}
                      </Avatar>
                    }
                    label={option.displayName}
                    size="small"
                    {...tagProps}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField {...params} label="Attendees" required placeholder="Select attendees..." />
            )}
          />

          <TextField
            label="Agenda"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            fullWidth
            multiline
            rows={3}
            disabled={saving}
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            disabled={saving}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => router.push('/flow/meetings')} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              endIcon={<NextIcon />}
              onClick={() => setActiveStep(1)}
              disabled={!step1Valid || saving}
            >
              Next: Action Items
            </Button>
          </Box>
        </Stack>
      )}

      {/* Step 2: Action Items Table */}
      {activeStep === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add discussion points and action items. Each row with an Action and Responsible Person
            will become a task when finalized.
          </Typography>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 200 }}>Description</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Action</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Responsible Person</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Due Date</TableCell>
                  <TableCell sx={{ minWidth: 110 }}>Priority</TableCell>
                  <TableCell sx={{ width: 50 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="What was discussed..."
                        value={row.description}
                        onChange={(e) => handleRowChange(row.key, 'description', e.target.value)}
                        fullWidth
                        multiline
                        maxRows={3}
                        disabled={saving}
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Action to take..."
                        value={row.action}
                        onChange={(e) => handleRowChange(row.key, 'action', e.target.value)}
                        fullWidth
                        multiline
                        maxRows={3}
                        disabled={saving}
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <Autocomplete
                        size="small"
                        options={attendees.length > 0 ? attendees : users}
                        value={row.assignee}
                        onChange={(_, val) => handleRowChange(row.key, 'assignee', val)}
                        getOptionLabel={(o) => o.displayName}
                        isOptionEqualToValue={(o, v) => o.uid === v.uid}
                        disabled={saving}
                        renderInput={(params) => (
                          <TextField {...params} variant="standard" placeholder="Select..." />
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => handleRowChange(row.key, 'dueDate', e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        disabled={saving}
                        variant="standard"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth variant="standard">
                        <Select
                          value={row.priority}
                          onChange={(e) =>
                            handleRowChange(
                              row.key,
                              'priority',
                              e.target.value as ManualTaskPriority
                            )
                          }
                          disabled={saving}
                        >
                          <MenuItem value="LOW">Low</MenuItem>
                          <MenuItem value="MEDIUM">Medium</MenuItem>
                          <MenuItem value="HIGH">High</MenuItem>
                          <MenuItem value="URGENT">Urgent</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveRow(row.key)}
                        disabled={rows.length <= 1 || saving}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Button startIcon={<AddIcon />} onClick={handleAddRow} disabled={saving} sx={{ mb: 3 }}>
            Add Row
          </Button>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button startIcon={<BackIcon />} onClick={() => setActiveStep(0)} disabled={saving}>
              Back
            </Button>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={handleSaveDraft}
                disabled={saving || !step1Valid}
              >
                {saving ? 'Saving...' : 'Save as Draft'}
              </Button>
              <Button
                variant="contained"
                startIcon={<FinalizeIcon />}
                onClick={handleFinalize}
                disabled={saving || !step1Valid || !rows.some((r) => r.action.trim() && r.assignee)}
              >
                {saving ? 'Finalizing...' : 'Finalize'}
              </Button>
            </Stack>
          </Box>
        </Box>
      )}
    </Box>
  );
}

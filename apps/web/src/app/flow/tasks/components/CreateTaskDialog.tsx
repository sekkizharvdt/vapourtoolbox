'use client';

/**
 * Create Task Dialog
 *
 * Form dialog for creating a new manual task.
 * Includes title, description, assignee picker, priority, and due date.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Typography,
} from '@mui/material';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { createManualTask } from '@/lib/tasks/manualTaskService';
import { COLLECTIONS } from '@vapour/firebase';
import { Timestamp } from 'firebase/firestore';
import type { ManualTaskPriority } from '@vapour/types';

interface UserOption {
  uid: string;
  displayName: string;
  department?: string;
  photoURL?: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTaskDialog({ open, onClose, onCreated }: CreateTaskDialogProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<UserOption | null>(null);
  const [priority, setPriority] = useState<ManualTaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Users for assignee picker
  const [users, setUsers] = useState<UserOption[]>([]);

  const entityId = claims?.entityId || 'default-entity';

  // Load active users
  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      orderBy('displayName', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
      },
      () => {
        // Silently handle — users list will be empty
      }
    );

    return () => unsubscribe();
  }, [db]);

  // Default assignee to self when dialog opens
  useEffect(() => {
    if (open && user && users.length > 0) {
      const self = users.find((u) => u.uid === user.uid);
      if (self) setAssignee(self);
    }
  }, [open, user, users]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setAssignee(null);
      setPriority('MEDIUM');
      setDueDate('');
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!db || !user || !assignee) return;

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await createManualTask(
        db,
        {
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeId: assignee.uid,
          assigneeName: assignee.displayName,
          priority,
          dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : undefined,
        },
        user.uid,
        user.displayName || user.email || 'Unknown',
        entityId
      );

      toast.success('Task created');
      onCreated();
      onClose();
    } catch (err) {
      console.error('[CreateTaskDialog] Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Task</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            autoFocus
            disabled={saving}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            disabled={saving}
          />

          <Autocomplete
            options={users}
            value={assignee}
            onChange={(_, val) => setAssignee(val)}
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
            renderInput={(params) => <TextField {...params} label="Assignee" required />}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 140 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ManualTaskPriority)}
                label="Priority"
                disabled={saving}
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="URGENT">Urgent</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flexGrow: 1 }}
              disabled={saving}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !title.trim() || !assignee}
        >
          {saving ? 'Creating...' : 'Create Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

'use client';

/**
 * Create Master Document Dialog
 *
 * Form dialog for creating new master document entries
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { DisciplineCode } from '@vapour/types';
import { createMasterDocument } from '@/lib/documents/masterDocumentService';
import {
  getActiveDisciplineCodes,
  getNumberingConfig,
  generateDocumentNumber,
} from '@/lib/documents/documentNumberingService';
import { useAuth } from '@/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface CreateDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onDocumentCreated: () => void;
}

export default function CreateDocumentDialog({
  open,
  onClose,
  projectId,
  onDocumentCreated,
}: CreateDocumentDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [disciplineCode, setDisciplineCode] = useState('');
  const [subCode, setSubCode] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [visibility, setVisibility] = useState<'CLIENT_VISIBLE' | 'INTERNAL_ONLY'>('CLIENT_VISIBLE');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  // Discipline codes
  const [disciplines, setDisciplines] = useState<DisciplineCode[]>([]);
  const [projectCode, setProjectCode] = useState<string>('');
  const [previewNumber, setPreviewNumber] = useState<string>('');

  useEffect(() => {
    if (open && projectId) {
      loadDisciplines();
      loadProjectConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  useEffect(() => {
    if (disciplineCode && projectCode) {
      updatePreviewNumber();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disciplineCode, subCode, projectCode]);

  const loadDisciplines = async () => {
    try {
      const data = await getActiveDisciplineCodes(projectId);
      setDisciplines(data);
    } catch (err) {
      console.error('[CreateDocumentDialog] Error loading disciplines:', err);
    }
  };

  const loadProjectConfig = async () => {
    try {
      const config = await getNumberingConfig(projectId);
      if (config) {
        // Extract project code from a sample document or from config
        // For now, we'll use the projectId prefix
        setProjectCode(projectId.substring(0, 7).toUpperCase());
      }
    } catch (err) {
      console.error('[CreateDocumentDialog] Error loading config:', err);
    }
  };

  const updatePreviewNumber = async () => {
    try {
      const number = await generateDocumentNumber(
        projectId,
        projectCode,
        disciplineCode,
        subCode || undefined
      );
      setPreviewNumber(number);
    } catch (err) {
      console.error('[CreateDocumentDialog] Error generating preview:', err);
      setPreviewNumber('');
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!disciplineCode) {
      setError('Discipline code is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate document number
      const documentNumber = await generateDocumentNumber(
        projectId,
        projectCode,
        disciplineCode,
        subCode || undefined
      );

      // Get discipline name
      const selectedDisc = disciplines.find((d) => d.code === disciplineCode);
      const disciplineName = selectedDisc?.name || disciplineCode;

      // Create master document
      const now = Timestamp.now();
      await createMasterDocument({
        projectId,
        projectCode,
        documentNumber,
        disciplineCode,
        disciplineName,
        subCode: subCode || undefined,
        sequenceNumber: documentNumber.split('-').pop() || '001',
        documentTitle: title,
        documentType: documentType || 'General',
        description: description || '',
        status: 'NOT_STARTED',
        currentRevision: 'R0',
        predecessors: [],
        successors: [],
        relatedDocuments: [],
        assignedTo,
        assignedToNames: [], // Would need to fetch user names
        assignedBy: user.uid,
        assignedByName: user.displayName || user.email || 'Unknown',
        assignedDate: now,
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : undefined,
        inputFiles: [],
        hasSupplyList: false,
        supplyItemCount: 0,
        hasWorkList: false,
        workItemCount: 0,
        visibility,
        submissionCount: 0,
        totalComments: 0,
        openComments: 0,
        resolvedComments: 0,
        progressPercentage: 0,
        priority: 'MEDIUM',
        tags: [],
        isDeleted: false,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Unknown',
      });

      // Reset form
      resetForm();
      onDocumentCreated();
    } catch (err) {
      console.error('[CreateDocumentDialog] Error creating document:', err);
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDisciplineCode('');
    setSubCode('');
    setDocumentType('');
    setVisibility('CLIENT_VISIBLE');
    setDueDate(null);
    setAssignedTo([]);
    setPreviewNumber('');
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const selectedDiscipline = disciplines.find((d) => d.code === disciplineCode);
  const availableSubCodes = selectedDiscipline?.subCodes || [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Master Document</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Document Number Preview */}
          {previewNumber && (
            <Alert severity="info">
              <Typography variant="body2">
                Document Number: <strong>{previewNumber}</strong>
              </Typography>
            </Alert>
          )}

          {/* Title */}
          <TextField
            label="Document Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            placeholder="e.g., Piping and Instrumentation Diagram"
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional description of the document"
          />

          {/* Discipline Code */}
          <FormControl required fullWidth>
            <InputLabel>Discipline Code</InputLabel>
            <Select
              value={disciplineCode}
              onChange={(e) => {
                setDisciplineCode(e.target.value);
                setSubCode(''); // Reset sub-code when discipline changes
              }}
              label="Discipline Code"
            >
              {disciplines.map((disc) => (
                <MenuItem key={disc.code} value={disc.code}>
                  {disc.code} - {disc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sub-Code (if available for selected discipline) */}
          {availableSubCodes.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Sub-Code (Optional)</InputLabel>
              <Select
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                label="Sub-Code (Optional)"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {availableSubCodes.map((subCodeObj) => (
                  <MenuItem key={subCodeObj.subCode} value={subCodeObj.subCode}>
                    {subCodeObj.subCode} - {subCodeObj.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Document Type */}
          <TextField
            label="Document Type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            fullWidth
            placeholder="e.g., Drawing, Calculation, Specification"
          />

          {/* Visibility */}
          <FormControl fullWidth>
            <InputLabel>Visibility</InputLabel>
            <Select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as 'CLIENT_VISIBLE' | 'INTERNAL_ONLY')
              }
              label="Visibility"
            >
              <MenuItem value="CLIENT_VISIBLE">Client Visible</MenuItem>
              <MenuItem value="INTERNAL_ONLY">Internal Only</MenuItem>
            </Select>
          </FormControl>

          {/* Due Date */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Due Date"
              value={dueDate}
              onChange={(newValue) => setDueDate(newValue as Date | null)}
              slotProps={{
                textField: {
                  fullWidth: true,
                },
              }}
            />
          </LocalizationProvider>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Creating...' : 'Create Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

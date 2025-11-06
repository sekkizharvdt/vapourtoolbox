'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { addDoc, updateDoc, doc, collection, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CostCentre, CurrencyCode } from '@vapour/types';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

interface CostCentreDialogProps {
  open: boolean;
  costCentre: CostCentre | null;
  onClose: () => void;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  projectId: string;
  budget: string;
  budgetCurrency: CurrencyCode;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  code: '',
  name: '',
  description: '',
  projectId: '',
  budget: '',
  budgetCurrency: 'INR',
  isActive: true,
};

export default function CostCentreDialog({ open, costCentre, onClose }: CostCentreDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form when dialog opens or costCentre changes
  useEffect(() => {
    if (open) {
      if (costCentre) {
        // Edit mode
        setFormData({
          code: costCentre.code,
          name: costCentre.name,
          description: costCentre.description || '',
          projectId: costCentre.projectId,
          budget: costCentre.budget ? costCentre.budget.toString() : '',
          budgetCurrency: (costCentre.budgetCurrency as CurrencyCode) || 'INR',
          isActive: costCentre.isActive,
        });
      } else {
        // Create mode - generate next code
        const generateCode = async () => {
          try {
            // TODO: Query existing cost centres to generate next code
            // For now, use timestamp-based code
            const timestamp = Date.now().toString().slice(-6);
            setFormData({ ...EMPTY_FORM, code: `CC-${timestamp}` });
          } catch (error) {
            console.error('Error generating code:', error);
            setFormData(EMPTY_FORM);
          }
        };
        generateCode();
      }
      setError('');
    }
  }, [open, costCentre]);

  const handleChange = (field: keyof FormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSwitchChange =
    (field: keyof FormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: event.target.checked,
      }));
    };

  const handleProjectChange = (projectId: string | null) => {
    setFormData((prev) => ({
      ...prev,
      projectId: projectId || '',
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.code.trim()) {
      setError('Code is required');
      return false;
    }
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.projectId) {
      setError('Project is required');
      return false;
    }
    if (formData.budget && parseFloat(formData.budget) < 0) {
      setError('Budget cannot be negative');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const budgetValue = formData.budget ? parseFloat(formData.budget) : undefined;

      if (costCentre) {
        // Update existing cost centre
        const docRef = doc(db, COLLECTIONS.COST_CENTRES, costCentre.id);
        await updateDoc(docRef, {
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          projectId: formData.projectId,
          budget: budgetValue || null,
          budgetCurrency: formData.budgetCurrency,
          isActive: formData.isActive,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid,
        });
      } else {
        // Create new cost centre
        await addDoc(collection(db, COLLECTIONS.COST_CENTRES), {
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          projectId: formData.projectId,
          budget: budgetValue || null,
          budgetCurrency: formData.budgetCurrency,
          currentSpend: 0,
          currentRevenue: 0,
          isActive: formData.isActive,
          createdAt: Timestamp.now(),
          createdBy: user.uid,
          updatedAt: Timestamp.now(),
        });
      }

      onClose();
    } catch (error) {
      console.error('[CostCentreDialog] Error saving cost centre:', error);
      setError(error instanceof Error ? error.message : 'Failed to save cost centre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{costCentre ? 'Edit Cost Centre' : 'Create Cost Centre'}</DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Code"
              value={formData.code}
              onChange={handleChange('code')}
              placeholder="CC-001"
              required
              disabled={!!costCentre} // Code cannot be changed after creation
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="Project Alpha - R&D"
              required
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={handleChange('description')}
              placeholder="Research and development costs for Project Alpha"
              multiline
              rows={2}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ProjectSelector
              value={formData.projectId}
              onChange={handleProjectChange}
              required
              label="Linked Project"
              helperText="Select the project this cost centre will track"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              fullWidth
              label="Budget"
              type="number"
              value={formData.budget}
              onChange={handleChange('budget')}
              placeholder="1000000"
              slotProps={{
                htmlInput: {
                  step: '0.01',
                  min: '0',
                },
              }}
              helperText="Optional: Set a budget limit for this cost centre"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="Currency"
              value={formData.budgetCurrency}
              onChange={handleChange('budgetCurrency')}
              select
              slotProps={{
                select: {
                  native: true,
                },
              }}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="SGD">SGD</option>
              <option value="AED">AED</option>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch checked={formData.isActive} onChange={handleSwitchChange('isActive')} />
              }
              label="Active"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : costCentre ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

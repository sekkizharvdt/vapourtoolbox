'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { listCalculations, deleteCalculation } from '@/lib/thermal/savedCalculationService';
import { useAuth } from '@/contexts/AuthContext';
import type { SavedCalculation } from '@vapour/types';

interface LoadCalculationDialogProps {
  open: boolean;
  onClose: () => void;
  onLoad: (inputs: Record<string, unknown>) => void;
  calculatorType?: SavedCalculation['calculatorType'];
}

export function LoadCalculationDialog({
  open,
  onClose,
  onLoad,
  calculatorType = 'NCG_PROPERTIES',
}: LoadCalculationDialogProps) {
  const { user } = useAuth();
  const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalculations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const results = await listCalculations(db, user.uid, calculatorType);
      setCalculations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user, calculatorType]);

  useEffect(() => {
    if (open) {
      fetchCalculations();
    }
  }, [open, fetchCalculations]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { db } = getFirebase();
      await deleteCalculation(db, user.uid, id);
      setCalculations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleSelect = (calc: SavedCalculation) => {
    onLoad(calc.inputs);
    onClose();
  };

  const formatDate = (date: Date) => {
    const raw = date;
    const d =
      raw && typeof raw === 'object' && 'toDate' in raw
        ? (raw as unknown as { toDate: () => Date }).toDate()
        : raw instanceof Date
          ? raw
          : new Date(raw as unknown as string);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Load Saved Calculation</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : calculations.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No saved calculations yet.
          </Typography>
        ) : (
          <List disablePadding>
            {calculations.map((calc) => (
              <ListItemButton key={calc.id} onClick={() => handleSelect(calc)}>
                <ListItemText primary={calc.name} secondary={formatDate(calc.createdAt)} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(calc.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

'use client';

import {
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  getAvailableFittings,
  FITTING_NAMES,
  type FittingType,
  type FittingCount,
} from '@/lib/thermal';

const AVAILABLE_FITTINGS = getAvailableFittings();

interface FittingsManagerProps {
  fittings: FittingCount[];
  setFittings: (fittings: FittingCount[]) => void;
  newFittingType: FittingType;
  setNewFittingType: (type: FittingType) => void;
}

export function FittingsManager({
  fittings,
  setFittings,
  newFittingType,
  setNewFittingType,
}: FittingsManagerProps) {
  // Add fitting
  const handleAddFitting = () => {
    const existing = fittings.find((f) => f.type === newFittingType);
    if (existing) {
      setFittings(
        fittings.map((f) => (f.type === newFittingType ? { ...f, count: f.count + 1 } : f))
      );
    } else {
      setFittings([...fittings, { type: newFittingType, count: 1 }]);
    }
  };

  // Update fitting count
  const handleFittingCountChange = (type: FittingType, count: number) => {
    if (count <= 0) {
      setFittings(fittings.filter((f) => f.type !== type));
    } else {
      setFittings(fittings.map((f) => (f.type === type ? { ...f, count } : f)));
    }
  };

  // Remove fitting
  const handleRemoveFitting = (type: FittingType) => {
    setFittings(fittings.filter((f) => f.type !== type));
  };

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Fittings
      </Typography>

      {/* Add Fitting */}
      <Stack direction="row" spacing={1} mb={2}>
        <FormControl fullWidth size="small">
          <InputLabel>Fitting Type</InputLabel>
          <Select
            value={newFittingType}
            label="Fitting Type"
            onChange={(e) => setNewFittingType(e.target.value as FittingType)}
          >
            {AVAILABLE_FITTINGS.map((f) => (
              <MenuItem key={f.type} value={f.type}>
                {f.name} (K={f.kFactor})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton color="primary" onClick={handleAddFitting}>
          <AddIcon />
        </IconButton>
      </Stack>

      {/* Fittings List */}
      {fittings.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fitting</TableCell>
                <TableCell align="center">Count</TableCell>
                <TableCell align="right">K</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {fittings.map((fitting) => (
                <TableRow key={fitting.type}>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{FITTING_NAMES[fitting.type]}</TableCell>
                  <TableCell align="center">
                    <TextField
                      type="number"
                      value={fitting.count}
                      onChange={(e) =>
                        handleFittingCountChange(fitting.type, parseInt(e.target.value) || 0)
                      }
                      size="small"
                      sx={{ width: 60 }}
                      inputProps={{ min: 0 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {(
                      AVAILABLE_FITTINGS.find((f) => f.type === fitting.type)?.kFactor ?? 0
                    ).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleRemoveFitting(fitting.type)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No fittings added
        </Typography>
      )}
    </Paper>
  );
}

'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Button,
  Paper,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

export interface EffectRow {
  id: string;
  pressure: string;
  flowToNext: string;
}

interface EffectInputTableProps {
  effects: EffectRow[];
  pressureUnitLabel: string;
  onEffectsChange: (effects: EffectRow[]) => void;
}

let nextId = 1;
function generateId(): string {
  return `effect-${nextId++}`;
}

export function createDefaultEffects(): EffectRow[] {
  return [
    { id: generateId(), pressure: '400', flowToNext: '100' },
    { id: generateId(), pressure: '350', flowToNext: '95' },
    { id: generateId(), pressure: '300', flowToNext: '90' },
    { id: generateId(), pressure: '250', flowToNext: '85' },
    { id: generateId(), pressure: '200', flowToNext: '' },
  ];
}

export function EffectInputTable({
  effects,
  pressureUnitLabel,
  onEffectsChange,
}: EffectInputTableProps) {
  const updateEffect = (index: number, field: keyof EffectRow, value: string) => {
    const updated = [...effects];
    const existing = updated[index];
    if (!existing) return;
    updated[index] = { ...existing, [field]: value };
    onEffectsChange(updated);
  };

  const addEffect = () => {
    onEffectsChange([...effects, { id: generateId(), pressure: '', flowToNext: '' }]);
  };

  const removeEffect = (index: number) => {
    if (effects.length <= 2) return;
    const updated = effects.filter((_, i) => i !== index);
    const last = updated[updated.length - 1];
    if (last) {
      updated[updated.length - 1] = { ...last, flowToNext: '' };
    }
    onEffectsChange(updated);
  };

  return (
    <Paper variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 60 }}>Effect</TableCell>
              <TableCell>Pressure ({pressureUnitLabel})</TableCell>
              <TableCell>Flow to Next (ton/hr)</TableCell>
              <TableCell sx={{ width: 48 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {effects.map((effect, i) => (
              <TableRow key={effect.id}>
                <TableCell sx={{ fontWeight: 'bold' }}>E{i + 1}</TableCell>
                <TableCell>
                  <TextField
                    value={effect.pressure}
                    onChange={(e) => updateEffect(i, 'pressure', e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                    variant="standard"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">{pressureUnitLabel}</InputAdornment>
                        ),
                      },
                    }}
                  />
                </TableCell>
                <TableCell>
                  {i < effects.length - 1 ? (
                    <TextField
                      value={effect.flowToNext}
                      onChange={(e) => updateEffect(i, 'flowToNext', e.target.value)}
                      type="number"
                      size="small"
                      fullWidth
                      variant="standard"
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
                        },
                      }}
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => removeEffect(i)}
                    disabled={effects.length <= 2}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button startIcon={<AddIcon />} onClick={addEffect} size="small" sx={{ m: 1 }}>
        Add Effect
      </Button>
    </Paper>
  );
}

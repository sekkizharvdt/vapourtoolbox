'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import type { Material } from '@vapour/types';
import { type PipingCategory } from '@vapour/types';
import {
  compareNPS,
  parseSchedule,
  parsePressureClass,
  formatPrice,
} from '@/lib/materials/variantUtils';

interface PipingMaterialTableProps {
  materials: Material[];
  pipingCategory: PipingCategory;
  loading?: boolean;
  selectedMaterialId?: string;
  onSelect: (material: Material) => void;
}

/**
 * PipingMaterialTable — Filterable table for piping materials (flanges, pipes, fittings).
 *
 * Renders a table with category-specific columns and filter dropdowns for
 * NPS, pressure class, schedule, or fitting type.
 */
export default function PipingMaterialTable({
  materials,
  pipingCategory,
  loading = false,
  selectedMaterialId,
  onSelect,
}: PipingMaterialTableProps) {
  const [filterNPS, setFilterNPS] = useState<string>('ALL');
  const [filterSecondary, setFilterSecondary] = useState<string>('ALL');

  // Extract unique filter values from materials
  const filterOptions = useMemo(() => {
    const npsSet = new Set<string>();
    const secondarySet = new Set<string>();

    for (const m of materials) {
      if (m.nps) npsSet.add(m.nps);
      if (pipingCategory === 'FLANGE' && m.pressureClass) secondarySet.add(m.pressureClass);
      if (pipingCategory === 'PIPE' && m.schedule) secondarySet.add(m.schedule);
      if (pipingCategory === 'FITTING' && m.fittingType) secondarySet.add(m.fittingType);
    }

    const npsValues = Array.from(npsSet).sort(compareNPS);
    let secondaryValues: string[];
    if (pipingCategory === 'FLANGE') {
      secondaryValues = Array.from(secondarySet).sort(
        (a, b) => parsePressureClass(a) - parsePressureClass(b)
      );
    } else if (pipingCategory === 'PIPE') {
      secondaryValues = Array.from(secondarySet).sort(
        (a, b) => parseSchedule(a) - parseSchedule(b)
      );
    } else {
      secondaryValues = Array.from(secondarySet).sort();
    }

    return { npsValues, secondaryValues };
  }, [materials, pipingCategory]);

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (filterNPS !== 'ALL' && m.nps !== filterNPS) return false;
      if (filterSecondary !== 'ALL') {
        if (pipingCategory === 'FLANGE' && m.pressureClass !== filterSecondary) return false;
        if (pipingCategory === 'PIPE' && m.schedule !== filterSecondary) return false;
        if (pipingCategory === 'FITTING' && m.fittingType !== filterSecondary) return false;
      }
      return true;
    });
  }, [materials, filterNPS, filterSecondary, pipingCategory]);

  const secondaryLabel =
    pipingCategory === 'FLANGE'
      ? 'Pressure Class'
      : pipingCategory === 'PIPE'
        ? 'Schedule'
        : 'Fitting Type';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (materials.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No materials found for this family.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filter Dropdowns */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>NPS</InputLabel>
          <Select value={filterNPS} label="NPS" onChange={(e) => setFilterNPS(e.target.value)}>
            <MenuItem value="ALL">All</MenuItem>
            {filterOptions.npsValues.map((nps) => (
              <MenuItem key={nps} value={nps}>
                {nps}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{secondaryLabel}</InputLabel>
          <Select
            value={filterSecondary}
            label={secondaryLabel}
            onChange={(e) => setFilterSecondary(e.target.value)}
          >
            <MenuItem value="ALL">All</MenuItem>
            {filterOptions.secondaryValues.map((val) => (
              <MenuItem key={val} value={val}>
                {val}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Chip label={`${filteredMaterials.length} items`} size="small" variant="outlined" />
        </Box>
      </Stack>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 350, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>NPS</TableCell>
              {pipingCategory === 'FLANGE' && (
                <TableCell sx={{ fontWeight: 'bold' }}>Rating</TableCell>
              )}
              {pipingCategory === 'PIPE' && (
                <TableCell sx={{ fontWeight: 'bold' }}>Schedule</TableCell>
              )}
              {pipingCategory === 'FITTING' && (
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              )}
              <TableCell sx={{ fontWeight: 'bold' }}>OD (mm)</TableCell>
              {pipingCategory === 'FLANGE' && (
                <TableCell sx={{ fontWeight: 'bold' }}>Bolt Circle</TableCell>
              )}
              {pipingCategory === 'PIPE' && (
                <TableCell sx={{ fontWeight: 'bold' }}>Wall Thk</TableCell>
              )}
              {pipingCategory === 'FITTING' && (
                <TableCell sx={{ fontWeight: 'bold' }}>C-to-E</TableCell>
              )}
              <TableCell sx={{ fontWeight: 'bold' }}>Weight</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMaterials.map((m) => {
              const isSelected = m.id === selectedMaterialId;
              return (
                <TableRow
                  key={m.id}
                  hover
                  selected={isSelected}
                  onClick={() => onSelect(m)}
                  sx={{
                    cursor: 'pointer',
                    '&.Mui-selected': {
                      bgcolor: 'primary.lighter',
                    },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'}>
                      {m.nps || '-'}
                    </Typography>
                  </TableCell>

                  {pipingCategory === 'FLANGE' && <TableCell>{m.pressureClass || '-'}</TableCell>}
                  {pipingCategory === 'PIPE' && <TableCell>Sch {m.schedule || '-'}</TableCell>}
                  {pipingCategory === 'FITTING' && (
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                        {m.fittingType || '-'}
                      </Typography>
                    </TableCell>
                  )}

                  <TableCell>{m.outsideDiameter_mm ?? '-'}</TableCell>

                  {pipingCategory === 'FLANGE' && <TableCell>{m.boltCircle_mm ?? '-'}</TableCell>}
                  {pipingCategory === 'PIPE' && <TableCell>{m.wallThickness_mm ?? '-'}</TableCell>}
                  {pipingCategory === 'FITTING' && <TableCell>{m.centerToEnd_mm ?? '-'}</TableCell>}

                  <TableCell>
                    {pipingCategory === 'PIPE'
                      ? m.weightPerMeter_kg
                        ? `${m.weightPerMeter_kg} kg/m`
                        : '-'
                      : m.weightPerPiece_kg
                        ? `${m.weightPerPiece_kg} kg`
                        : '-'}
                  </TableCell>

                  <TableCell>
                    {m.currentPrice
                      ? formatPrice(m.currentPrice.pricePerUnit, m.currentPrice.currency)
                      : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredMaterials.length === 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          No items match the current filters.
        </Alert>
      )}
    </Box>
  );
}

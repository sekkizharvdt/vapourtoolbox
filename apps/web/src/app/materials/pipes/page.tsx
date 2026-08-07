// rule28-exempt: master data — list with bulk import + dialog-based per-row edits; rows are referenced by selectors elsewhere, no per-row detail page is meaningful

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState, FilterBar } from '@vapour/ui';

import { getFirebase } from '@/lib/firebase';
import { queryMaterials } from '@/lib/materials/queries';
import {
  MATERIAL_CATEGORY_GROUPS,
  MATERIAL_CATEGORY_LABELS,
  type Material,
  type MaterialCategory,
} from '@vapour/types';
import { parseNPS, parseSchedule, compareNPS } from '@/lib/materials/variantUtils';

/**
 * Pipes are flat material documents — one doc per NPS + schedule, with the
 * dimensions on the doc itself. The old parent-doc + `variants` subcollection
 * shape is superseded (those parents carry `isMigrated`, and `queryMaterials`
 * drops them), so this page reads the `materials` collection directly.
 */
const PIPE_CATEGORIES: MaterialCategory[] =
  MATERIAL_CATEGORY_GROUPS.find((g) => g.key === 'pipes')?.categories ?? [];

export default function PipesPage() {
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchText, setSearchText] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<string | 'ALL'>('ALL');
  const [selectedSchedule, setSelectedSchedule] = useState<string | 'ALL'>('ALL');
  const [selectedNPS, setSelectedNPS] = useState<string | 'ALL'>('ALL');
  const [selectedOD, setSelectedOD] = useState<string | 'ALL'>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Load materials
  const loadMaterials = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      // One indexed query for every pipe category (index: category ASC,
      // materialCode ASC) — the whole catalogue is a few hundred docs.
      const { materials: pipeMaterials } = await queryMaterials(db, {
        categories: PIPE_CATEGORIES,
        sortField: 'materialCode',
        sortDirection: 'asc',
        limitResults: 1000,
      });

      setMaterials(pipeMaterials.filter((m) => m.isActive !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipes');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedMaterial('ALL');
    setSelectedSchedule('ALL');
    setSelectedNPS('ALL');
    setSelectedOD('ALL');
    setPage(0);
  };

  // One row per pipe document, flattened to the dimensions this table renders.
  const allVariants = useMemo(() => {
    return materials.map((material) => ({
      id: material.id,
      materialCode: material.materialCode,
      materialName: material.name,
      category: material.category as string,
      nps: material.nps,
      dn: material.dn,
      schedule: material.schedule,
      scheduleType: material.scheduleType,
      od_mm: material.outsideDiameter_mm,
      wt_mm: material.wallThickness_mm,
      weight_kgm: material.weightPerMeter_kg,
    }));
  }, [materials]);

  // Catalogue standard — seeded docs carry it under `specification` or `seedMetadata`.
  const standard = useMemo(
    () => materials[0]?.specification?.standard ?? materials[0]?.seedMetadata?.standard,
    [materials]
  );

  // parseNPS and parseSchedule are now imported from @/lib/materials/variantUtils

  // Filter variants
  const filteredVariants = useMemo(() => {
    let filtered = allVariants;

    // Search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (variant) =>
          variant.materialCode?.toLowerCase().includes(searchLower) ||
          variant.materialName?.toLowerCase().includes(searchLower) ||
          variant.nps?.toLowerCase().includes(searchLower) ||
          variant.dn?.toLowerCase().includes(searchLower) ||
          variant.schedule?.toLowerCase().includes(searchLower)
      );
    }

    // Material filter
    if (selectedMaterial !== 'ALL') {
      filtered = filtered.filter((v) => v.category === selectedMaterial);
    }

    // Schedule filter
    if (selectedSchedule !== 'ALL') {
      filtered = filtered.filter((v) => v.schedule === selectedSchedule);
    }

    // NPS filter
    if (selectedNPS !== 'ALL') {
      filtered = filtered.filter((v) => v.nps === selectedNPS);
    }

    // OD filter
    if (selectedOD !== 'ALL') {
      filtered = filtered.filter((v) => v.od_mm?.toFixed(2) === selectedOD);
    }

    // Sort by NPS (ascending), then by Schedule (ascending)
    filtered.sort((a, b) => {
      const npsA = parseNPS(a.nps || '0');
      const npsB = parseNPS(b.nps || '0');

      if (npsA !== npsB) {
        return npsA - npsB;
      }

      // If NPS is the same, sort by schedule
      const schedA = parseSchedule(a.schedule || '');
      const schedB = parseSchedule(b.schedule || '');
      return schedA - schedB;
    });

    return filtered;
  }, [allVariants, searchText, selectedMaterial, selectedSchedule, selectedNPS, selectedOD]);

  // Paginated variants
  const paginatedVariants = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredVariants.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredVariants, page, rowsPerPage]);

  // Get unique filter options
  const materialTypes = useMemo(() => {
    const typeSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.category) typeSet.add(v.category);
    });
    return Array.from(typeSet).sort();
  }, [allVariants]);

  const schedules = useMemo(() => {
    const schedSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.schedule) schedSet.add(v.schedule);
    });
    return Array.from(schedSet).sort();
  }, [allVariants]);

  const npsSizes = useMemo(() => {
    const npsSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.nps) npsSet.add(v.nps);
    });
    return Array.from(npsSet).sort(compareNPS);
  }, [allVariants]);

  const odSizes = useMemo(() => {
    const odSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.od_mm) odSet.add(v.od_mm.toFixed(2));
    });
    return Array.from(odSet).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [allVariants]);

  // Statistics
  const stats = useMemo(() => {
    const materialBreakdown: Record<string, number> = {};
    allVariants.forEach((v) => {
      if (v.category) {
        materialBreakdown[v.category] = (materialBreakdown[v.category] || 0) + 1;
      }
    });

    const scheduleBreakdown: Record<string, number> = {};
    allVariants.forEach((v) => {
      if (v.schedule) {
        scheduleBreakdown[v.schedule] = (scheduleBreakdown[v.schedule] || 0) + 1;
      }
    });

    return {
      total: allVariants.length,
      materialBreakdown,
      scheduleBreakdown,
      materials: materials.length,
    };
  }, [allVariants, materials]);

  // Grade only — the "Pipes - " prefix is redundant inside a pipes table.
  const getMaterialDisplayName = (category: string) => {
    const label = MATERIAL_CATEGORY_LABELS[category as MaterialCategory];
    return label ? label.replace(/^Pipes - /, '') : category;
  };

  return (
    <>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
          { label: 'Pipes' },
        ]}
      />

      <PageHeader
        title="Pipes"
        subtitle="Carbon steel, stainless and duplex pipes per ASME B36.10 / B36.19"
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadMaterials}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <Box sx={{ mb: 3 }}>
        {/* Stats Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Sizes
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Pipes by Material
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {Object.entries(stats.materialBreakdown)
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <Chip
                      key={type}
                      label={`${getMaterialDisplayName(type)}: ${count}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
              </Box>
            </CardContent>
          </Card>
          {standard && (
            <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  Standard
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {standard}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Stack>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        {/* Filters */}
        <FilterBar onClear={handleClearFilters}>
          <TextField
            label="Search"
            placeholder="Search pipes..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Material</InputLabel>
            <Select
              value={selectedMaterial}
              label="Material"
              onChange={(e) => {
                setSelectedMaterial(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All Materials</MenuItem>
              {materialTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {getMaterialDisplayName(type)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Schedule</InputLabel>
            <Select
              value={selectedSchedule}
              label="Schedule"
              onChange={(e) => {
                setSelectedSchedule(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All Schedules</MenuItem>
              {schedules.slice(0, 20).map((schedule) => (
                <MenuItem key={schedule} value={schedule}>
                  {schedule}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>NPS</InputLabel>
            <Select
              value={selectedNPS}
              label="NPS"
              onChange={(e) => {
                setSelectedNPS(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All Sizes</MenuItem>
              {npsSizes.slice(0, 20).map((nps) => (
                <MenuItem key={nps} value={nps}>
                  {nps}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>OD (mm)</InputLabel>
            <Select
              value={selectedOD}
              label="OD (mm)"
              onChange={(e) => {
                setSelectedOD(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All ODs</MenuItem>
              {odSizes.slice(0, 20).map((od) => (
                <MenuItem key={od} value={od}>
                  {od}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FilterBar>

        {/* Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>NPS</TableCell>
                <TableCell>DN (mm)</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell align="right">OD (mm)</TableCell>
                <TableCell align="right">ID (mm)</TableCell>
                <TableCell align="right">WT (mm)</TableCell>
                <TableCell align="right">Weight (kg/m)</TableCell>
                <TableCell>Material</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading pipes..." variant="table" colSpan={8} />
              ) : paginatedVariants.length === 0 ? (
                <EmptyState
                  message={
                    searchText ||
                    selectedMaterial !== 'ALL' ||
                    selectedSchedule !== 'ALL' ||
                    selectedNPS !== 'ALL' ||
                    selectedOD !== 'ALL'
                      ? 'No pipes match your filters. Try adjusting your filter selections.'
                      : 'No pipes data available.'
                  }
                  variant="table"
                  colSpan={8}
                />
              ) : (
                paginatedVariants.map((variant, index) => {
                  // ID = OD - 2*WT, blank unless both dimensions are on the doc
                  const id_mm =
                    variant.od_mm !== undefined && variant.wt_mm !== undefined
                      ? variant.od_mm - 2 * variant.wt_mm
                      : undefined;

                  return (
                    <TableRow key={variant.id || index} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {variant.nps}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{variant.dn}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={variant.schedule ?? '—'} size="small" color="secondary" />
                        {variant.scheduleType && variant.scheduleType !== variant.schedule && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            ({variant.scheduleType})
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{variant.od_mm?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium" color="primary.main">
                          {id_mm?.toFixed(2) ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{variant.wt_mm?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell align="right">{variant.weight_kgm?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={getMaterialDisplayName(variant.category)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {!loading && filteredVariants.length > 0 && (
          <TablePagination
            component="div"
            count={filteredVariants.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        )}
      </Paper>
    </>
  );
}

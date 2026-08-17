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
import { loadPipingCatalog, type PipingCatalogRow } from '@/lib/boughtOut/pipingCatalog';
import { MATERIAL_CATEGORY_GROUPS, type MaterialCategory } from '@vapour/types';
import { parseNPS, compareNPS } from '@/lib/materials/variantUtils';

/**
 * Fittings are flat material documents — one doc per type + NPS, with the
 * dimensions on the doc itself. Under the sizing model they are bought-out
 * items (priced per piece), so this page reads them through `loadPipingCatalog`,
 * which sources `bought_out_items` post-migration and `materials` before it.
 */
const FITTING_CATEGORIES: MaterialCategory[] =
  MATERIAL_CATEGORY_GROUPS.find((g) => g.key === 'fittings')?.categories ?? [];

export default function FittingsPage() {
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<PipingCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchText, setSearchText] = useState('');
  const [selectedFittingType, setSelectedFittingType] = useState<string | 'ALL'>('ALL');
  const [selectedNPS, setSelectedNPS] = useState<string | 'ALL'>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Load materials
  const loadMaterials = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      // Flanges and fittings are priced per piece, so the sizing model files
      // them as bought-out items. `loadPipingCatalog` reads them from
      // `bought_out_items` once the taxonomy migration has run, and falls back
      // to `materials` until then — the pages' table code is identical either way.
      setMaterials(await loadPipingCatalog(db, 'fittings', FITTING_CATEGORIES));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fittings');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedFittingType('ALL');
    setSelectedNPS('ALL');
    setPage(0);
  };

  // One row per fitting document, flattened to the dimensions this table renders.
  const allVariants = useMemo(() => {
    return materials.map((material) => ({
      id: material.id,
      materialCode: material.materialCode,
      materialName: material.name,
      type: material.fittingType,
      nps: material.nps,
      dn: material.dn,
      centerToEnd_mm: material.centerToEnd_mm,
      endToEnd_mm: material.endToEnd_mm,
      applicableSchedules: material.applicableSchedules,
      weight_kg: material.weightPerPiece_kg,
    }));
  }, [materials]);

  // Catalogue standard — seeded docs carry it under `specification` or `seedMetadata`.
  const standard = useMemo(
    () => materials[0]?.specification?.standard ?? materials[0]?.seedMetadata?.standard,
    [materials]
  );

  // parseNPS is now imported from @/lib/materials/variantUtils

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
          variant.type?.toLowerCase().includes(searchLower) ||
          String(variant.applicableSchedules ?? '')
            .toLowerCase()
            .includes(searchLower)
      );
    }

    // Type filter
    if (selectedFittingType !== 'ALL') {
      filtered = filtered.filter((v) => v.type === selectedFittingType);
    }

    // NPS filter
    if (selectedNPS !== 'ALL') {
      filtered = filtered.filter((v) => v.nps?.split(' x ')[0] === selectedNPS);
    }

    // Sort by Type (alphabetically), then by NPS (ascending)
    filtered.sort((a, b) => {
      // First sort by type
      const typeA = a.type || '';
      const typeB = b.type || '';

      if (typeA !== typeB) {
        return typeA.localeCompare(typeB);
      }

      // If type is the same, sort by NPS
      const npsA = parseNPS(a.nps || '0');
      const npsB = parseNPS(b.nps || '0');
      return npsA - npsB;
    });

    return filtered;
  }, [allVariants, searchText, selectedFittingType, selectedNPS]);

  // Paginated variants
  const paginatedVariants = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredVariants.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredVariants, page, rowsPerPage]);

  // Get unique filter options
  const fittingTypes = useMemo(() => {
    const typeSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.type) typeSet.add(v.type);
    });
    return Array.from(typeSet).sort();
  }, [allVariants]);

  const npsSizes = useMemo(() => {
    const npsSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.nps) {
        // For fittings like "2 x 1", only get first size
        const nps = v.nps.split(' x ')[0] || v.nps;
        npsSet.add(nps);
      }
    });
    return Array.from(npsSet).sort(compareNPS);
  }, [allVariants]);

  // Statistics
  const stats = useMemo(() => {
    const typeBreakdown: Record<string, number> = {};
    allVariants.forEach((v) => {
      if (v.type) {
        typeBreakdown[v.type] = (typeBreakdown[v.type] || 0) + 1;
      }
    });

    return {
      total: allVariants.length,
      typeBreakdown,
      materials: materials.length,
    };
  }, [allVariants, materials]);

  return (
    <>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
          { label: 'Fittings' },
        ]}
      />

      <PageHeader
        title="Fittings"
        subtitle="Butt Weld Fittings per ASME B16.9-2024"
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
                Fittings by Type
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {Object.entries(stats.typeBreakdown)
                  .slice(0, 4)
                  .map(([type, count]) => (
                    <Chip key={type} label={`${type}: ${count}`} size="small" variant="outlined" />
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
            size="small"
            label="Search"
            placeholder="Search fittings..."
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
            <InputLabel>Type</InputLabel>
            <Select
              value={selectedFittingType}
              label="Type"
              onChange={(e) => {
                setSelectedFittingType(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All Types</MenuItem>
              {fittingTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Size</InputLabel>
            <Select
              value={selectedNPS}
              label="Size"
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
        </FilterBar>

        {/* Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>NPS</TableCell>
                <TableCell>DN (mm)</TableCell>
                <TableCell align="right">Center-to-End (mm)</TableCell>
                <TableCell align="right">End-to-End (mm)</TableCell>
                <TableCell align="right">Weight (kg)</TableCell>
                <TableCell>Applicable Schedules</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading fittings..." variant="table" colSpan={7} />
              ) : paginatedVariants.length === 0 ? (
                <EmptyState
                  message={
                    searchText || selectedFittingType !== 'ALL' || selectedNPS !== 'ALL'
                      ? 'No fittings match your filters. Try adjusting your filter selections.'
                      : 'No fittings data available.'
                  }
                  variant="table"
                  colSpan={7}
                />
              ) : (
                paginatedVariants.map((variant, index) => (
                  <TableRow key={variant.id || index} hover>
                    <TableCell>
                      <Chip
                        label={variant.type ?? '—'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.nps}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.dn}</Typography>
                    </TableCell>
                    <TableCell align="right">{variant.centerToEnd_mm || '-'}</TableCell>
                    <TableCell align="right">{variant.endToEnd_mm || '-'}</TableCell>
                    <TableCell align="right">
                      {variant.weight_kg ? (
                        <Typography variant="body2" fontWeight="medium">
                          {variant.weight_kg.toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          TBD
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={variant.applicableSchedules ?? '—'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))
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

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
import { MATERIAL_CATEGORY_LABELS, type MaterialCategory } from '@vapour/types';
import { parseNPS, parsePressureClass, compareNPS } from '@/lib/materials/variantUtils';

/**
 * Flanges are flat material documents — one doc per NPS + pressure class, with
 * the dimensions on the doc itself. Under the sizing model they are
 * bought-out items (priced per piece), so this page reads them through
 * `loadPipingCatalog`, which sources `bought_out_items` post-migration and
 * `materials` before it.
 */
export default function FlangesPage() {
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<PipingCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchText, setSearchText] = useState('');
  const [selectedFlangeType, setSelectedFlangeType] = useState<string | 'ALL'>('ALL');
  const [selectedPressureClass, setSelectedPressureClass] = useState<string | 'ALL'>('ALL');
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
      // them as bought-out items — they live in `bought_out_items` as products
      // with one variant per NPS + class / schedule.
      setMaterials(await loadPipingCatalog(db, 'flanges'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flanges');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleClearFilters = () => {
    setSearchText('');
    setSelectedFlangeType('ALL');
    setSelectedPressureClass('ALL');
    setSelectedNPS('ALL');
    setPage(0);
  };

  // One row per flange document, flattened to the dimensions this table renders.
  const allVariants = useMemo(() => {
    return materials.map((material) => ({
      id: material.id,
      materialCode: material.materialCode,
      materialName: material.name,
      category: material.category as string,
      nps: material.nps,
      dn: material.dn,
      pressureClass: material.pressureClass,
      outsideDiameter_mm: material.outsideDiameter_mm,
      boltCircle_mm: material.boltCircle_mm,
      thickness_mm: material.thickness_mm,
      boltHoles: material.boltHoles,
      boltSize_inch: material.boltSize_inch,
      raisedFace_mm: material.raisedFace_mm,
      weight_kg: material.weightPerPiece_kg,
    }));
  }, [materials]);

  // Catalogue standard — seeded docs carry it under `specification` or `seedMetadata`.
  const standard = useMemo(
    () => materials[0]?.specification?.standard ?? materials[0]?.seedMetadata?.standard,
    [materials]
  );

  // Grade only — the "Flanges - " prefix is redundant inside a flanges table.
  const getFlangeTypeLabel = (category: string) => {
    const label = MATERIAL_CATEGORY_LABELS[category as MaterialCategory];
    return label ? label.replace(/^Flanges - /, '') : category;
  };

  // parseNPS and parsePressureClass are now imported from @/lib/materials/variantUtils

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
          variant.pressureClass?.toLowerCase().includes(searchLower)
      );
    }

    // Flange type filter
    if (selectedFlangeType !== 'ALL') {
      filtered = filtered.filter((v) => v.category === selectedFlangeType);
    }

    // Pressure class filter
    if (selectedPressureClass !== 'ALL') {
      filtered = filtered.filter((v) => v.pressureClass === selectedPressureClass);
    }

    // NPS filter
    if (selectedNPS !== 'ALL') {
      filtered = filtered.filter((v) => v.nps === selectedNPS);
    }

    // Sort by Pressure Class (ascending), then by NPS (ascending)
    filtered.sort((a, b) => {
      const pcA = parsePressureClass(a.pressureClass || '0');
      const pcB = parsePressureClass(b.pressureClass || '0');

      if (pcA !== pcB) {
        return pcA - pcB;
      }

      // If pressure class is the same, sort by NPS
      const npsA = parseNPS(a.nps || '0');
      const npsB = parseNPS(b.nps || '0');
      return npsA - npsB;
    });

    return filtered;
  }, [allVariants, searchText, selectedFlangeType, selectedPressureClass, selectedNPS]);

  // Paginated variants
  const paginatedVariants = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredVariants.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredVariants, page, rowsPerPage]);

  // Get unique filter options
  const flangeTypes = useMemo(() => {
    const typeSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.category) typeSet.add(v.category);
    });
    return Array.from(typeSet).sort();
  }, [allVariants]);

  const pressureClasses = useMemo(() => {
    const pcSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.pressureClass) pcSet.add(v.pressureClass);
    });
    return Array.from(pcSet).sort();
  }, [allVariants]);

  const npsSizes = useMemo(() => {
    const npsSet = new Set<string>();
    allVariants.forEach((v) => {
      if (v.nps) npsSet.add(v.nps);
    });
    return Array.from(npsSet).sort(compareNPS);
  }, [allVariants]);

  // Statistics
  const stats = useMemo(() => {
    const pressureClassBreakdown: Record<string, number> = {};
    allVariants.forEach((v) => {
      if (v.pressureClass) {
        pressureClassBreakdown[v.pressureClass] =
          (pressureClassBreakdown[v.pressureClass] || 0) + 1;
      }
    });

    return {
      total: allVariants.length,
      pressureClassBreakdown,
      materials: materials.length,
    };
  }, [allVariants, materials]);

  return (
    <>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
          { label: 'Flanges' },
        ]}
      />

      <PageHeader
        title="Flanges"
        subtitle="Weld neck, slip-on and blind flanges per ASME B16.5"
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
                Flanges by Pressure Class
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {Object.entries(stats.pressureClassBreakdown)
                  .slice(0, 4)
                  .map(([pc, count]) => (
                    <Chip key={pc} label={`${pc}: ${count}`} size="small" variant="outlined" />
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
            placeholder="Search flanges..."
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
            <InputLabel>Pressure Class</InputLabel>
            <Select
              value={selectedPressureClass}
              label="Pressure Class"
              onChange={(e) => {
                setSelectedPressureClass(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All Classes</MenuItem>
              {pressureClasses.map((pc) => (
                <MenuItem key={pc} value={pc}>
                  {pc}
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

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={selectedFlangeType}
              label="Type"
              onChange={(e) => {
                setSelectedFlangeType(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="ALL">All Types</MenuItem>
              {flangeTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {getFlangeTypeLabel(type)}
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
                <TableCell>Pressure Class</TableCell>
                <TableCell>NPS</TableCell>
                <TableCell>DN (mm)</TableCell>
                <TableCell align="right">OD (mm)</TableCell>
                <TableCell align="right">Bolt Circle (mm)</TableCell>
                <TableCell align="right">Thickness (mm)</TableCell>
                <TableCell align="center">Bolt Holes</TableCell>
                <TableCell>Bolt Size</TableCell>
                <TableCell align="right">Raised Face (mm)</TableCell>
                <TableCell align="right">Weight (kg)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading flanges..." variant="table" colSpan={11} />
              ) : paginatedVariants.length === 0 ? (
                <EmptyState
                  message={
                    searchText ||
                    selectedFlangeType !== 'ALL' ||
                    selectedPressureClass !== 'ALL' ||
                    selectedNPS !== 'ALL'
                      ? 'No flanges match your filters. Try adjusting your filter selections.'
                      : 'No flanges data available.'
                  }
                  variant="table"
                  colSpan={11}
                />
              ) : (
                paginatedVariants.map((variant, index) => (
                  <TableRow key={variant.id || index} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {getFlangeTypeLabel(variant.category)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={variant.pressureClass ?? '—'} size="small" color="secondary" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.nps}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.dn}</Typography>
                    </TableCell>
                    <TableCell align="right">{variant.outsideDiameter_mm ?? '—'}</TableCell>
                    <TableCell align="right">{variant.boltCircle_mm ?? '—'}</TableCell>
                    <TableCell align="right">{variant.thickness_mm?.toFixed(2) ?? '—'}</TableCell>
                    <TableCell align="center">{variant.boltHoles ?? '—'}</TableCell>
                    <TableCell>
                      {variant.boltSize_inch ? `${variant.boltSize_inch}"` : '—'}
                    </TableCell>
                    <TableCell align="right">{variant.raisedFace_mm?.toFixed(2) ?? '—'}</TableCell>
                    <TableCell align="right">
                      {variant.weight_kg ? (
                        <Typography variant="body2" fontWeight="medium" color="primary.main">
                          {variant.weight_kg.toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
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

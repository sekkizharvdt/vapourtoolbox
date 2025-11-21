'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Container,
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
  Breadcrumbs,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState, FilterBar } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Pipe variant interface
interface PipeVariant {
  id: string;
  nps: string;
  dn: string;
  schedule: string;
  scheduleType?: string;
  od_inch: number;
  od_mm: number;
  wt_inch: number;
  wt_mm: number;
  weight_lbft: number;
  weight_kgm: number;
}

// Material with variants
interface MaterialWithVariants {
  id: string;
  materialCode: string;
  name: string;
  category: string;
  metadata?: {
    standard?: string;
    specification?: string;
    description?: string;
  };
  variants: PipeVariant[];
}

export default function PipesPage() {
  const router = useRouter();
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<MaterialWithVariants[]>([]);
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

      // Query all pipe categories
      const pipeCategories = ['PIPES_CARBON_STEEL', 'PIPES_STAINLESS_304L', 'PIPES_STAINLESS_316L'];

      const materialsData: MaterialWithVariants[] = [];

      for (const category of pipeCategories) {
        const materialsRef = collection(db, 'materials');
        const q = query(materialsRef, where('category', '==', category));
        const materialsSnapshot = await getDocs(q);

        for (const materialDoc of materialsSnapshot.docs) {
          const materialData = materialDoc.data();

          // Get variants subcollection
          const variantsRef = collection(db, 'materials', materialDoc.id, 'variants');
          const variantsSnapshot = await getDocs(variantsRef);

          const variants = variantsSnapshot.docs.map((variantDoc) => ({
            id: variantDoc.id,
            ...variantDoc.data(),
          })) as PipeVariant[];

          materialsData.push({
            id: materialDoc.id,
            materialCode: materialData.materialCode,
            name: materialData.name,
            category: materialData.category,
            metadata: materialData.metadata,
            variants,
          });
        }
      }

      setMaterials(materialsData);
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

  // Get all variants from all materials
  const allVariants = useMemo(() => {
    return materials.flatMap((material) =>
      material.variants.map((variant) => ({
        ...variant,
        materialCode: material.materialCode,
        materialName: material.name,
        category: material.category,
        standard: material.metadata?.standard,
      }))
    );
  }, [materials]);

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
    return Array.from(npsSet).sort((a, b) => {
      // Parse NPS values (handles fractions like "1/2" and numbers like "2")
      const parseNPS = (nps: string): number => {
        const cleaned = nps.replace('"', '').trim();
        if (cleaned.includes('/')) {
          const parts = cleaned.split('/');
          const num = parseFloat(parts[0] || '0');
          const denom = parseFloat(parts[1] || '1');
          return num / denom;
        }
        return parseFloat(cleaned) || 0;
      };
      return parseNPS(a) - parseNPS(b);
    });
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

  // Helper to get material display name
  const getMaterialDisplayName = (category: string) => {
    const names: Record<string, string> = {
      PIPES_CARBON_STEEL: 'Carbon Steel',
      PIPES_STAINLESS_304L: 'SS 304L',
      PIPES_STAINLESS_316L: 'SS 316L',
    };
    return names[category] || category;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/materials"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/materials');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Materials
        </Link>
        <Typography color="text.primary">Pipes</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Pipes"
        subtitle="Carbon Steel and Stainless Steel Pipes per ASME B36.10-2022"
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
                Total Variants
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
                  .slice(0, 3)
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
          {materials[0]?.metadata?.standard && (
            <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  Standard
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {materials[0].metadata.standard}
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
                      : 'No pipes data available. Pipe variants will appear here once loaded.'
                  }
                  variant="table"
                  colSpan={8}
                />
              ) : (
                paginatedVariants.map((variant, index) => {
                  // Calculate ID = OD - 2*WT
                  const id_mm = variant.od_mm - 2 * variant.wt_mm;

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
                        <Chip label={variant.schedule} size="small" color="secondary" />
                        {variant.scheduleType && variant.scheduleType !== variant.schedule && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            ({variant.scheduleType})
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{variant.od_mm?.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium" color="primary.main">
                          {id_mm.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{variant.wt_mm?.toFixed(2)}</TableCell>
                      <TableCell align="right">{variant.weight_kgm?.toFixed(2)}</TableCell>
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
    </Container>
  );
}

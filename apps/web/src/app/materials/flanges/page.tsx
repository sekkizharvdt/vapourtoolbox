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

// Flange variant interface
interface FlangeVariant {
  id: string;
  pressureClass: string;
  nps: string;
  dn: string;
  outsideDiameter_inch: number;
  outsideDiameter_mm: number;
  boltCircle_inch: number;
  boltCircle_mm: number;
  thickness_inch: number;
  thickness_mm: number;
  boltHoles: number;
  boltSize_inch: string;
  raisedFace_inch: number;
  raisedFace_mm: number;
  weight_kg?: number;
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
  variants: FlangeVariant[];
}

export default function FlangesPage() {
  const router = useRouter();
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<MaterialWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchText, setSearchText] = useState('');
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

      // Query flanges materials
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('category', '==', 'FLANGES_WELD_NECK'));
      const materialsSnapshot = await getDocs(q);

      const materialsData: MaterialWithVariants[] = [];

      for (const materialDoc of materialsSnapshot.docs) {
        const materialData = materialDoc.data();

        // Get variants subcollection
        const variantsRef = collection(db, 'materials', materialDoc.id, 'variants');
        const variantsSnapshot = await getDocs(variantsRef);

        const variants = variantsSnapshot.docs.map((variantDoc) => ({
          id: variantDoc.id,
          ...variantDoc.data(),
        })) as FlangeVariant[];

        materialsData.push({
          id: materialDoc.id,
          materialCode: materialData.materialCode,
          name: materialData.name,
          category: materialData.category,
          metadata: materialData.metadata,
          variants,
        });
      }

      setMaterials(materialsData);
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
    setSelectedPressureClass('ALL');
    setSelectedNPS('ALL');
    setPage(0);
  };

  // Get all variants from all materials
  const allVariants = useMemo(() => {
    return materials.flatMap((material) =>
      material.variants.map((variant) => ({
        ...variant,
        materialCode: material.materialCode,
        materialName: material.name,
        standard: material.metadata?.standard,
      }))
    );
  }, [materials]);

  // Helper function to parse NPS values
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

  // Helper function to parse pressure class for sorting
  const parsePressureClass = (pressureClass: string): number => {
    // Extract numeric part from pressure classes like "150", "300", "600", etc.
    const numMatch = pressureClass.match(/\d+/);
    return numMatch ? parseInt(numMatch[0], 10) : 999;
  };

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
  }, [allVariants, searchText, selectedPressureClass, selectedNPS]);

  // Paginated variants
  const paginatedVariants = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredVariants.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredVariants, page, rowsPerPage]);

  // Get unique filter options
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
        <Typography color="text.primary">Flanges</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Flanges"
        subtitle="Weld Neck Flanges per ASME B16.5-2025"
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
        </FilterBar>

        {/* Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
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
                <LoadingState message="Loading flanges..." variant="table" colSpan={10} />
              ) : paginatedVariants.length === 0 ? (
                <EmptyState
                  message={
                    searchText || selectedPressureClass !== 'ALL' || selectedNPS !== 'ALL'
                      ? 'No flanges match your filters. Try adjusting your filter selections.'
                      : 'No flanges data available. Flange variants will appear here once loaded.'
                  }
                  variant="table"
                  colSpan={10}
                />
              ) : (
                paginatedVariants.map((variant, index) => (
                  <TableRow key={variant.id || index} hover>
                    <TableCell>
                      <Chip label={variant.pressureClass} size="small" color="secondary" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.nps}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.dn}</Typography>
                    </TableCell>
                    <TableCell align="right">{variant.outsideDiameter_mm}</TableCell>
                    <TableCell align="right">{variant.boltCircle_mm}</TableCell>
                    <TableCell align="right">{variant.thickness_mm?.toFixed(2)}</TableCell>
                    <TableCell align="center">{variant.boltHoles}</TableCell>
                    <TableCell>{variant.boltSize_inch}&quot;</TableCell>
                    <TableCell align="right">{variant.raisedFace_mm?.toFixed(2)}</TableCell>
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
    </Container>
  );
}

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
  IconButton,
  Tooltip,
  CircularProgress,
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
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
      // Custom sort for NPS (handles fractions and numbers)
      const aNum = eval(a.replace('"', ''));
      const bNum = eval(b.replace('"', ''));
      return aNum - bNum;
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
    <Container maxWidth={false} sx={{ py: 3 }}>
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

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Flanges
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Weld Neck Flanges per ASME B16.5-2025
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh flanges list">
              <IconButton onClick={loadMaterials} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

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
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search flanges by pressure class, NPS, or DN..."
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
              sx={{ flexGrow: 1 }}
            />
          </Stack>

          {/* Pressure Class Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Filter by pressure class:
            </Typography>
            <Chip
              label="All Classes"
              onClick={() => {
                setSelectedPressureClass('ALL');
                setPage(0);
              }}
              color={selectedPressureClass === 'ALL' ? 'primary' : 'default'}
              variant={selectedPressureClass === 'ALL' ? 'filled' : 'outlined'}
            />
            {pressureClasses.map((pc) => (
              <Chip
                key={pc}
                label={pc}
                onClick={() => {
                  setSelectedPressureClass(pc);
                  setPage(0);
                }}
                color={selectedPressureClass === pc ? 'primary' : 'default'}
                variant={selectedPressureClass === pc ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* NPS Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Filter by size:
            </Typography>
            <Chip
              label="All Sizes"
              onClick={() => {
                setSelectedNPS('ALL');
                setPage(0);
              }}
              color={selectedNPS === 'ALL' ? 'secondary' : 'default'}
              variant={selectedNPS === 'ALL' ? 'filled' : 'outlined'}
            />
            {npsSizes.slice(0, 12).map((nps) => (
              <Chip
                key={nps}
                label={nps}
                onClick={() => {
                  setSelectedNPS(nps);
                  setPage(0);
                }}
                color={selectedNPS === nps ? 'secondary' : 'default'}
                variant={selectedNPS === nps ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>

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
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Loading flanges...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedVariants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">
                      No flanges found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {searchText || selectedPressureClass !== 'ALL' || selectedNPS !== 'ALL'
                        ? 'Try adjusting your filters'
                        : 'No flanges data available'}
                    </Typography>
                  </TableCell>
                </TableRow>
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

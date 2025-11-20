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
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Fitting variant interface
interface FittingVariant {
  id: string;
  type: string;
  nps: string;
  dn: string;
  centerToEnd_inch?: number;
  centerToEnd_mm?: number;
  largeEnd_inch?: number;
  largeEnd_mm?: number;
  smallEnd_inch?: number;
  smallEnd_mm?: number;
  endToEnd_inch?: number;
  endToEnd_mm?: number;
  outsideDiameter_inch?: number;
  outsideDiameter_mm?: number;
  applicableSchedules: string;
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
  variants: FittingVariant[];
}

export default function FittingsPage() {
  const router = useRouter();
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<MaterialWithVariants[]>([]);
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

      // Query fittings materials
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('category', '==', 'FITTINGS_BUTT_WELD'));
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
        })) as FittingVariant[];

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
      setError(err instanceof Error ? err.message : 'Failed to load fittings');
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
          variant.type?.toLowerCase().includes(searchLower) ||
          variant.applicableSchedules?.toLowerCase().includes(searchLower)
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
        <Typography color="text.primary">Fittings</Typography>
      </Breadcrumbs>

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
              placeholder="Search fittings by type, NPS, DN, or schedules..."
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

          {/* Type Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Filter by type:
            </Typography>
            <Chip
              label="All Types"
              onClick={() => {
                setSelectedFittingType('ALL');
                setPage(0);
              }}
              color={selectedFittingType === 'ALL' ? 'primary' : 'default'}
              variant={selectedFittingType === 'ALL' ? 'filled' : 'outlined'}
            />
            {fittingTypes.map((type) => (
              <Chip
                key={type}
                label={type}
                onClick={() => {
                  setSelectedFittingType(type);
                  setPage(0);
                }}
                color={selectedFittingType === type ? 'primary' : 'default'}
                variant={selectedFittingType === type ? 'filled' : 'outlined'}
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
                <TableCell>Type</TableCell>
                <TableCell>NPS</TableCell>
                <TableCell>DN (mm)</TableCell>
                <TableCell align="right">Center-to-End (mm)</TableCell>
                <TableCell align="right">End-to-End (mm)</TableCell>
                <TableCell>Applicable Schedules</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading fittings..." variant="table" colSpan={6} />
              ) : paginatedVariants.length === 0 ? (
                <EmptyState
                  message={
                    searchText || selectedFittingType !== 'ALL' || selectedNPS !== 'ALL'
                      ? 'No fittings match your filters. Try adjusting your filter selections.'
                      : 'No fittings data available. Fitting variants will appear here once loaded.'
                  }
                  variant="table"
                  colSpan={6}
                />
              ) : (
                paginatedVariants.map((variant, index) => (
                  <TableRow key={variant.id || index} hover>
                    <TableCell>
                      <Chip label={variant.type} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.nps}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{variant.dn}</Typography>
                    </TableCell>
                    <TableCell align="right">{variant.centerToEnd_mm || '-'}</TableCell>
                    <TableCell align="right">{variant.endToEnd_mm || '-'}</TableCell>
                    <TableCell>
                      <Chip label={variant.applicableSchedules} size="small" variant="outlined" />
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

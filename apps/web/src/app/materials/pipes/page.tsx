'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
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
  TableSortLabel,
  TablePagination,
  Stack,
  Card,
  CardContent,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import type {
  Material,
  MaterialCategory,
  MaterialSortField,
  MaterialSortDirection,
} from '@vapour/types';
import { MATERIAL_CATEGORY_LABELS, MaterialCategory as MC } from '@vapour/types';
import { queryMaterials } from '@/lib/materials/materialService';

// Pipe categories
const PIPE_CATEGORIES: MaterialCategory[] = [
  MC.PIPES_CARBON_STEEL,
  MC.PIPES_STAINLESS_304L,
  MC.PIPES_STAINLESS_316L,
  MC.PIPES_ALLOY_STEEL,
];

// Common pipe schedules
const PIPE_SCHEDULES = ['Sch 10', 'Sch 40', 'Sch 80', 'Sch 160'];

// Construction types
const CONSTRUCTION_TYPES = ['Seamless', 'Welded'];

export default function PipesPage() {
  const router = useRouter();
  const { db } = getFirebase();

  // State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Category Selection
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const [selectedSchedule, setSelectedSchedule] = useState<string | 'ALL'>('ALL');
  const [selectedConstruction, setSelectedConstruction] = useState<string | 'ALL'>('ALL');

  // Search & Filters
  const [searchText, setSearchText] = useState('');
  const [showOnlyStandard, setShowOnlyStandard] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<MaterialSortField>('name');
  const [sortDirection, setSortDirection] = useState<MaterialSortDirection>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Load materials
  const loadMaterials = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      const categoriesToQuery = selectedCategory === 'ALL' ? PIPE_CATEGORIES : [selectedCategory];

      const result = await queryMaterials(db, {
        categories: categoriesToQuery,
        isActive: true,
        isStandard: showOnlyStandard ? true : undefined,
        sortField,
        sortDirection,
        limitResults: 500,
      });

      setMaterials(result.materials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipes');
    } finally {
      setLoading(false);
    }
  }, [db, selectedCategory, showOnlyStandard, sortField, sortDirection]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Filter materials by search text, schedule, and construction
  const filteredMaterials = useMemo(() => {
    let filtered = materials;

    // Search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (material) =>
          material.name.toLowerCase().includes(searchLower) ||
          material.materialCode.toLowerCase().includes(searchLower) ||
          material.description?.toLowerCase().includes(searchLower) ||
          material.specification?.standard?.toLowerCase().includes(searchLower) ||
          material.specification?.grade?.toLowerCase().includes(searchLower) ||
          material.specification?.schedule?.toLowerCase().includes(searchLower)
      );
    }

    // Schedule filter
    if (selectedSchedule !== 'ALL') {
      filtered = filtered.filter((m) => {
        // Check in specification
        if (m.specification?.schedule?.includes(selectedSchedule)) return true;
        // Check in variants
        if (m.hasVariants && m.variants) {
          return m.variants.some((v) => v.dimensions.schedule?.includes(selectedSchedule));
        }
        return false;
      });
    }

    // Construction type filter
    if (selectedConstruction !== 'ALL') {
      filtered = filtered.filter(
        (m) =>
          m.specification?.form?.toLowerCase().includes(selectedConstruction.toLowerCase()) ||
          m.tags?.some((tag) => tag.toLowerCase().includes(selectedConstruction.toLowerCase()))
      );
    }

    return filtered;
  }, [materials, searchText, selectedSchedule, selectedConstruction]);

  // Paginated materials
  const paginatedMaterials = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredMaterials.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredMaterials, page, rowsPerPage]);

  // Engineering-focused statistics
  const stats = useMemo(() => {
    const categoryBreakdown = PIPE_CATEGORIES.reduce(
      (acc, cat) => {
        acc[cat] = materials.filter((m) => m.category === cat).length;
        return acc;
      },
      {} as Record<MaterialCategory, number>
    );

    const scheduleBreakdown: Record<string, number> = {};
    materials.forEach((m) => {
      if (m.specification?.schedule) {
        scheduleBreakdown[m.specification.schedule] =
          (scheduleBreakdown[m.specification.schedule] || 0) + 1;
      }
      if (m.hasVariants && m.variants) {
        m.variants.forEach((v) => {
          if (v.dimensions.schedule) {
            scheduleBreakdown[v.dimensions.schedule] =
              (scheduleBreakdown[v.dimensions.schedule] || 0) + 1;
          }
        });
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyAdded = materials.filter((m) => {
      if (!m.createdAt) return false;
      const createdDate = m.createdAt.toDate();
      return createdDate >= thirtyDaysAgo;
    }).length;

    const missingSpecs = materials.filter(
      (m) =>
        !m.properties?.density ||
        !m.specification?.standard ||
        !m.specification?.grade ||
        !m.specification?.schedule
    ).length;

    return {
      total: materials.length,
      categoryBreakdown,
      scheduleBreakdown,
      recentlyAdded,
      missingSpecs,
    };
  }, [materials]);

  // Sort handler
  const handleSort = (field: MaterialSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(0);
  };

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
        <Typography color="text.primary">Pipes</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Pipes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Carbon Steel, Stainless Steel pipes with ASTM schedules (Sch 10, 40, 80)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh pipes list">
              <IconButton onClick={loadMaterials} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/materials/pipes/new')}
            >
              Add Pipe
            </Button>
          </Box>
        </Box>

        {/* Engineering-Focused Stats Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Active Pipes
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 250px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2" gutterBottom>
                Pipes by Material
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                <Chip
                  label={`CS: ${stats.categoryBreakdown[MC.PIPES_CARBON_STEEL] || 0}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`304L: ${stats.categoryBreakdown[MC.PIPES_STAINLESS_304L] || 0}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`316L: ${stats.categoryBreakdown[MC.PIPES_STAINLESS_316L] || 0}`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Recently Added (30d)
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {stats.recentlyAdded}
              </Typography>
            </CardContent>
          </Card>
          <Card
            variant="outlined"
            sx={{
              flex: '1 1 200px',
              borderColor: stats.missingSpecs > 0 ? 'warning.main' : 'divider',
            }}
          >
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Missing Specifications
              </Typography>
              <Typography
                variant="h5"
                fontWeight="bold"
                color={stats.missingSpecs > 0 ? 'warning.main' : 'text.primary'}
              >
                {stats.missingSpecs}
              </Typography>
            </CardContent>
          </Card>
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
              placeholder="Search pipes by code, name, grade, standard, or schedule..."
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

            {/* Standard Filter */}
            <Chip
              icon={showOnlyStandard ? <StarIcon /> : <StarBorderIcon />}
              label="Standard Only"
              onClick={() => {
                setShowOnlyStandard(!showOnlyStandard);
                setPage(0);
              }}
              color={showOnlyStandard ? 'primary' : 'default'}
              variant={showOnlyStandard ? 'filled' : 'outlined'}
            />
          </Stack>

          {/* Material Category Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Filter by material:
            </Typography>
            <Chip
              label="All"
              onClick={() => {
                setSelectedCategory('ALL');
                setPage(0);
              }}
              color={selectedCategory === 'ALL' ? 'primary' : 'default'}
              variant={selectedCategory === 'ALL' ? 'filled' : 'outlined'}
            />
            {PIPE_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={MATERIAL_CATEGORY_LABELS[category].replace(/^Pipes - /, '')}
                onClick={() => {
                  setSelectedCategory(category);
                  setPage(0);
                }}
                color={selectedCategory === category ? 'primary' : 'default'}
                variant={selectedCategory === category ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* Schedule Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Filter by schedule:
            </Typography>
            <Chip
              label="All Schedules"
              onClick={() => {
                setSelectedSchedule('ALL');
                setPage(0);
              }}
              color={selectedSchedule === 'ALL' ? 'secondary' : 'default'}
              variant={selectedSchedule === 'ALL' ? 'filled' : 'outlined'}
            />
            {PIPE_SCHEDULES.map((schedule) => (
              <Chip
                key={schedule}
                label={schedule}
                onClick={() => {
                  setSelectedSchedule(schedule);
                  setPage(0);
                }}
                color={selectedSchedule === schedule ? 'secondary' : 'default'}
                variant={selectedSchedule === schedule ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* Construction Type Filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
              Filter by construction:
            </Typography>
            <Chip
              label="All Types"
              onClick={() => {
                setSelectedConstruction('ALL');
                setPage(0);
              }}
              color={selectedConstruction === 'ALL' ? 'info' : 'default'}
              variant={selectedConstruction === 'ALL' ? 'filled' : 'outlined'}
            />
            {CONSTRUCTION_TYPES.map((type) => (
              <Chip
                key={type}
                label={type}
                onClick={() => {
                  setSelectedConstruction(type);
                  setPage(0);
                }}
                color={selectedConstruction === type ? 'info' : 'default'}
                variant={selectedConstruction === type ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>

        {/* Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'materialCode'}
                    direction={sortField === 'materialCode' ? sortDirection : 'asc'}
                    onClick={() => handleSort('materialCode')}
                  >
                    Material Code
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>Specification</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Construction</TableCell>
                <TableCell>Properties</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Loading pipes...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">
                      No pipes found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {searchText || selectedSchedule !== 'ALL' || selectedConstruction !== 'ALL'
                        ? 'Try adjusting your filters'
                        : 'Add pipe materials to get started'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMaterials.map((material) => (
                  <TableRow key={material.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {material.materialCode}
                      </Typography>
                      {material.customCode && (
                        <Typography variant="caption" color="text.secondary">
                          {material.customCode}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{material.name}</Typography>
                      {material.isStandard && (
                        <Chip
                          icon={<StarIcon />}
                          label="Standard"
                          size="small"
                          color="primary"
                          sx={{ mt: 0.5, height: 20 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {material.specification?.standard || '-'}
                        {material.specification?.grade && ` ${material.specification.grade}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {material.specification?.schedule || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {material.specification?.form ||
                          material.tags?.find(
                            (t) =>
                              t.toLowerCase().includes('seamless') ||
                              t.toLowerCase().includes('welded')
                          ) ||
                          '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {material.properties?.density && (
                        <Typography variant="caption" display="block">
                          Density: {material.properties.density}{' '}
                          {material.properties.densityUnit || 'kg/m³'}
                        </Typography>
                      )}
                      {material.properties?.tensileStrength && (
                        <Typography variant="caption" display="block">
                          Tensile: {material.properties.tensileStrength} MPa
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={material.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={material.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/materials/${material.id}`)}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit pipe">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/materials/${material.id}/edit`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {!loading && filteredMaterials.length > 0 && (
          <TablePagination
            component="div"
            count={filteredMaterials.length}
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

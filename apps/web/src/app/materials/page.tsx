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
  Tabs,
  Tab,
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  CloudUpload as SeedIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';

// Define tab structure with grouped categories
interface MaterialTab {
  id: string;
  label: string;
  categories: MaterialCategory[];
  icon?: string;
}

const MATERIAL_TABS: MaterialTab[] = [
  {
    id: 'plates',
    label: 'Plates',
    categories: [
      MC.PLATES_CARBON_STEEL,
      MC.PLATES_STAINLESS_STEEL,
      MC.PLATES_ALLOY_STEEL,
      MC.PLATES_ALUMINUM,
      MC.PLATES_COPPER,
      MC.PLATES_TITANIUM,
      MC.PLATES_NICKEL_ALLOYS,
    ],
  },
  {
    id: 'pipes',
    label: 'Pipes',
    categories: [
      MC.PIPES_SEAMLESS,
      MC.PIPES_WELDED,
      MC.PIPES_STAINLESS,
      MC.PIPES_COPPER,
      MC.PIPES_ALLOY_STEEL,
    ],
  },
];

export default function MaterialsPage() {
  const router = useRouter();
  const { db } = getFirebase();
  const { claims } = useAuth();

  // State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  // Tab & Category Selection
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSubCategory, setSelectedSubCategory] = useState<MaterialCategory | 'ALL'>('ALL');

  // Search & Filters
  const [searchText, setSearchText] = useState('');
  const [showOnlyStandard, setShowOnlyStandard] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<MaterialSortField>('name');
  const [sortDirection, setSortDirection] = useState<MaterialSortDirection>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Get current tab's categories
  const currentTabCategories = MATERIAL_TABS[activeTab]?.categories || [];

  // Load materials for current tab
  const loadMaterials = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      // Determine which categories to query
      const categoriesToQuery =
        selectedSubCategory === 'ALL' ? currentTabCategories : [selectedSubCategory];

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
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [db, currentTabCategories, selectedSubCategory, showOnlyStandard, sortField, sortDirection]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Reset page and sub-category when tab changes
  useEffect(() => {
    setPage(0);
    setSelectedSubCategory('ALL');
    setSearchText('');
  }, [activeTab]);

  // Filter materials by search text
  const filteredMaterials = useMemo(() => {
    if (!searchText.trim()) return materials;

    const searchLower = searchText.toLowerCase();
    return materials.filter(
      (material) =>
        material.name.toLowerCase().includes(searchLower) ||
        material.materialCode.toLowerCase().includes(searchLower) ||
        material.description?.toLowerCase().includes(searchLower) ||
        material.specification?.standard?.toLowerCase().includes(searchLower) ||
        material.specification?.grade?.toLowerCase().includes(searchLower)
    );
  }, [materials, searchText]);

  // Paginated materials
  const paginatedMaterials = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredMaterials.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredMaterials, page, rowsPerPage]);

  // Stats for current tab
  const tabStats = useMemo(() => {
    return {
      total: filteredMaterials.length,
      standard: filteredMaterials.filter((m) => m.isStandard).length,
    };
  }, [filteredMaterials]);

  // Seed catalog handler
  const handleSeedCatalog = async () => {
    try {
      setSeeding(true);
      setError(null);
      setSeedSuccess(null);

      const functions = getFunctions();
      const seedMaterialsCatalog = httpsCallable(functions, 'seedMaterialsCatalog');
      const result = await seedMaterialsCatalog();

      const data = result.data as {
        success: boolean;
        message: string;
        stats: {
          total: number;
          carbonSteelPlates: number;
          stainlessSteelPlates: number;
          carbonSeamlessPipes: number;
          carbonWeldedPipes: number;
          stainlessSeamlessPipes: number;
        };
      };

      if (data.success) {
        setSeedSuccess(
          `Successfully seeded ${data.stats.total} materials: ` +
            `${data.stats.carbonSteelPlates} carbon steel plates, ` +
            `${data.stats.stainlessSteelPlates} stainless steel plates, ` +
            `${data.stats.carbonSeamlessPipes} seamless pipes, ` +
            `${data.stats.carbonWeldedPipes} welded pipes, ` +
            `${data.stats.stainlessSeamlessPipes} stainless pipes`
        );
        await loadMaterials();
      }
    } catch (err) {
      console.error('Error seeding catalog:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'permission-denied') {
        setError('Super-admin permissions required to seed material catalog');
      } else if (error.code === 'failed-precondition') {
        setError(
          'Materials collection already contains data. Clear existing materials before seeding.'
        );
      } else if (error.code === 'resource-exhausted') {
        setError('Material catalog can only be seeded once per 24 hours');
      } else {
        setError(error.message || 'Failed to seed material catalog');
      }
    } finally {
      setSeeding(false);
    }
  };

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

  // Check if user is super admin (all 27 permission bits)
  const isSuperAdmin = claims?.permissions === 134217727;

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Material Database
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh materials list">
              <IconButton onClick={loadMaterials} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {isSuperAdmin && (
              <Tooltip title="Seed catalog with standard materials (Super Admin only)">
                <Button
                  variant="outlined"
                  startIcon={seeding ? <CircularProgress size={20} /> : <SeedIcon />}
                  onClick={handleSeedCatalog}
                  disabled={seeding}
                >
                  Seed Catalog
                </Button>
              </Tooltip>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/materials/new')}
            >
              Add Material
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Materials
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {tabStats.total}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Standard Materials
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {tabStats.standard}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Category
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {MATERIAL_TABS[activeTab]?.label || '-'}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Sub-Categories
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {currentTabCategories.length}
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
        {seedSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSeedSuccess(null)}>
            {seedSuccess}
          </Alert>
        )}
      </Box>

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        {/* Category Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {MATERIAL_TABS.map((tab) => (
              <Tab key={tab.id} label={tab.label} />
            ))}
          </Tabs>
        </Box>

        {/* Sub-category filter and search */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search materials..."
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

            {/* Sub-category Filter */}
            {currentTabCategories.length > 1 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  label="All"
                  onClick={() => {
                    setSelectedSubCategory('ALL');
                    setPage(0);
                  }}
                  color={selectedSubCategory === 'ALL' ? 'primary' : 'default'}
                  variant={selectedSubCategory === 'ALL' ? 'filled' : 'outlined'}
                />
                {currentTabCategories.map((category) => (
                  <Chip
                    key={category}
                    label={MATERIAL_CATEGORY_LABELS[category].replace(/^.*? - /, '')}
                    onClick={() => {
                      setSelectedSubCategory(category);
                      setPage(0);
                    }}
                    color={selectedSubCategory === category ? 'primary' : 'default'}
                    variant={selectedSubCategory === category ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            )}

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
                <TableCell>Category</TableCell>
                <TableCell>Properties</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Loading materials...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">
                      No materials found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {searchText
                        ? 'Try adjusting your search criteria'
                        : 'Add materials to get started'}
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
                      <Typography variant="caption" color="text.secondary">
                        {material.specification?.form || '-'}
                        {material.specification?.schedule &&
                          ` | ${material.specification.schedule}`}
                        {material.specification?.nominalSize &&
                          ` | ${material.specification.nominalSize}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {MATERIAL_CATEGORY_LABELS[material.category]}
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
                      {material.properties?.maxOperatingTemp && (
                        <Typography variant="caption" display="block">
                          Max Temp: {material.properties.maxOperatingTemp}°C
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
                      <Tooltip title="Edit material">
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

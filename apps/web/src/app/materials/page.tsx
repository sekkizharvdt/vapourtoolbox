'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Checkbox,
  FormControlLabel,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  FileDownload as ExportIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import type {
  Material,
  MaterialCategory,
  MaterialType,
  MaterialSortField,
  MaterialSortDirection,
} from '@vapour/types';
import { MATERIAL_CATEGORY_LABELS, MATERIAL_CATEGORY_GROUPS } from '@vapour/types';
import { queryMaterials, searchMaterials } from '@/lib/materials/materialService';
import { formatMoney, formatDate } from '@/lib/utils/formatters';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CloudUpload as SeedIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';

export default function MaterialsPage() {
  const router = useRouter();
  const { db } = getFirebase();
  const { user, claims } = useAuth();

  // State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  // Search & Filters
  const [searchText, setSearchText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<MaterialCategory[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<MaterialType[]>([]);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [showOnlyStandard, setShowOnlyStandard] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<MaterialSortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<MaterialSortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    standard: 0,
    categories: 0,
  });

  // Load materials
  useEffect(() => {
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCategories,
    selectedTypes,
    showOnlyActive,
    showOnlyStandard,
    sortField,
    sortDirection,
  ]);

  const loadMaterials = async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      const result = await queryMaterials(db, {
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        materialTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
        isActive: showOnlyActive ? true : undefined,
        isStandard: showOnlyStandard ? true : undefined,
        sortField,
        sortDirection,
        limitResults: 200, // Fetch more for client-side filtering
      });

      setMaterials(result.materials);

      // Calculate stats
      const categorySet = new Set(result.materials.map((m) => m.category));
      setStats({
        total: result.materials.length,
        active: result.materials.filter((m) => m.isActive).length,
        standard: result.materials.filter((m) => m.isStandard).length,
        categories: categorySet.size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
      console.error('Error loading materials:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!db) return;

    if (!searchText.trim()) {
      loadMaterials();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const results = await searchMaterials(db, searchText.trim(), 100);
      setMaterials(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search materials');
      console.error('Error searching materials:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered materials (client-side search if needed)
  const filteredMaterials = useMemo(() => {
    let filtered = materials;

    if (searchText && materials.length > 0) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(searchLower) ||
          m.description.toLowerCase().includes(searchLower) ||
          m.materialCode.toLowerCase().includes(searchLower) ||
          m.customCode?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [materials, searchText]);

  // Paginated materials
  const paginatedMaterials = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredMaterials.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredMaterials, page, rowsPerPage]);

  // Handle sort
  const handleSort = (field: MaterialSortField) => {
    const isAsc = sortField === field && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchText('');
    setSelectedCategories([]);
    setSelectedTypes([]);
    setShowOnlyActive(true);
    setShowOnlyStandard(false);
  };

  // Handle navigation
  const handleViewMaterial = (materialId: string) => {
    router.push(`/materials/${materialId}`);
  };

  const handleEditMaterial = (materialId: string) => {
    router.push(`/materials/${materialId}/edit`);
  };

  const handleCreateMaterial = () => {
    router.push('/materials/new');
  };

  // Handle seed catalog
  const handleSeedCatalog = async () => {
    if (
      !window.confirm(
        'This will populate the database with ~140-150 standard carbon steel materials. Continue?'
      )
    ) {
      return;
    }

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
          `${data.message}. Carbon Steel Plates: ${data.stats.carbonSteelPlates}, ` +
            `Stainless Steel Plates: ${data.stats.stainlessSteelPlates}, ` +
            `Carbon Seamless Pipes: ${data.stats.carbonSeamlessPipes}, ` +
            `Carbon Welded Pipes: ${data.stats.carbonWeldedPipes}, ` +
            `Stainless Seamless Pipes: ${data.stats.stainlessSeamlessPipes}`
        );
        // Reload materials
        await loadMaterials();
      }
    } catch (err) {
      console.error('Error seeding catalog:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to seed material catalog. Check console for details.');
      }
    } finally {
      setSeeding(false);
    }
  };

  // Check if user is super-admin
  const isSuperAdmin = useMemo(() => {
    if (!user || !claims || typeof claims.permissions !== 'number') return false;
    // Super-admin has all 27 permission bits = 134,217,727
    return claims.permissions === 134217727;
  }, [user, claims]);

  // Format specification string
  const formatSpecification = (material: Material): string => {
    const parts: string[] = [];
    if (material.specification?.standard) parts.push(material.specification.standard);
    if (material.specification?.grade) parts.push(material.specification.grade);
    if (material.specification?.finish) parts.push(material.specification.finish);
    if (material.specification?.schedule) parts.push(material.specification.schedule);
    if (material.specification?.nominalSize) parts.push(material.specification.nominalSize);
    return parts.join(' | ') || '-';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Material Database
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ASME/ASTM compliant materials database for engineering and manufacturing
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadMaterials}>
            Refresh
          </Button>
          {isSuperAdmin && materials.length === 0 && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={seeding ? <CircularProgress size={20} /> : <SeedIcon />}
              onClick={handleSeedCatalog}
              disabled={seeding || loading}
            >
              {seeding ? 'Seeding...' : 'Seed Catalog'}
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateMaterial}>
            New Material
          </Button>
        </Box>
      </Box>

      {/* Success Alert */}
      {seedSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSeedSuccess(null)}>
          {seedSuccess}
        </Alert>
      )}

      {/* Stats Cards */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom variant="body2">
              Total Materials
            </Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom variant="body2">
              Active Materials
            </Typography>
            <Typography variant="h4">{stats.active}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom variant="body2">
              Standard Materials
            </Typography>
            <Typography variant="h4">{stats.standard}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" gutterBottom variant="body2">
              Categories
            </Typography>
            <Typography variant="h4">{stats.categories}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Search & Filter Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
          }}
        >
          <Box sx={{ flex: 1, width: '100%' }}>
            <TextField
              fullWidth
              placeholder="Search by name, code, description, or tags..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchText && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchText('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Badge
              badgeContent={
                selectedCategories.length + selectedTypes.length + (showOnlyStandard ? 1 : 0)
              }
              color="primary"
            >
              <Button
                variant={showFilters ? 'contained' : 'outlined'}
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
            </Badge>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              disabled={
                selectedCategories.length === 0 &&
                selectedTypes.length === 0 &&
                !showOnlyStandard &&
                !searchText
              }
            >
              Clear
            </Button>
            <Button variant="outlined" startIcon={<ExportIcon />}>
              Export
            </Button>
          </Box>
        </Box>

        {/* Expandable Filters */}
        {showFilters && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    multiple
                    value={selectedCategories}
                    onChange={(e) => setSelectedCategories(e.target.value as MaterialCategory[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={MATERIAL_CATEGORY_LABELS[value]} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {Object.entries(MATERIAL_CATEGORY_GROUPS).map(([group, categories]) => [
                      <MenuItem key={group} disabled sx={{ fontWeight: 'bold' }}>
                        {group}
                      </MenuItem>,
                      ...categories.map((cat) => (
                        <MenuItem key={cat} value={cat} sx={{ pl: 4 }}>
                          {MATERIAL_CATEGORY_LABELS[cat]}
                        </MenuItem>
                      )),
                    ])}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <FormControl fullWidth>
                  <InputLabel>Material Type</InputLabel>
                  <Select
                    multiple
                    value={selectedTypes}
                    onChange={(e) => setSelectedTypes(e.target.value as MaterialType[])}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value.replace('_', ' ')} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    <MenuItem value="RAW_MATERIAL">Raw Material</MenuItem>
                    <MenuItem value="BOUGHT_OUT_COMPONENT">Bought-Out Component</MenuItem>
                    <MenuItem value="CONSUMABLE">Consumable</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showOnlyActive}
                        onChange={(e) => setShowOnlyActive(e.target.checked)}
                      />
                    }
                    label="Active materials only"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={showOnlyStandard}
                        onChange={(e) => setShowOnlyStandard(e.target.checked)}
                      />
                    }
                    label="Standard materials only"
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Materials Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredMaterials.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No materials found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {searchText
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first material'}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateMaterial}>
              Create Material
            </Button>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width="40px"></TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'materialCode'}
                        direction={sortField === 'materialCode' ? sortDirection : 'asc'}
                        onClick={() => handleSort('materialCode')}
                      >
                        Code
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
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'category'}
                        direction={sortField === 'category' ? sortDirection : 'asc'}
                        onClick={() => handleSort('category')}
                      >
                        Category
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Specification</TableCell>
                    <TableCell align="right">Current Price</TableCell>
                    <TableCell>Vendors</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'updatedAt'}
                        direction={sortField === 'updatedAt' ? sortDirection : 'asc'}
                        onClick={() => handleSort('updatedAt')}
                      >
                        Last Updated
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedMaterials.map((material) => (
                    <TableRow key={material.id} hover>
                      <TableCell>
                        {material.isStandard ? (
                          <Tooltip title="Standard Material">
                            <StarIcon color="primary" fontSize="small" />
                          </Tooltip>
                        ) : (
                          <StarBorderIcon fontSize="small" sx={{ color: 'action.disabled' }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {material.customCode || material.materialCode}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {material.name}
                        </Typography>
                        {!material.isActive && (
                          <Chip label="Inactive" size="small" color="default" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {MATERIAL_CATEGORY_LABELS[material.category]}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatSpecification(material)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {material.currentPrice ? (
                          <Typography variant="body2" fontWeight="medium">
                            {formatMoney(material.currentPrice.pricePerUnit)}
                            <Typography variant="caption" color="text.secondary" display="block">
                              per {material.currentPrice.unit}
                            </Typography>
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={material.preferredVendors.length}
                          size="small"
                          color={material.preferredVendors.length > 0 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(material.updatedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewMaterial(material.id)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEditMaterial(material.id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[25, 50, 100, 200]}
              component="div"
              count={filteredMaterials.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>
    </Container>
  );
}

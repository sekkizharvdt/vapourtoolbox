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
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

// Pipe variant interface
interface PipeVariant {
  id: string;
  nps: string;
  dn: string;
  schedule: string;
  scheduleType: string;
  od_inch: number;
  od_mm: number;
  wt_inch: number;
  wt_mm: number;
  weight_lbft: number;
  weight_kgm: number;
}

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
  variants: (PipeVariant | FittingVariant | FlangeVariant)[];
}

// Union type for all variants with additional material info
type VariantWithMaterial = (PipeVariant | FittingVariant | FlangeVariant) & {
  materialCode: string;
  materialName: string;
  standard?: string;
};

export default function MaterialsCatalogPage() {
  const router = useRouter();
  const { db } = getFirebase();

  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // State
  const [materials, setMaterials] = useState<MaterialWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchText, setSearchText] = useState('');

  // Pipes filters
  const [selectedSchedule, setSelectedSchedule] = useState<string | 'ALL'>('ALL');
  const [selectedNPS, setSelectedNPS] = useState<string | 'ALL'>('ALL');

  // Fittings filters
  const [selectedFittingType, setSelectedFittingType] = useState<string | 'ALL'>('ALL');

  // Flanges filters
  const [selectedPressureClass, setSelectedPressureClass] = useState<string | 'ALL'>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Load materials based on tab
  const loadMaterials = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      // Determine category based on tab
      const categories = ['PIPES_CARBON_STEEL', 'FITTINGS_BUTT_WELD', 'FLANGES_WELD_NECK'];
      const category = categories[tabValue];

      // Query materials with the selected category
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('category', '==', category));
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
        })) as (PipeVariant | FittingVariant | FlangeVariant)[];

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
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [db, tabValue]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  // Reset filters when tab changes
  useEffect(() => {
    setSearchText('');
    setSelectedSchedule('ALL');
    setSelectedNPS('ALL');
    setSelectedFittingType('ALL');
    setSelectedPressureClass('ALL');
    setPage(0);
  }, [tabValue]);

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

  // Filter variants based on tab and filters
  const filteredVariants = useMemo(() => {
    let filtered = allVariants;

    // Search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((variant) => {
        const v = variant as VariantWithMaterial &
          Partial<PipeVariant & FittingVariant & FlangeVariant>;
        return (
          v.materialCode?.toLowerCase().includes(searchLower) ||
          v.materialName?.toLowerCase().includes(searchLower) ||
          v.nps?.toLowerCase().includes(searchLower) ||
          v.dn?.toLowerCase().includes(searchLower) ||
          v.schedule?.toLowerCase().includes(searchLower) ||
          v.type?.toLowerCase().includes(searchLower) ||
          v.pressureClass?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Tab-specific filters
    if (tabValue === 0) {
      // Pipes
      if (selectedSchedule !== 'ALL') {
        filtered = filtered.filter((v) => (v as PipeVariant).schedule === selectedSchedule);
      }
      if (selectedNPS !== 'ALL') {
        filtered = filtered.filter((v) => (v as PipeVariant).nps === selectedNPS);
      }
    } else if (tabValue === 1) {
      // Fittings
      if (selectedFittingType !== 'ALL') {
        filtered = filtered.filter((v) => (v as FittingVariant).type === selectedFittingType);
      }
      if (selectedNPS !== 'ALL') {
        filtered = filtered.filter(
          (v) => (v as FittingVariant).nps?.split(' x ')[0] === selectedNPS
        );
      }
    } else if (tabValue === 2) {
      // Flanges
      if (selectedPressureClass !== 'ALL') {
        filtered = filtered.filter(
          (v) => (v as FlangeVariant).pressureClass === selectedPressureClass
        );
      }
      if (selectedNPS !== 'ALL') {
        filtered = filtered.filter((v) => (v as FlangeVariant).nps === selectedNPS);
      }
    }

    return filtered;
  }, [
    allVariants,
    searchText,
    selectedSchedule,
    selectedNPS,
    selectedFittingType,
    selectedPressureClass,
    tabValue,
  ]);

  // Paginated variants
  const paginatedVariants = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredVariants.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredVariants, page, rowsPerPage]);

  // Get unique filter options
  const schedules = useMemo(() => {
    const schedSet = new Set<string>();
    allVariants.forEach((v) => {
      const pipeVariant = v as Partial<PipeVariant>;
      if (pipeVariant.schedule) schedSet.add(pipeVariant.schedule);
    });
    return Array.from(schedSet).sort();
  }, [allVariants]);

  const npsSizes = useMemo(() => {
    const npsSet = new Set<string>();
    allVariants.forEach((v) => {
      const variant = v as Partial<PipeVariant & FittingVariant & FlangeVariant>;
      if (variant.nps) {
        // For fittings like "2 x 1", only get first size
        const nps = variant.nps.split(' x ')[0] || variant.nps;
        npsSet.add(nps);
      }
    });
    return Array.from(npsSet).sort((a, b) => {
      // Custom sort for NPS (handles fractions and numbers)
      const aNum = eval(a.replace('"', ''));
      const bNum = eval(b.replace('"', ''));
      return aNum - bNum;
    });
  }, [allVariants]);

  const fittingTypes = useMemo(() => {
    const typeSet = new Set<string>();
    allVariants.forEach((v) => {
      const fittingVariant = v as Partial<FittingVariant>;
      if (fittingVariant.type) typeSet.add(fittingVariant.type);
    });
    return Array.from(typeSet).sort();
  }, [allVariants]);

  const pressureClasses = useMemo(() => {
    const pcSet = new Set<string>();
    allVariants.forEach((v) => {
      const flangeVariant = v as Partial<FlangeVariant>;
      if (flangeVariant.pressureClass) pcSet.add(flangeVariant.pressureClass);
    });
    return Array.from(pcSet).sort();
  }, [allVariants]);

  // Render pipes table
  const renderPipesTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>NPS</TableCell>
            <TableCell>DN</TableCell>
            <TableCell>Schedule</TableCell>
            <TableCell align="right">OD (inch)</TableCell>
            <TableCell align="right">OD (mm)</TableCell>
            <TableCell align="right">WT (inch)</TableCell>
            <TableCell align="right">WT (mm)</TableCell>
            <TableCell align="right">Weight (lb/ft)</TableCell>
            <TableCell align="right">Weight (kg/m)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : paginatedVariants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  No pipes found. Try adjusting filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            paginatedVariants.map((variant, index) => {
              const pipeVariant = variant as PipeVariant;
              return (
                <TableRow key={pipeVariant.id || index} hover>
                  <TableCell>{pipeVariant.nps}</TableCell>
                  <TableCell>{pipeVariant.dn}</TableCell>
                  <TableCell>
                    <Chip label={pipeVariant.schedule} size="small" />
                    {pipeVariant.scheduleType &&
                      pipeVariant.scheduleType !== pipeVariant.schedule && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          ({pipeVariant.scheduleType})
                        </Typography>
                      )}
                  </TableCell>
                  <TableCell align="right">{pipeVariant.od_inch?.toFixed(3)}</TableCell>
                  <TableCell align="right">{pipeVariant.od_mm?.toFixed(2)}</TableCell>
                  <TableCell align="right">{pipeVariant.wt_inch?.toFixed(3)}</TableCell>
                  <TableCell align="right">{pipeVariant.wt_mm?.toFixed(2)}</TableCell>
                  <TableCell align="right">{pipeVariant.weight_lbft?.toFixed(2)}</TableCell>
                  <TableCell align="right">{pipeVariant.weight_kgm?.toFixed(2)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // Render fittings table
  const renderFittingsTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Type</TableCell>
            <TableCell>NPS</TableCell>
            <TableCell>DN</TableCell>
            <TableCell align="right">Center-to-End (inch)</TableCell>
            <TableCell align="right">Center-to-End (mm)</TableCell>
            <TableCell align="right">End-to-End (inch)</TableCell>
            <TableCell align="right">End-to-End (mm)</TableCell>
            <TableCell>Applicable Schedules</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : paginatedVariants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  No fittings found. Try adjusting filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            paginatedVariants.map((variant, index) => {
              const fittingVariant = variant as FittingVariant;
              return (
                <TableRow key={fittingVariant.id || index} hover>
                  <TableCell>
                    <Chip
                      label={fittingVariant.type}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{fittingVariant.nps}</TableCell>
                  <TableCell>{fittingVariant.dn}</TableCell>
                  <TableCell align="right">
                    {fittingVariant.centerToEnd_inch?.toFixed(2) || '-'}
                  </TableCell>
                  <TableCell align="right">{fittingVariant.centerToEnd_mm || '-'}</TableCell>
                  <TableCell align="right">
                    {fittingVariant.endToEnd_inch?.toFixed(2) || '-'}
                  </TableCell>
                  <TableCell align="right">{fittingVariant.endToEnd_mm || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={fittingVariant.applicableSchedules}
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
  );

  // Render flanges table
  const renderFlangesTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Pressure Class</TableCell>
            <TableCell>NPS</TableCell>
            <TableCell>DN</TableCell>
            <TableCell align="right">OD (inch)</TableCell>
            <TableCell align="right">OD (mm)</TableCell>
            <TableCell align="right">Bolt Circle (inch)</TableCell>
            <TableCell align="right">Bolt Circle (mm)</TableCell>
            <TableCell align="right">Thickness (inch)</TableCell>
            <TableCell align="center">Bolt Holes</TableCell>
            <TableCell>Bolt Size</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                <CircularProgress />
              </TableCell>
            </TableRow>
          ) : paginatedVariants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  No flanges found. Try adjusting filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            paginatedVariants.map((variant, index) => {
              const flangeVariant = variant as FlangeVariant;
              return (
                <TableRow key={flangeVariant.id || index} hover>
                  <TableCell>
                    <Chip label={flangeVariant.pressureClass} size="small" color="secondary" />
                  </TableCell>
                  <TableCell>{flangeVariant.nps}</TableCell>
                  <TableCell>{flangeVariant.dn}</TableCell>
                  <TableCell align="right">
                    {flangeVariant.outsideDiameter_inch?.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">{flangeVariant.outsideDiameter_mm}</TableCell>
                  <TableCell align="right">{flangeVariant.boltCircle_inch?.toFixed(2)}</TableCell>
                  <TableCell align="right">{flangeVariant.boltCircle_mm}</TableCell>
                  <TableCell align="right">{flangeVariant.thickness_inch?.toFixed(2)}</TableCell>
                  <TableCell align="center">{flangeVariant.boltHoles}</TableCell>
                  <TableCell>{flangeVariant.boltSize_inch}&quot;</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

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
        <Typography color="text.primary">ASME Standards Catalog</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              ASME Standards Catalog
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Comprehensive reference data for pipes, fittings, and flanges per ASME standards
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh catalog">
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
                {allVariants.length}
              </Typography>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ flex: '1 1 200px' }}>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Filtered Results
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {filteredVariants.length}
              </Typography>
            </CardContent>
          </Card>
          {materials[0]?.metadata?.standard && (
            <Card variant="outlined" sx={{ flex: '1 1 300px' }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  Current Standard
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
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab
              label={
                <Badge badgeContent={tabValue === 0 ? filteredVariants.length : 0} color="primary">
                  Pipes (ASME B36.10)
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={tabValue === 1 ? filteredVariants.length : 0} color="primary">
                  Fittings (ASME B16.9)
                </Badge>
              }
            />
            <Tab
              label={
                <Badge badgeContent={tabValue === 2 ? filteredVariants.length : 0} color="primary">
                  Flanges (ASME B16.5)
                </Badge>
              }
            />
          </Tabs>
        </Box>

        {/* Filters */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder={`Search ${['pipes', 'fittings', 'flanges'][tabValue]}...`}
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

          {/* Tab-specific filters */}
          {tabValue === 0 && (
            <>
              {/* Pipes Filters */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', mr: 1 }}
                >
                  Schedule:
                </Typography>
                <Chip
                  label="All"
                  onClick={() => setSelectedSchedule('ALL')}
                  color={selectedSchedule === 'ALL' ? 'primary' : 'default'}
                  size="small"
                />
                {schedules.slice(0, 8).map((schedule) => (
                  <Chip
                    key={schedule}
                    label={schedule}
                    onClick={() => setSelectedSchedule(schedule)}
                    color={selectedSchedule === schedule ? 'primary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', mr: 1 }}
                >
                  NPS:
                </Typography>
                <Chip
                  label="All"
                  onClick={() => setSelectedNPS('ALL')}
                  color={selectedNPS === 'ALL' ? 'secondary' : 'default'}
                  size="small"
                />
                {npsSizes.slice(0, 12).map((nps) => (
                  <Chip
                    key={nps}
                    label={nps}
                    onClick={() => setSelectedNPS(nps)}
                    color={selectedNPS === nps ? 'secondary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
            </>
          )}

          {tabValue === 1 && (
            <>
              {/* Fittings Filters */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', mr: 1 }}
                >
                  Type:
                </Typography>
                <Chip
                  label="All"
                  onClick={() => setSelectedFittingType('ALL')}
                  color={selectedFittingType === 'ALL' ? 'primary' : 'default'}
                  size="small"
                />
                {fittingTypes.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    onClick={() => setSelectedFittingType(type)}
                    color={selectedFittingType === type ? 'primary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', mr: 1 }}
                >
                  Size:
                </Typography>
                <Chip
                  label="All"
                  onClick={() => setSelectedNPS('ALL')}
                  color={selectedNPS === 'ALL' ? 'secondary' : 'default'}
                  size="small"
                />
                {npsSizes.slice(0, 10).map((nps) => (
                  <Chip
                    key={nps}
                    label={nps}
                    onClick={() => setSelectedNPS(nps)}
                    color={selectedNPS === nps ? 'secondary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
            </>
          )}

          {tabValue === 2 && (
            <>
              {/* Flanges Filters */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', mr: 1 }}
                >
                  Pressure Class:
                </Typography>
                <Chip
                  label="All"
                  onClick={() => setSelectedPressureClass('ALL')}
                  color={selectedPressureClass === 'ALL' ? 'primary' : 'default'}
                  size="small"
                />
                {pressureClasses.map((pc) => (
                  <Chip
                    key={pc}
                    label={pc}
                    onClick={() => setSelectedPressureClass(pc)}
                    color={selectedPressureClass === pc ? 'primary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ alignSelf: 'center', mr: 1 }}
                >
                  NPS:
                </Typography>
                <Chip
                  label="All"
                  onClick={() => setSelectedNPS('ALL')}
                  color={selectedNPS === 'ALL' ? 'secondary' : 'default'}
                  size="small"
                />
                {npsSizes.slice(0, 10).map((nps) => (
                  <Chip
                    key={nps}
                    label={nps}
                    onClick={() => setSelectedNPS(nps)}
                    color={selectedNPS === nps ? 'secondary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
            </>
          )}
        </Box>

        {/* Table Content */}
        <TabPanel value={tabValue} index={0}>
          {renderPipesTable()}
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {renderFittingsTable()}
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {renderFlangesTable()}
        </TabPanel>

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

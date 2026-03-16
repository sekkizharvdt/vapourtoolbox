'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
  Button,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useRouter, useSearchParams } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { ServiceCategory, SERVICE_CATEGORY_LABELS } from '@vapour/types';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { Service } from '@vapour/types';
import { SERVICE_CALCULATION_METHOD_LABELS } from '@vapour/types';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

export default function ServiceCatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as ServiceCategory | null;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || '');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { db } = getFirebase();

  useEffect(() => {
    async function loadServices() {
      if (!db) return;
      setLoading(true);

      try {
        const constraints: QueryConstraint[] = [where('isActive', '==', true)];

        if (categoryFilter) {
          constraints.push(where('category', '==', categoryFilter));
        }

        constraints.push(orderBy('name', 'asc'));

        const q = query(collection(db, COLLECTIONS.SERVICES), ...constraints);
        const snap = await getDocs(q);

        const results = snap.docs.map((d) => docToTyped<Service>(d.id, d.data()));
        setServices(results);
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setLoading(false);
      }
    }

    loadServices();
  }, [db, categoryFilter]);

  // Client-side search filtering
  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const term = search.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.serviceCode.toLowerCase().includes(term) ||
        (s.description ?? '').toLowerCase().includes(term)
    );
  }, [services, search]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const categoryTitle = categoryFilter
    ? SERVICE_CATEGORY_LABELS[categoryFilter as ServiceCategory]
    : 'All Services';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/services')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h1">
            {categoryTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} service{filtered.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            router.push(
              categoryFilter ? `/services/new?category=${categoryFilter}` : '/services/new'
            )
          }
        >
          Add Service
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by name, code, or description..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 300, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">All Categories</MenuItem>
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {search ? 'No services match your search' : 'No services found in this category'}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
            onClick={() => router.push('/services/new')}
          >
            Add First Service
          </Button>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Calculation Method</TableCell>
                  <TableCell align="right">Default Rate</TableCell>
                  <TableCell align="center">Standard</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((service) => (
                  <TableRow
                    key={service.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/services/${service.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                        {service.serviceCode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {service.name}
                      </Typography>
                      {service.description && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {service.description.length > 80
                            ? service.description.substring(0, 80) + '...'
                            : service.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={SERVICE_CATEGORY_LABELS[service.category]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {SERVICE_CALCULATION_METHOD_LABELS[service.calculationMethod]}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {service.defaultRateValue != null
                          ? service.calculationMethod === 'PERCENTAGE_OF_MATERIAL' ||
                            service.calculationMethod === 'PERCENTAGE_OF_TOTAL'
                            ? `${service.defaultRateValue}%`
                            : `${service.defaultCurrency ?? 'INR'} ${service.defaultRateValue.toLocaleString('en-IN')}`
                          : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {service.isStandard && (
                        <Chip label="Standard" size="small" color="primary" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/services/${service.id}`)}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/services/${service.id}/edit`)}
                        >
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
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          />
        </Paper>
      )}
    </Box>
  );
}

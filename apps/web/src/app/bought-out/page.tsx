'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  BoughtOutItem,
  BoughtOutCategory,
  BOUGHT_OUT_CATEGORY_LABELS,
  ListBoughtOutItemsOptions,
} from '@vapour/types';
import { listBoughtOutItems, deleteBoughtOutItem } from '@/lib/boughtOut/boughtOutService';

interface DynamicColumn {
  label: string;
  key: string;
  format?: (v: unknown) => string;
  render?: (specs: unknown) => string;
}

export default function BoughtOutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { db } = getFirebase();

  const [items, setItems] = useState<BoughtOutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<BoughtOutCategory | 'ALL'>('ALL');

  // Single-tenant: Use 'company' as entityId
  const entityId = 'company';

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const options: ListBoughtOutItemsOptions = {
        entityId,
        isActive: true,
      };

      if (categoryFilter !== 'ALL') {
        options.category = categoryFilter;
      }

      const fetchedItems = await listBoughtOutItems(db, options);
      setItems(fetchedItems);
    } catch (error) {
      console.error('Error loading bought-out items:', error);
    } finally {
      setLoading(false);
    }
  }, [db, categoryFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    if (!user) return;

    try {
      await deleteBoughtOutItem(db, id, user.uid);
      loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic Columns Configuration
  const getDynamicColumns = (): DynamicColumn[] => {
    if (categoryFilter === 'ALL') return [];

    switch (categoryFilter) {
      case 'PUMP':
        return [
          { label: 'Type', key: 'type' },
          { label: 'Flow Rate', key: 'flowRate', format: (v: unknown) => `${v} m³/hr` },
          { label: 'Head', key: 'head', format: (v: unknown) => `${v} m` },
        ];
      case 'VALVE':
        return [
          { label: 'Type', key: 'type' },
          { label: 'Size', key: 'size' },
          { label: 'Pressure', key: 'pressureRating' },
        ];
      case 'INSTRUMENT':
        return [
          { label: 'Type', key: 'type' },
          { label: 'Variable', key: 'variable' },
          {
            label: 'Range',
            key: 'range',
            render: (specs: unknown) => {
              const s = specs as Record<string, unknown>;
              return `${s.rangeMin} - ${s.rangeMax} ${s.unit}`;
            },
          },
        ];
      case 'ELECTRICAL':
        return [
          { label: 'Type', key: 'type' },
          { label: 'Voltage', key: 'voltage' },
          { label: 'Power', key: 'powerRating' },
        ];
      default:
        return [];
    }
  };

  const dynamicColumns = getDynamicColumns();

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Bought-Out Items
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage procurement-ready equipment and components
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/bought-out/new')}
        >
          New Item
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={categoryFilter}
            onChange={(_, newValue) => setCategoryFilter(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="All Items" value="ALL" />
            {Object.entries(BOUGHT_OUT_CATEGORY_LABELS).map(([key, label]) => (
              <Tab key={key} label={label} value={key} />
            ))}
          </Tabs>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item Code</TableCell>
              <TableCell>Name</TableCell>
              {categoryFilter === 'ALL' && <TableCell>Category</TableCell>}

              {/* Dynamic Headers */}
              {dynamicColumns.map((col) => (
                <TableCell key={col.label}>{col.label}</TableCell>
              ))}

              <TableCell align="right">Price</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6 + dynamicColumns.length} align="center" sx={{ py: 8 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6 + dynamicColumns.length} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">No items found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {item.itemCode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1">{item.name}</Typography>
                    {item.description && (
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                    )}
                  </TableCell>
                  {categoryFilter === 'ALL' && (
                    <TableCell>
                      <Chip
                        label={BOUGHT_OUT_CATEGORY_LABELS[item.category]}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                  )}

                  {/* Dynamic Cells */}
                  {dynamicColumns.map((col) => (
                    <TableCell key={col.label}>
                      {col.render
                        ? col.render(item.specifications)
                        : col.format
                          ? col.format((item.specifications as Record<string, unknown>)[col.key])
                          : ((item.specifications as Record<string, unknown>)[
                              col.key
                            ] as React.ReactNode) || '-'}
                    </TableCell>
                  ))}

                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: item.pricing.currency,
                      }).format(item.pricing.listPrice.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/bought-out/${item.id}`)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(item.id)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

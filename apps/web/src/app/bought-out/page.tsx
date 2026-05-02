'use client';

import { useState, useEffect, useCallback } from 'react';
import {
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
  TextField,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import { PageHeader, LoadingState, EmptyState, TableActionCell } from '@vapour/ui';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  RateReview as RateReviewIcon,
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
import { useConfirmDialog } from '@/components/common/ConfirmDialog';

interface DynamicColumn {
  label: string;
  key: string;
  format?: (v: unknown) => string;
  render?: (specs: unknown) => string;
}

export default function BoughtOutPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db } = getFirebase();
  const { confirm } = useConfirmDialog();

  const [items, setItems] = useState<BoughtOutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<BoughtOutCategory | 'ALL'>('ALL');
  // When on, the list shows only AI-parser auto-created records that
  // still need a human to verify the extracted spec. Reviewers come
  // here, open each item, fix anything wrong, and click "Mark as
  // reviewed" on the detail page to clear the flag.
  const [reviewOnly, setReviewOnly] = useState(false);

  // Single-tenant: default-entity (must match tenantId claim for Firestore rules)
  const tenantId = claims?.tenantId || 'default-entity';

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const options: ListBoughtOutItemsOptions = {
        tenantId,
        isActive: true,
      };

      if (categoryFilter !== 'ALL') {
        options.category = categoryFilter;
      }

      if (reviewOnly) {
        options.needsReviewOnly = true;
      }

      const fetchedItems = await listBoughtOutItems(db, options);
      setItems(fetchedItems);
    } catch (error) {
      console.error('Error loading bought-out items:', error);
    } finally {
      setLoading(false);
    }
  }, [db, categoryFilter, reviewOnly, tenantId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'error',
    });
    if (!confirmed) return;
    if (!user || !claims) return;

    try {
      await deleteBoughtOutItem(db, id, user.uid, claims.permissions);
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
    <>
      <PageHeader
        title="Bought-Out Items"
        subtitle="Manage procurement-ready equipment and components"
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/bought-out/new')}
          >
            New Item
          </Button>
        }
      />

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
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            sx={{ flex: 1, minWidth: 240 }}
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
          <Chip
            icon={<RateReviewIcon />}
            label={reviewOnly ? 'Showing items to review' : 'Needs review'}
            color={reviewOnly ? 'warning' : 'default'}
            variant={reviewOnly ? 'filled' : 'outlined'}
            onClick={() => setReviewOnly((v) => !v)}
            onDelete={reviewOnly ? () => setReviewOnly(false) : undefined}
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
              <LoadingState
                message="Loading items..."
                variant="table"
                colSpan={6 + dynamicColumns.length}
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                message="No items found"
                variant="table"
                colSpan={6 + dynamicColumns.length}
              />
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {item.itemCode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body1">{item.name}</Typography>
                      {item.needsReview && (
                        <Chip
                          icon={<RateReviewIcon />}
                          label="Needs review"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </Box>
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
                    <TableActionCell
                      actions={[
                        {
                          icon: <EditIcon />,
                          label: 'Edit Item',
                          onClick: () => router.push(`/bought-out/${item.id}`),
                          color: 'primary',
                        },
                        {
                          icon: <DeleteIcon />,
                          label: 'Delete Item',
                          onClick: () => handleDelete(item.id),
                          color: 'error',
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

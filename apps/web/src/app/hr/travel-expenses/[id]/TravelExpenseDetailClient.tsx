'use client';

import { useState } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Flight,
  Train,
  DirectionsCar,
  Hotel,
  Restaurant,
  LocalTaxi,
  Receipt,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  useTravelExpenseReport,
  useAddExpenseItem,
  useRemoveExpenseItem,
  TRAVEL_EXPENSE_STATUS_COLORS,
  TRAVEL_EXPENSE_STATUS_LABELS,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  getExpenseCategoryOptions,
  formatExpenseDate,
  formatExpenseAmount,
  formatTripDateRange,
} from '@/lib/hr';
import type { TravelExpenseCategory } from '@vapour/types';

// Icon map for categories
const CATEGORY_ICONS: Record<TravelExpenseCategory, React.ReactElement> = {
  AIR_TRAVEL: <Flight fontSize="small" />,
  TRAIN_TRAVEL: <Train fontSize="small" />,
  ROAD_TRAVEL: <DirectionsCar fontSize="small" />,
  HOTEL: <Hotel fontSize="small" />,
  FOOD: <Restaurant fontSize="small" />,
  LOCAL_CONVEYANCE: <LocalTaxi fontSize="small" />,
  OTHER: <Receipt fontSize="small" />,
};

interface TravelExpenseDetailClientProps {
  reportId: string;
}

export default function TravelExpenseDetailClient({ reportId }: TravelExpenseDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  const { data: report, isLoading, error, refetch } = useTravelExpenseReport(reportId);
  const addItemMutation = useAddExpenseItem();
  const removeItemMutation = useRemoveExpenseItem();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Add item form state
  const [newItem, setNewItem] = useState({
    category: 'OTHER' as TravelExpenseCategory,
    description: '',
    expenseDate: new Date(),
    amount: '',
    vendorName: '',
    fromLocation: '',
    toLocation: '',
  });

  const isDraft = report?.status === 'DRAFT';
  const isOwner = report?.employeeId === user?.uid;
  const canEdit = isDraft && isOwner;

  const categoryOptions = getExpenseCategoryOptions();

  const handleAddItem = async () => {
    if (!user || !report) return;

    const amount = parseFloat(newItem.amount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    try {
      await addItemMutation.mutateAsync({
        reportId,
        input: {
          category: newItem.category,
          description: newItem.description.trim(),
          expenseDate: newItem.expenseDate,
          amount,
          vendorName: newItem.vendorName.trim() || undefined,
          fromLocation: newItem.fromLocation.trim() || undefined,
          toLocation: newItem.toLocation.trim() || undefined,
        },
        userId: user.uid,
      });

      setAddDialogOpen(false);
      setNewItem({
        category: 'OTHER',
        description: '',
        expenseDate: new Date(),
        amount: '',
        vendorName: '',
        fromLocation: '',
        toLocation: '',
      });
      refetch();
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !deleteItemId) return;

    try {
      await removeItemMutation.mutateAsync({
        reportId,
        itemId: deleteItemId,
        userId: user.uid,
      });
      setDeleteItemId(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const showLocationFields =
    newItem.category === 'AIR_TRAVEL' ||
    newItem.category === 'TRAIN_TRAVEL' ||
    newItem.category === 'ROAD_TRAVEL';

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        <Alert severity="error">
          Failed to load travel expense report.{' '}
          <Button size="small" onClick={() => router.back()}>
            Go Back
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => router.push('/hr/travel-expenses')}>
            Back
          </Button>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h5" component="h1">
                {report.reportNumber}
              </Typography>
              <Chip
                label={TRAVEL_EXPENSE_STATUS_LABELS[report.status]}
                color={TRAVEL_EXPENSE_STATUS_COLORS[report.status]}
                size="small"
              />
            </Box>
            <Typography variant="body1" color="text.secondary">
              {report.tripPurpose}
            </Typography>
          </Box>
        </Box>

        {/* Trip Summary Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Trip Dates
                </Typography>
                <Typography variant="body1">
                  {formatTripDateRange(report.tripStartDate.toDate(), report.tripEndDate.toDate())}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Destinations
                </Typography>
                <Typography variant="body1">{report.destinations.join(', ')}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Amount
                </Typography>
                <Typography variant="h6" color="primary.main">
                  {formatExpenseAmount(report.totalAmount, report.currency)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  GST Amount
                </Typography>
                <Typography variant="body1">
                  {formatExpenseAmount(report.totalGstAmount, report.currency)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Expense Items */}
        <Card>
          <CardContent>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography variant="h6">Expense Items</Typography>
              {canEdit && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAddDialogOpen(true)}
                >
                  Add Expense
                </Button>
              )}
            </Box>

            {report.items.length === 0 ? (
              <Alert severity="info">
                No expense items added yet.
                {canEdit && ' Click "Add Expense" to add your first expense item.'}
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      {canEdit && <TableCell align="center">Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Chip
                            icon={CATEGORY_ICONS[item.category]}
                            label={EXPENSE_CATEGORY_LABELS[item.category]}
                            size="small"
                            color={EXPENSE_CATEGORY_COLORS[item.category]}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.fromLocation && item.toLocation && (
                            <Typography variant="caption" color="text.secondary">
                              {item.fromLocation} → {item.toLocation}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{formatExpenseDate(item.expenseDate.toDate())}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.vendorName || '-'}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {formatExpenseAmount(item.amount, item.currency)}
                          </Typography>
                          {item.gstAmount && item.gstAmount > 0 && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              GST: {formatExpenseAmount(item.gstAmount, item.currency)}
                            </Typography>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteItemId(item.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Category Totals */}
            {report.items.length > 0 && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Category Summary
                </Typography>
                <Grid container spacing={2}>
                  {(Object.keys(report.categoryTotals) as TravelExpenseCategory[]).map(
                    (category) => (
                      <Grid size={{ xs: 6, sm: 4, md: 3 }} key={category}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {CATEGORY_ICONS[category]}
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {EXPENSE_CATEGORY_LABELS[category]}
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {formatExpenseAmount(
                                report.categoryTotals[category] || 0,
                                report.currency
                              )}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    )
                  )}
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Add Item Dialog */}
        <Dialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Expense Item</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  label="Category"
                  fullWidth
                  value={newItem.category}
                  onChange={(e) =>
                    setNewItem({ ...newItem, category: e.target.value as TravelExpenseCategory })
                  }
                >
                  {categoryOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {CATEGORY_ICONS[option.value]}
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Description"
                  fullWidth
                  required
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="e.g., Flight ticket to Mumbai"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Expense Date"
                  value={newItem.expenseDate}
                  onChange={(date) => {
                    const newDate = date as Date | null;
                    setNewItem({ ...newItem, expenseDate: newDate || new Date() });
                  }}
                  slotProps={{
                    textField: { fullWidth: true, required: true },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Amount (INR)"
                  fullWidth
                  required
                  type="number"
                  value={newItem.amount}
                  onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Vendor Name"
                  fullWidth
                  value={newItem.vendorName}
                  onChange={(e) => setNewItem({ ...newItem, vendorName: e.target.value })}
                  placeholder="e.g., Indigo Airlines, IRCTC, Uber"
                />
              </Grid>

              {showLocationFields && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="From Location"
                      fullWidth
                      value={newItem.fromLocation}
                      onChange={(e) => setNewItem({ ...newItem, fromLocation: e.target.value })}
                      placeholder="e.g., Chennai"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="To Location"
                      fullWidth
                      value={newItem.toLocation}
                      onChange={(e) => setNewItem({ ...newItem, toLocation: e.target.value })}
                      placeholder="e.g., Mumbai"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAddItem}
              disabled={
                !newItem.description.trim() ||
                !newItem.amount ||
                parseFloat(newItem.amount) <= 0 ||
                addItemMutation.isPending
              }
            >
              {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteItemId} onClose={() => setDeleteItemId(null)}>
          <DialogTitle>Delete Expense Item?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this expense item? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteItemId(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteItem}
              disabled={removeItemMutation.isPending}
            >
              {removeItemMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}

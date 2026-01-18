'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Grid,
  Typography,
  Paper,
  Divider,
  Alert,
  Autocomplete,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  RecurringTransactionType,
  RecurrenceFrequency,
  RecurringTransactionInput,
  CurrencyCode,
} from '@vapour/types';

interface Entity {
  id: string;
  name: string;
  type: 'CUSTOMER' | 'VENDOR';
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Employee {
  id: string;
  name: string;
  employeeId?: string;
  department?: string;
}

interface RecurringTransactionFormProps {
  initialData?: Partial<RecurringTransactionInput> & { id?: string };
  onSubmit: (data: RecurringTransactionInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const TYPE_OPTIONS: { value: RecurringTransactionType; label: string; description: string }[] = [
  {
    value: 'VENDOR_BILL',
    label: 'Vendor Bill',
    description: 'Recurring bills like rent, subscriptions, utilities',
  },
  {
    value: 'CUSTOMER_INVOICE',
    label: 'Customer Invoice',
    description: 'Recurring invoices for retainers, maintenance contracts',
  },
  { value: 'SALARY', label: 'Salary', description: 'Monthly employee salary payments' },
  {
    value: 'JOURNAL_ENTRY',
    label: 'Journal Entry',
    description: 'Recurring journal entries like depreciation',
  },
];

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const CURRENCY_OPTIONS: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'];

const DAY_OF_MONTH_OPTIONS = [
  { value: 1, label: '1st' },
  { value: 5, label: '5th' },
  { value: 10, label: '10th' },
  { value: 15, label: '15th' },
  { value: 20, label: '20th' },
  { value: 25, label: '25th' },
  { value: 0, label: 'Last day' },
];

export default function RecurringTransactionForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: RecurringTransactionFormProps) {
  const [formData, setFormData] = useState<RecurringTransactionInput>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    type: initialData?.type || 'VENDOR_BILL',
    frequency: initialData?.frequency || 'MONTHLY',
    startDate: initialData?.startDate || new Date(),
    endDate: initialData?.endDate,
    dayOfMonth: initialData?.dayOfMonth || 1,
    dayOfWeek: initialData?.dayOfWeek,
    amount: initialData?.amount || 0,
    currency: initialData?.currency || 'INR',
    vendorId: initialData?.vendorId,
    customerId: initialData?.customerId,
    employeeIds: initialData?.employeeIds || [],
    expenseAccountId: initialData?.expenseAccountId,
    revenueAccountId: initialData?.revenueAccountId,
    paymentTermDays: initialData?.paymentTermDays || 30,
    autoGenerate: initialData?.autoGenerate ?? true,
    daysBeforeToGenerate: initialData?.daysBeforeToGenerate ?? 5,
    requiresApproval: initialData?.requiresApproval ?? false,
  });

  const [vendors, setVendors] = useState<Entity[]>([]);
  const [customers, setCustomers] = useState<Entity[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load entities and accounts
  useEffect(() => {
    const loadData = async () => {
      const { db } = getFirebase();

      try {
        // Load vendors - entities with VENDOR role
        // Using array-contains for roles array, with status filter and name ordering
        const vendorQuery = query(
          collection(db, COLLECTIONS.ENTITIES),
          where('roles', 'array-contains', 'VENDOR'),
          where('status', '==', 'ACTIVE'),
          orderBy('name', 'asc')
        );
        const vendorSnap = await getDocs(vendorQuery);
        setVendors(
          vendorSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            type: 'VENDOR' as const,
          }))
        );

        // Load customers - entities with CUSTOMER role
        const customerQuery = query(
          collection(db, COLLECTIONS.ENTITIES),
          where('roles', 'array-contains', 'CUSTOMER'),
          where('status', '==', 'ACTIVE'),
          orderBy('name', 'asc')
        );
        const customerSnap = await getDocs(customerQuery);
        setCustomers(
          customerSnap.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            type: 'CUSTOMER' as const,
          }))
        );

        // Load expense accounts
        const expenseQuery = query(
          collection(db, COLLECTIONS.ACCOUNTS),
          where('type', '==', 'EXPENSE'),
          orderBy('code', 'asc')
        );
        const expenseSnap = await getDocs(expenseQuery);
        setExpenseAccounts(
          expenseSnap.docs.map((doc) => ({
            id: doc.id,
            code: doc.data().code,
            name: doc.data().name,
            type: doc.data().type,
          }))
        );

        // Load revenue accounts
        const revenueQuery = query(
          collection(db, COLLECTIONS.ACCOUNTS),
          where('type', '==', 'INCOME'),
          orderBy('code', 'asc')
        );
        const revenueSnap = await getDocs(revenueQuery);
        setRevenueAccounts(
          revenueSnap.docs.map((doc) => ({
            id: doc.id,
            code: doc.data().code,
            name: doc.data().name,
            type: doc.data().type,
          }))
        );

        // Load active employees for salary recurring transactions
        const employeeQuery = query(
          collection(db, COLLECTIONS.USERS),
          where('isActive', '==', true),
          orderBy('displayName', 'asc')
        );
        const employeeSnap = await getDocs(employeeQuery);
        setEmployees(
          employeeSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.displayName || data.email,
              employeeId: data.hrProfile?.employeeId,
              department: data.department,
            };
          })
        );
      } catch (err) {
        console.error('[RecurringForm] Error loading data:', err);
      }
    };

    loadData();
  }, []);

  const handleChange = <K extends keyof RecurringTransactionInput>(
    field: K,
    value: RecurringTransactionInput[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (formData.amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (formData.type === 'VENDOR_BILL' && !formData.vendorId) {
      setError('Please select a vendor');
      return;
    }

    if (formData.type === 'CUSTOMER_INVOICE' && !formData.customerId) {
      setError('Please select a customer');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const showDayOfMonth =
    formData.frequency === 'MONTHLY' ||
    formData.frequency === 'QUARTERLY' ||
    formData.frequency === 'YEARLY';

  return (
    <Paper sx={{ p: 3 }}>
      <form onSubmit={handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Basic Info */}
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              placeholder="e.g., Monthly Rent - ABC Building"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              multiline
              rows={2}
              placeholder="Optional description for this recurring transaction"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => handleChange('type', e.target.value as RecurringTransactionType)}
              >
                {TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box>
                      <Typography variant="body2">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Schedule */}
        <Typography variant="h6" gutterBottom>
          Schedule
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={formData.frequency}
                label="Frequency"
                onChange={(e) => handleChange('frequency', e.target.value as RecurrenceFrequency)}
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <DatePicker
              label="Start Date"
              value={formData.startDate}
              onChange={(date) => date && handleChange('startDate', date)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <DatePicker
              label="End Date (Optional)"
              value={formData.endDate || null}
              onChange={(date) => handleChange('endDate', date || undefined)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          {showDayOfMonth && (
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Day of Month</InputLabel>
                <Select
                  value={formData.dayOfMonth || 1}
                  label="Day of Month"
                  onChange={(e) => handleChange('dayOfMonth', Number(e.target.value))}
                >
                  {DAY_OF_MONTH_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Financial */}
        <Typography variant="h6" gutterBottom>
          Financial Details
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(e) => handleChange('amount', Number(e.target.value))}
              required
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select
                value={formData.currency}
                label="Currency"
                onChange={(e) => handleChange('currency', e.target.value as CurrencyCode)}
              >
                {CURRENCY_OPTIONS.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {(formData.type === 'VENDOR_BILL' || formData.type === 'CUSTOMER_INVOICE') && (
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Payment Term (Days)"
                type="number"
                value={formData.paymentTermDays || 30}
                onChange={(e) => handleChange('paymentTermDays', Number(e.target.value))}
                inputProps={{ min: 0 }}
              />
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Type-specific fields */}
        {formData.type === 'VENDOR_BILL' && (
          <>
            <Typography variant="h6" gutterBottom>
              Vendor Details
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  options={vendors}
                  getOptionLabel={(option) => option.name}
                  value={vendors.find((v) => v.id === formData.vendorId) || null}
                  onChange={(_, value) => handleChange('vendorId', value?.id)}
                  renderInput={(params) => (
                    <TextField {...params} label="Vendor" required fullWidth />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  options={expenseAccounts}
                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                  value={expenseAccounts.find((a) => a.id === formData.expenseAccountId) || null}
                  onChange={(_, value) => handleChange('expenseAccountId', value?.id)}
                  renderInput={(params) => (
                    <TextField {...params} label="Expense Account" fullWidth />
                  )}
                />
              </Grid>
            </Grid>
          </>
        )}

        {formData.type === 'CUSTOMER_INVOICE' && (
          <>
            <Typography variant="h6" gutterBottom>
              Customer Details
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => option.name}
                  value={customers.find((c) => c.id === formData.customerId) || null}
                  onChange={(_, value) => handleChange('customerId', value?.id)}
                  renderInput={(params) => (
                    <TextField {...params} label="Customer" required fullWidth />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  options={revenueAccounts}
                  getOptionLabel={(option) => `${option.code} - ${option.name}`}
                  value={revenueAccounts.find((a) => a.id === formData.revenueAccountId) || null}
                  onChange={(_, value) => handleChange('revenueAccountId', value?.id)}
                  renderInput={(params) => (
                    <TextField {...params} label="Revenue Account" fullWidth />
                  )}
                />
              </Grid>
            </Grid>
          </>
        )}

        {formData.type === 'SALARY' && (
          <>
            <Typography variant="h6" gutterBottom>
              Employee Details
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  multiple
                  options={employees}
                  getOptionLabel={(option) =>
                    option.employeeId ? `${option.employeeId} - ${option.name}` : option.name
                  }
                  value={employees.filter((e) => formData.employeeIds?.includes(e.id))}
                  onChange={(_, values) =>
                    handleChange(
                      'employeeIds',
                      values.map((v) => v.id)
                    )
                  }
                  groupBy={(option) => option.department || 'No Department'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Employees"
                      placeholder="Search employees..."
                      helperText={
                        formData.employeeIds?.length
                          ? `${formData.employeeIds.length} employee(s) selected`
                          : 'Leave empty to include all active employees'
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mb: 3 }}>
              {formData.employeeIds?.length
                ? `Salary payments will be generated for ${formData.employeeIds.length} selected employee(s).`
                : 'No employees selected - salary payments will be generated for all active employees.'}{' '}
              The amount field can be used for a fixed total or left at 0 for individual salary
              amounts.
            </Alert>
          </>
        )}

        {formData.type === 'JOURNAL_ENTRY' && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Journal entry templates allow you to create recurring journal entries like depreciation
            or amortization. Configure the debit and credit accounts in the detail view after
            creation.
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Automation Settings */}
        <Typography variant="h6" gutterBottom>
          Automation Settings
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.autoGenerate}
                  onChange={(e) => handleChange('autoGenerate', e.target.checked)}
                />
              }
              label="Auto-generate transactions"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              Automatically create transactions on schedule
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Days before to generate"
              type="number"
              value={formData.daysBeforeToGenerate}
              onChange={(e) => handleChange('daysBeforeToGenerate', Number(e.target.value))}
              inputProps={{ min: 0, max: 30 }}
              helperText="Generate N days before due date"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.requiresApproval}
                  onChange={(e) => handleChange('requiresApproval', e.target.checked)}
                />
              }
              label="Requires approval"
            />
            <Typography variant="caption" color="text.secondary" display="block">
              Generated transactions need manual approval
            </Typography>
          </Grid>
        </Grid>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {initialData?.id ? 'Update' : 'Create'} Recurring Transaction
          </Button>
        </Box>
      </form>
    </Paper>
  );
}

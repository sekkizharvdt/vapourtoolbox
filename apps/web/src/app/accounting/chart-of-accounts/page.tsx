'use client';

import { useState, useEffect } from 'react';
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
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Download as ImportIcon,
  AccountTree as TreeIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Account, AccountType } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageChartOfAccounts } from '@vapour/constants';
import { AccountTreeView } from '@/components/accounting/AccountTreeView';
import { CreateAccountDialog } from '@/components/accounting/CreateAccountDialog';
import { ImportCOADialog } from '@/components/accounting/ImportCOADialog';

export default function ChartOfAccountsPage() {
  const { claims } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountType | 'all'>('all');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const canManage = claims?.permissions ? canManageChartOfAccounts(claims.permissions) : false;

  // Load accounts from Firestore
  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const { db } = getFirebase();
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

    // Query accounts ordered by code
    const q = query(accountsRef, orderBy('code', 'asc'));

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const accountsData: Account[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          accountsData.push({
            id: doc.id,
            code: data.code,
            name: data.name,
            description: data.description,
            accountType: data.accountType,
            accountCategory: data.accountCategory,
            accountGroup: data.accountGroup,
            parentAccountId: data.parentAccountId,
            level: data.level,
            isGroup: data.isGroup,
            isActive: data.isActive ?? true,
            isSystemAccount: data.isSystemAccount ?? false,
            openingBalance: data.openingBalance ?? 0,
            currentBalance: data.currentBalance ?? 0,
            currency: data.currency ?? 'INR',
            isGSTAccount: data.isGSTAccount ?? false,
            gstType: data.gstType,
            gstDirection: data.gstDirection,
            isTDSAccount: data.isTDSAccount ?? false,
            tdsSection: data.tdsSection,
            isBankAccount: data.isBankAccount ?? false,
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            ifscCode: data.ifscCode,
            branch: data.branch,
            createdAt: data.createdAt?.toDate() || new Date(),
            createdBy: data.createdBy || '',
            updatedAt: data.updatedAt?.toDate() || new Date(),
            updatedBy: data.updatedBy,
          } as Account);
        });
        setAccounts(accountsData);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Error loading accounts:', err);
        setError('Failed to load accounts. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [hasViewAccess]);

  // Filter accounts
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      searchTerm === '' ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.includes(searchTerm) ||
      (account.description && account.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = accountTypeFilter === 'all' || account.accountType === accountTypeFilter;

    return matchesSearch && matchesType;
  });

  const handleRefresh = () => {
    setLoading(true);
    // The onSnapshot will automatically refresh
    setTimeout(() => setLoading(false), 500);
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Chart of Accounts
          </Typography>
          <Alert severity="error">
            You do not have permission to access the Chart of Accounts.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Chart of Accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {accounts.length} accounts • Hierarchical account structure
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {canManage && accounts.length === 0 && (
              <Button
                variant="outlined"
                startIcon={<ImportIcon />}
                onClick={() => setImportDialogOpen(true)}
              >
                Import Indian COA
              </Button>
            )}
            {canManage && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                New Account
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1 }}
            size="small"
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Account Type</InputLabel>
            <Select
              value={accountTypeFilter}
              label="Account Type"
              onChange={(e) => setAccountTypeFilter(e.target.value as AccountType | 'all')}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="ASSET">Assets</MenuItem>
              <MenuItem value="LIABILITY">Liabilities</MenuItem>
              <MenuItem value="EQUITY">Equity</MenuItem>
              <MenuItem value="INCOME">Income</MenuItem>
              <MenuItem value="EXPENSE">Expenses</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!loading && accounts.length === 0 && (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <TreeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Chart of Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Get started by importing the Indian Chart of Accounts template or create accounts manually.
          </Typography>
          {canManage && (
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<ImportIcon />}
                onClick={() => setImportDialogOpen(true)}
              >
                Import Indian COA
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Manually
              </Button>
            </Stack>
          )}
        </Paper>
      )}

      {/* Account Tree View */}
      {!loading && filteredAccounts.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <AccountTreeView accounts={filteredAccounts} />
        </Paper>
      )}

      {/* No Results */}
      {!loading && accounts.length > 0 && filteredAccounts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No accounts match your search criteria.
          </Typography>
        </Paper>
      )}

      {/* Dialogs */}
      <CreateAccountDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        accounts={accounts}
      />
      <ImportCOADialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />
    </Container>
  );
}

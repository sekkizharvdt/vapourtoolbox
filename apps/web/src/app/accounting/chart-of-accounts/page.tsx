'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Card,
  CardContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  AccountTree as TreeIcon,
  AccountBalance as AssetIcon,
  TrendingDown as LiabilityIcon,
  AccountBalanceWallet as EquityIcon,
  TrendingUp as IncomeIcon,
  MoneyOff as ExpenseIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Account, AccountType } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageChartOfAccounts } from '@vapour/constants';
import { AccountTreeView } from '@/components/accounting/AccountTreeView';
import { CreateAccountDialog } from '@/components/accounting/CreateAccountDialog';
import { initializeChartOfAccounts } from '@/lib/initializeChartOfAccounts';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ChartOfAccounts' });

export default function ChartOfAccountsPage() {
  const { claims, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountType | 'all'>('all');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const canManage = claims?.permissions ? canManageChartOfAccounts(claims.permissions) : false;

  // Calculate statistics from accounts
  const statistics = useMemo(() => {
    const assetCount = accounts.filter((a) => a.accountType === 'ASSET').length;
    const liabilityCount = accounts.filter((a) => a.accountType === 'LIABILITY').length;
    const equityCount = accounts.filter((a) => a.accountType === 'EQUITY').length;
    const incomeCount = accounts.filter((a) => a.accountType === 'INCOME').length;
    const expenseCount = accounts.filter((a) => a.accountType === 'EXPENSE').length;
    const activeCount = accounts.filter((a) => a.isActive).length;
    const groupCount = accounts.filter((a) => a.isGroup).length;
    const leafCount = accounts.filter((a) => !a.isGroup).length;

    return {
      assetCount,
      liabilityCount,
      equityCount,
      incomeCount,
      expenseCount,
      activeCount,
      groupCount,
      leafCount,
      totalCount: accounts.length,
    };
  }, [accounts]);

  // Auto-initialize Chart of Accounts if empty
  useEffect(() => {
    if (!hasViewAccess || !canManage || !user) return;

    const initializeIfEmpty = async () => {
      if (accounts.length === 0 && !loading && !initializing) {
        logger.info('Accounts collection is empty, initializing');
        setInitializing(true);

        const result = await initializeChartOfAccounts(user.uid);

        if (!result.success) {
          setError(`Failed to initialize Chart of Accounts: ${result.error}`);
        } else if (result.accountsCreated > 0) {
          logger.info('Initialized accounts', { count: result.accountsCreated });
        }

        setInitializing(false);
      }
    };

    initializeIfEmpty();
  }, [accounts.length, hasViewAccess, canManage, user, loading, initializing]);

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

  // Tree-aware filtering to maintain hierarchy
  const filteredAccounts = useMemo(() => {
    // If no filters, return all accounts
    if (searchTerm === '' && accountTypeFilter === 'all') {
      return accounts;
    }

    // Create a map for quick account lookup by ID
    const accountMap = new Map<string, Account>();
    accounts.forEach((acc) => accountMap.set(acc.id, acc));

    // Helper function to get all ancestors of an account
    const getAncestors = (accountId: string): Set<string> => {
      const ancestors = new Set<string>();
      let current = accountMap.get(accountId);

      while (current?.parentAccountId) {
        ancestors.add(current.parentAccountId);
        current = accountMap.get(current.parentAccountId);
      }

      return ancestors;
    };

    // Find accounts matching the filter criteria
    const matchingAccountIds = new Set<string>();
    accounts.forEach((account) => {
      const matchesSearch =
        searchTerm === '' ||
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.code.includes(searchTerm) ||
        (account.description &&
          account.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = accountTypeFilter === 'all' || account.accountType === accountTypeFilter;

      if (matchesSearch && matchesType) {
        matchingAccountIds.add(account.id);
      }
    });

    // Include all ancestors of matching accounts to maintain tree structure
    const accountsToInclude = new Set<string>(matchingAccountIds);
    matchingAccountIds.forEach((accountId) => {
      const ancestors = getAncestors(accountId);
      ancestors.forEach((ancestorId) => accountsToInclude.add(ancestorId));
    });

    // Filter accounts to include only those in our set
    return accounts.filter((account) => accountsToInclude.has(account.id));
  }, [accounts, searchTerm, accountTypeFilter]);

  const handleRefresh = () => {
    setLoading(true);
    // The onSnapshot will automatically refresh
    setTimeout(() => setLoading(false), 500);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setEditingAccount(null);
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
              {statistics.totalCount} total • {statistics.activeCount} active •{' '}
              {statistics.groupCount} groups • {statistics.leafCount} accounts
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
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

      {/* Statistics Cards */}
      {accounts.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 3, overflow: 'auto' }}>
          <Card sx={{ minWidth: 200, flexGrow: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <AssetIcon sx={{ fontSize: 40, color: 'success.main' }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {statistics.assetCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Assets
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 200, flexGrow: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <LiabilityIcon sx={{ fontSize: 40, color: 'error.main' }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {statistics.liabilityCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Liabilities
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 200, flexGrow: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <EquityIcon sx={{ fontSize: 40, color: 'info.main' }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {statistics.equityCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Equity
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 200, flexGrow: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <IncomeIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {statistics.incomeCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Income
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 200, flexGrow: 1 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <ExpenseIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {statistics.expenseCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expenses
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}

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
      {(loading || initializing) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
          <CircularProgress />
          {initializing && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Initializing Chart of Accounts with Indian COA template...
            </Typography>
          )}
        </Box>
      )}

      {/* Empty State (should not occur after auto-init) */}
      {!loading && !initializing && accounts.length === 0 && (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <TreeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Chart of Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Initialize with the Indian Chart of Accounts template or create accounts manually.
          </Typography>
          {canManage && (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  if (!user) return;
                  setInitializing(true);
                  const result = await initializeChartOfAccounts(user.uid);
                  if (!result.success) {
                    setError(`Failed to initialize: ${result.error}`);
                  }
                  setInitializing(false);
                }}
              >
                Initialize Indian COA
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
          <AccountTreeView
            accounts={filteredAccounts}
            onEdit={canManage ? handleEditAccount : undefined}
          />
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
        onClose={handleCloseDialog}
        accounts={accounts}
        editingAccount={editingAccount}
      />
    </Container>
  );
}

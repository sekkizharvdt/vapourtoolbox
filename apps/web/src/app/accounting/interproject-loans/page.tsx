'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  LinearProgress,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  Add as AddIcon,
  Payment as PaymentIcon,
  Home as HomeIcon,
  AccountBalance as LoanIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { InterprojectLoan, CostCentre } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import {
  getInterprojectLoans,
  createInterprojectLoan,
  recordRepayment,
  type CreateInterprojectLoanInput,
  type RecordRepaymentInput,
} from '@/lib/accounting/interprojectLoanService';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/common/Toast';

export default function InterprojectLoansPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRepaymentDialogOpen, setIsRepaymentDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<InterprojectLoan | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state for new loan
  const [newLoan, setNewLoan] = useState({
    lendingProjectId: '',
    borrowingProjectId: '',
    principalAmount: '',
    interestRate: '',
    interestCalculationMethod: 'SIMPLE' as 'SIMPLE' | 'COMPOUND',
    startDate: new Date().toISOString().split('T')[0] || '',
    maturityDate: '',
    repaymentFrequency: 'MONTHLY' as
      | 'MONTHLY'
      | 'QUARTERLY'
      | 'SEMI_ANNUALLY'
      | 'ANNUALLY'
      | 'BULLET',
    notes: '',
  });

  // Form state for repayment
  const [repayment, setRepayment] = useState({
    principalAmount: '',
    interestAmount: '',
    repaymentDate: new Date().toISOString().split('T')[0] || '',
    notes: '',
  });

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);
  const { db } = getFirebase();

  // Fetch cost centres (projects)
  const { data: costCentres = [] } = useQuery({
    queryKey: ['costCentres'],
    queryFn: async () => {
      if (!db) return [];
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.COST_CENTRES), where('isActive', '==', true))
      );
      return snapshot.docs.map((doc) => docToTyped<CostCentre>(doc.id, doc.data()));
    },
    enabled: !!db,
  });

  // Fetch loans
  const {
    data: loans = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['interprojectLoans', statusFilter],
    queryFn: async () => {
      if (!db) return [];
      const filters =
        statusFilter !== 'all' ? { status: statusFilter as InterprojectLoan['status'] } : undefined;
      return getInterprojectLoans(db, filters);
    },
    enabled: !!db,
  });

  // Calculate summary
  const summary = useMemo(
    () => ({
      totalLoans: loans.length,
      activeLoans: loans.filter((l) => ['ACTIVE', 'PARTIALLY_REPAID'].includes(l.status)).length,
      totalPrincipal: loans.reduce((sum, l) => sum + l.principalAmount, 0),
      totalOutstanding: loans
        .filter((l) => ['ACTIVE', 'PARTIALLY_REPAID'].includes(l.status))
        .reduce((sum, l) => sum + l.remainingPrincipal, 0),
    }),
    [loans]
  );

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async (input: CreateInterprojectLoanInput) => {
      if (!db) throw new Error('Database not available');
      return createInterprojectLoan(db, input);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Loan ${result.loanNumber} created successfully`);
        queryClient.invalidateQueries({ queryKey: ['interprojectLoans'] });
        setIsCreateDialogOpen(false);
        resetNewLoanForm();
      } else {
        toast.error(result.error || 'Failed to create loan');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create loan');
    },
  });

  // Record repayment mutation
  const recordRepaymentMutation = useMutation({
    mutationFn: async (input: RecordRepaymentInput) => {
      if (!db) throw new Error('Database not available');
      return recordRepayment(db, input);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Repayment recorded successfully');
        queryClient.invalidateQueries({ queryKey: ['interprojectLoans'] });
        setIsRepaymentDialogOpen(false);
        setSelectedLoan(null);
        resetRepaymentForm();
      } else {
        toast.error(result.error || 'Failed to record repayment');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to record repayment');
    },
  });

  const resetNewLoanForm = () => {
    setNewLoan({
      lendingProjectId: '',
      borrowingProjectId: '',
      principalAmount: '',
      interestRate: '',
      interestCalculationMethod: 'SIMPLE',
      startDate: new Date().toISOString().split('T')[0] || '',
      maturityDate: '',
      repaymentFrequency: 'MONTHLY',
      notes: '',
    });
  };

  const resetRepaymentForm = () => {
    setRepayment({
      principalAmount: '',
      interestAmount: '',
      repaymentDate: new Date().toISOString().split('T')[0] || '',
      notes: '',
    });
  };

  const handleCreateLoan = () => {
    if (!user) return;

    createLoanMutation.mutate({
      lendingProjectId: newLoan.lendingProjectId,
      borrowingProjectId: newLoan.borrowingProjectId,
      principalAmount: parseFloat(newLoan.principalAmount),
      interestRate: parseFloat(newLoan.interestRate),
      interestCalculationMethod: newLoan.interestCalculationMethod,
      startDate: new Date(newLoan.startDate),
      maturityDate: new Date(newLoan.maturityDate),
      repaymentFrequency: newLoan.repaymentFrequency,
      notes: newLoan.notes,
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown',
    });
  };

  const handleRecordRepayment = () => {
    if (!user || !selectedLoan) return;

    recordRepaymentMutation.mutate({
      loanId: selectedLoan.id,
      principalAmount: parseFloat(repayment.principalAmount) || 0,
      interestAmount: parseFloat(repayment.interestAmount) || 0,
      repaymentDate: new Date(repayment.repaymentDate),
      notes: repayment.notes,
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown',
    });
  };

  const getStatusChip = (status: InterprojectLoan['status']) => {
    const colors: Record<InterprojectLoan['status'], 'default' | 'primary' | 'success' | 'error'> =
      {
        ACTIVE: 'primary',
        PARTIALLY_REPAID: 'default',
        FULLY_REPAID: 'success',
        DEFAULTED: 'error',
        WRITTEN_OFF: 'error',
      };

    return <Chip label={status.replace('_', ' ')} color={colors[status]} size="small" />;
  };

  const getProjectName = (projectId: string) => {
    const project = costCentres.find((c) => c.id === projectId);
    return project?.name || projectId;
  };

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Error loading interproject loans: {String(error)}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => router.push('/accounting')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Accounting
        </Link>
        <Typography color="text.primary">Interproject Loans</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Interproject Loans
          </Typography>
          <Typography color="text.secondary">
            Manage loans between projects with automatic journal entries
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
          >
            New Loan
          </Button>
        )}
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Loans
              </Typography>
              <Typography variant="h4">{summary.totalLoans}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Active Loans
              </Typography>
              <Typography variant="h4">{summary.activeLoans}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Total Principal
              </Typography>
              <Typography variant="h5">{formatCurrency(summary.totalPrincipal)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="body2">
                Outstanding Balance
              </Typography>
              <Typography variant="h5">{formatCurrency(summary.totalOutstanding)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="PARTIALLY_REPAID">Partially Repaid</MenuItem>
            <MenuItem value="FULLY_REPAID">Fully Repaid</MenuItem>
            <MenuItem value="DEFAULTED">Defaulted</MenuItem>
            <MenuItem value="WRITTEN_OFF">Written Off</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Loans Table */}
      <TableContainer component={Paper}>
        {isLoading && <LinearProgress />}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Loan #</TableCell>
              <TableCell>Lender</TableCell>
              <TableCell>Borrower</TableCell>
              <TableCell align="right">Principal</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell>Interest</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Maturity</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loans.length === 0 && !isLoading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Box py={4}>
                    <LoanIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      No interproject loans found. Create your first loan to get started.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              loans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <Typography fontWeight="medium">{loan.loanNumber}</Typography>
                  </TableCell>
                  <TableCell>{getProjectName(loan.lendingProjectId)}</TableCell>
                  <TableCell>{getProjectName(loan.borrowingProjectId)}</TableCell>
                  <TableCell align="right">{formatCurrency(loan.principalAmount)}</TableCell>
                  <TableCell align="right">{formatCurrency(loan.remainingPrincipal)}</TableCell>
                  <TableCell>
                    {loan.interestRate}% {loan.interestCalculationMethod}
                  </TableCell>
                  <TableCell>{getStatusChip(loan.status)}</TableCell>
                  <TableCell>
                    {loan.maturityDate instanceof Date
                      ? loan.maturityDate.toLocaleDateString()
                      : new Date(loan.maturityDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center">
                    {canManage && ['ACTIVE', 'PARTIALLY_REPAID'].includes(loan.status) && (
                      <Tooltip title="Record Payment">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setIsRepaymentDialogOpen(true);
                          }}
                        >
                          <PaymentIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Loan Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Interproject Loan</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a new loan between two projects. Journal entries will be generated automatically.
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Lending Project</InputLabel>
                <Select
                  value={newLoan.lendingProjectId}
                  label="Lending Project"
                  onChange={(e) => setNewLoan({ ...newLoan, lendingProjectId: e.target.value })}
                >
                  {costCentres.map((cc) => (
                    <MenuItem key={cc.id} value={cc.id}>
                      {cc.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Borrowing Project</InputLabel>
                <Select
                  value={newLoan.borrowingProjectId}
                  label="Borrowing Project"
                  onChange={(e) => setNewLoan({ ...newLoan, borrowingProjectId: e.target.value })}
                >
                  {costCentres
                    .filter((cc) => cc.id !== newLoan.lendingProjectId)
                    .map((cc) => (
                      <MenuItem key={cc.id} value={cc.id}>
                        {cc.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Principal Amount"
                type="number"
                value={newLoan.principalAmount}
                onChange={(e) => setNewLoan({ ...newLoan, principalAmount: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Interest Rate (%)"
                type="number"
                value={newLoan.interestRate}
                onChange={(e) => setNewLoan({ ...newLoan, interestRate: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Interest Method</InputLabel>
                <Select
                  value={newLoan.interestCalculationMethod}
                  label="Interest Method"
                  onChange={(e) =>
                    setNewLoan({
                      ...newLoan,
                      interestCalculationMethod: e.target.value as 'SIMPLE' | 'COMPOUND',
                    })
                  }
                >
                  <MenuItem value="SIMPLE">Simple Interest</MenuItem>
                  <MenuItem value="COMPOUND">Compound Interest</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Repayment Frequency</InputLabel>
                <Select
                  value={newLoan.repaymentFrequency}
                  label="Repayment Frequency"
                  onChange={(e) =>
                    setNewLoan({
                      ...newLoan,
                      repaymentFrequency: e.target.value as typeof newLoan.repaymentFrequency,
                    })
                  }
                >
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                  <MenuItem value="SEMI_ANNUALLY">Semi-Annually</MenuItem>
                  <MenuItem value="ANNUALLY">Annually</MenuItem>
                  <MenuItem value="BULLET">Bullet (At Maturity)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Start Date"
                type="date"
                value={newLoan.startDate}
                onChange={(e) => setNewLoan({ ...newLoan, startDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Maturity Date"
                type="date"
                value={newLoan.maturityDate}
                onChange={(e) => setNewLoan({ ...newLoan, maturityDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Notes (Optional)"
                multiline
                rows={2}
                value={newLoan.notes}
                onChange={(e) => setNewLoan({ ...newLoan, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateLoan}
            disabled={
              createLoanMutation.isPending ||
              !newLoan.lendingProjectId ||
              !newLoan.borrowingProjectId ||
              !newLoan.principalAmount ||
              !newLoan.interestRate ||
              !newLoan.maturityDate
            }
          >
            {createLoanMutation.isPending ? 'Creating...' : 'Create Loan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Repayment Dialog */}
      <Dialog
        open={isRepaymentDialogOpen}
        onClose={() => {
          setIsRepaymentDialogOpen(false);
          setSelectedLoan(null);
          resetRepaymentForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Repayment</DialogTitle>
        <DialogContent>
          {selectedLoan && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Recording payment for loan {selectedLoan.loanNumber}. Outstanding balance:{' '}
              {formatCurrency(selectedLoan.remainingPrincipal)}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Principal Payment"
                type="number"
                value={repayment.principalAmount}
                onChange={(e) => setRepayment({ ...repayment, principalAmount: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Interest Payment"
                type="number"
                value={repayment.interestAmount}
                onChange={(e) => setRepayment({ ...repayment, interestAmount: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Payment Date"
                type="date"
                value={repayment.repaymentDate}
                onChange={(e) => setRepayment({ ...repayment, repaymentDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Notes (Optional)"
                multiline
                rows={2}
                value={repayment.notes}
                onChange={(e) => setRepayment({ ...repayment, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsRepaymentDialogOpen(false);
              setSelectedLoan(null);
              resetRepaymentForm();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRecordRepayment}
            disabled={
              recordRepaymentMutation.isPending ||
              (!repayment.principalAmount && !repayment.interestAmount)
            }
          >
            {recordRepaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

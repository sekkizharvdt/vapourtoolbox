'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTypedWithDates } from '@/lib/firebase/typeHelpers';
import type { CostCentre } from '@vapour/types';
import CostCentreDialog from './components/CostCentreDialog';

export default function CostCentresPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCostCentre, setSelectedCostCentre] = useState<CostCentre | null>(null);
  const [loading, setLoading] = useState(true);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasCreateAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  // Load cost centres
  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const { db } = getFirebase();
    const q = query(collection(db, COLLECTIONS.COST_CENTRES), orderBy('code', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const centres = snapshot.docs.map((doc) =>
          docToTypedWithDates<CostCentre>(doc.id, doc.data())
        );
        setCostCentres(centres);
        setLoading(false);
      },
      (error) => {
        console.error('[CostCentres] Error loading cost centres:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [hasViewAccess]);

  const handleCreate = () => {
    setSelectedCostCentre(null);
    setOpenDialog(true);
  };

  const handleRowClick = (costCentre: CostCentre) => {
    // Navigate to detail page
    router.push(`/accounting/cost-centres/${costCentre.id}`);
  };

  const handleEdit = (costCentre: CostCentre) => {
    setSelectedCostCentre(costCentre);
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setSelectedCostCentre(null);
  };

  const formatCurrency = (amount: number | undefined | null, currency = 'INR') => {
    const safeAmount = amount ?? 0;
    return `${safeAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const calculateBudgetUtilization = (costCentre: CostCentre) => {
    if (!costCentre.budgetAmount || costCentre.budgetAmount <= 0) return 0;
    const actualSpent = costCentre.actualSpent ?? 0;
    return (actualSpent / costCentre.budgetAmount) * 100;
  };

  const getBudgetStatus = (utilization: number): 'success' | 'warning' | 'error' => {
    if (utilization < 75) return 'success';
    if (utilization < 90) return 'warning';
    return 'error';
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Cost Centres
          </Typography>
          <Alert severity="error">
            You do not have permission to access cost centre management.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Cost Centres
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Track project-based costs, revenue, and budget utilization
            </Typography>
          </Box>
          {hasCreateAccess && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Create Cost Centre
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Loading cost centres...
            </Typography>
            <LinearProgress />
          </Box>
        ) : costCentres.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No cost centres found. Create your first cost centre to start tracking project-based
            costs.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Spent</TableCell>
                  <TableCell align="center" sx={{ minWidth: 150 }}>
                    Utilization
                  </TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {costCentres.map((costCentre) => {
                  const budgetUtilization = calculateBudgetUtilization(costCentre);
                  const budgetStatus = getBudgetStatus(budgetUtilization);
                  const variance = costCentre.variance ?? 0;

                  return (
                    <TableRow
                      key={costCentre.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(costCentre)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {costCentre.code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{costCentre.name}</Typography>
                        {costCentre.description && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {costCentre.description.length > 50
                              ? `${costCentre.description.substring(0, 50)}...`
                              : costCentre.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={costCentre.category || 'PROJECT'}
                          color={
                            costCentre.category === 'ADMINISTRATION'
                              ? 'secondary'
                              : costCentre.category === 'OVERHEAD'
                                ? 'warning'
                                : 'primary'
                          }
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={costCentre.isActive ? 'Active' : 'Inactive'}
                          color={costCentre.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {costCentre.budgetAmount
                            ? formatCurrency(costCentre.budgetAmount, costCentre.budgetCurrency)
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          {formatCurrency(costCentre.actualSpent, costCentre.budgetCurrency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {costCentre.budgetAmount && costCentre.budgetAmount > 0 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(budgetUtilization, 100)}
                                color={budgetStatus}
                                sx={{ height: 8, borderRadius: 1 }}
                              />
                            </Box>
                            <Typography
                              variant="caption"
                              fontWeight="medium"
                              color={`${budgetStatus}.main`}
                              sx={{ minWidth: 45 }}
                            >
                              {budgetUtilization.toFixed(1)}%
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {costCentre.budgetAmount && costCentre.budgetAmount > 0 ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 0.5,
                            }}
                          >
                            {variance >= 0 ? (
                              <UpIcon color="success" fontSize="small" />
                            ) : (
                              <DownIcon color="error" fontSize="small" />
                            )}
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              color={variance >= 0 ? 'success.main' : 'error.main'}
                            >
                              {formatCurrency(Math.abs(variance), costCentre.budgetCurrency)}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {hasCreateAccess && (
                          <Tooltip title="Edit Cost Centre">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(costCentre);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Dialog */}
      <CostCentreDialog open={openDialog} costCentre={selectedCostCentre} onClose={handleClose} />
    </Container>
  );
}

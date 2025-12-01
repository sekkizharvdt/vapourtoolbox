'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewFinancialReports, canCreateTransactions } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CostCentre } from '@vapour/types';
import CostCentreDialog from './components/CostCentreDialog';

export default function CostCentresPage() {
  const { claims } = useAuth();
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCostCentre, setSelectedCostCentre] = useState<CostCentre | null>(null);
  const [loading, setLoading] = useState(true);

  const hasViewAccess = claims?.permissions ? canViewFinancialReports(claims.permissions) : false;
  const hasCreateAccess = claims?.permissions ? canCreateTransactions(claims.permissions) : false;

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
        const centres = snapshot.docs.map((doc): CostCentre => {
          const data = doc.data();
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
          } as CostCentre;
        });
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

  const handleEdit = (costCentre: CostCentre) => {
    setSelectedCostCentre(costCentre);
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setSelectedCostCentre(null);
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    return `${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const calculateBudgetUtilization = (costCentre: CostCentre) => {
    if (!costCentre.budgetAmount || costCentre.budgetAmount <= 0) return 0;
    return (costCentre.actualSpent / costCentre.budgetAmount) * 100;
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {costCentres.map((costCentre) => {
              const budgetUtilization = calculateBudgetUtilization(costCentre);
              const budgetStatus = getBudgetStatus(budgetUtilization);

              return (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={costCentre.id}>
                  <Card>
                    <CardContent>
                      {/* Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {costCentre.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {costCentre.code}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            alignItems: 'flex-end',
                          }}
                        >
                          <Chip
                            label={costCentre.isActive ? 'Active' : 'Inactive'}
                            color={costCentre.isActive ? 'success' : 'default'}
                            size="small"
                          />
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
                        </Box>
                      </Box>

                      {costCentre.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {costCentre.description}
                        </Typography>
                      )}

                      {/* Budget Information */}
                      {costCentre.budgetAmount && costCentre.budgetAmount > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Budget Utilization
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              color={`${budgetStatus}.main`}
                            >
                              {budgetUtilization.toFixed(1)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(budgetUtilization, 100)}
                            color={budgetStatus}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            {formatCurrency(costCentre.actualSpent, costCentre.budgetCurrency)} of{' '}
                            {formatCurrency(costCentre.budgetAmount, costCentre.budgetCurrency)}
                          </Typography>
                        </Box>
                      )}

                      {/* Financial Summary */}
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary">
                            Total Expenses
                          </Typography>
                          <Typography variant="body2" fontWeight="medium" color="error.main">
                            {formatCurrency(costCentre.actualSpent, costCentre.budgetCurrency)}
                          </Typography>
                        </Grid>
                        {costCentre.variance !== null && (
                          <Grid size={{ xs: 12 }}>
                            <Typography variant="caption" color="text.secondary">
                              Budget Variance
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {costCentre.variance >= 0 ? (
                                <UpIcon color="success" fontSize="small" />
                              ) : (
                                <DownIcon color="error" fontSize="small" />
                              )}
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                color={costCentre.variance >= 0 ? 'success.main' : 'error.main'}
                              >
                                {formatCurrency(
                                  Math.abs(costCentre.variance),
                                  costCentre.budgetCurrency
                                )}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>

                    <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                      {hasCreateAccess && (
                        <Tooltip title="Edit Cost Centre">
                          <IconButton size="small" onClick={() => handleEdit(costCentre)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Dialog */}
      <CostCentreDialog open={openDialog} costCentre={selectedCostCentre} onClose={handleClose} />
    </Container>
  );
}

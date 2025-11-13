'use client';

import { useState, useEffect } from 'react';

import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  Alert,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { Project, ProjectBudget } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { calculateProjectTotalActualCost } from '@/lib/projects/budgetCalculationService';

interface BudgetTabProps {
  project: Project;
}

export function BudgetTab({ project }: BudgetTabProps) {
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [calculatedActualCost, setCalculatedActualCost] = useState<number | null>(null);
  const [calculatingCost, setCalculatingCost] = useState(false);

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';

  // Budget locked if charter is approved
  const isCharterApproved = project.charter?.authorization?.approvalStatus === 'APPROVED';
  const isBudgetLocked = isCharterApproved;

  // Form state
  const [estimatedBudget, setEstimatedBudget] = useState(
    project.budget?.estimated?.amount?.toString() || ''
  );
  const [actualBudget, setActualBudget] = useState(
    project.budget?.actual?.amount?.toString() || ''
  );

  // Calculate actual cost from accounting transactions
  useEffect(() => {
    async function fetchActualCost() {
      if (!project.id) return;

      setCalculatingCost(true);
      try {
        const { db } = getFirebase();
        const actualCost = await calculateProjectTotalActualCost(db, project.id);
        setCalculatedActualCost(actualCost);
      } catch (err) {
        console.error('[BudgetTab] Error calculating actual cost:', err);
        // Don't set error state - just log and continue with manual value
        setCalculatedActualCost(null);
      } finally {
        setCalculatingCost(false);
      }
    }

    fetchActualCost();
  }, [project.id]);

  // Calculate budget utilization from procurement and vendors
  const calculateBudgetBreakdown = () => {
    const procurementItems = project.procurementItems || [];
    const vendors = project.vendors || [];

    // Procurement commitments
    const procurementCommitted = procurementItems.reduce((sum, item) => {
      if (item.status !== 'CANCELLED') {
        return sum + (item.estimatedTotalPrice?.amount || 0);
      }
      return sum;
    }, 0);

    // Vendor contract values
    const vendorCommitted = vendors.reduce((sum, vendor) => {
      if (vendor.contractStatus === 'ACTIVE' || vendor.contractStatus === 'NEGOTIATION') {
        return sum + (vendor.contractValue?.amount || 0);
      }
      return sum;
    }, 0);

    const totalCommitted = procurementCommitted + vendorCommitted;

    return {
      procurementCommitted,
      vendorCommitted,
      totalCommitted,
    };
  };

  const breakdown = calculateBudgetBreakdown();
  const estimated = project.budget?.estimated?.amount || 0;
  // Use calculated actual cost from transactions, fallback to manual entry
  const actual =
    calculatedActualCost !== null ? calculatedActualCost : project.budget?.actual?.amount || 0;
  const totalSpent = actual;
  const totalCommitted = breakdown.totalCommitted;
  const totalUtilized = totalSpent + totalCommitted;
  const remaining = estimated - totalUtilized;
  const utilizationPercentage =
    estimated > 0 ? ((totalUtilized / estimated) * 100).toFixed(1) : '0';
  const variance = actual - estimated;
  const variancePercentage = estimated > 0 ? ((variance / estimated) * 100).toFixed(1) : '0';

  const getBudgetHealthColor = (): 'success' | 'warning' | 'error' => {
    const utilization = parseFloat(utilizationPercentage);
    if (utilization > 100) return 'error';
    if (utilization > 85) return 'warning';
    return 'success';
  };

  const handleSave = async () => {
    const estimatedValue = parseFloat(estimatedBudget);
    const actualValue = actualBudget ? parseFloat(actualBudget) : undefined;

    if (!estimatedValue || estimatedValue <= 0) {
      setError('Estimated budget must be greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      const budgetData: ProjectBudget = {
        estimated: {
          amount: estimatedValue,
          currency: 'INR',
        },
        currency: 'INR',
      };

      if (actualValue !== undefined && actualValue >= 0) {
        budgetData.actual = {
          amount: actualValue,
          currency: 'INR',
        };
      }

      await updateDoc(projectRef, {
        budget: budgetData,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setEditMode(false);
    } catch (err) {
      console.error('[BudgetTab] Error saving budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEstimatedBudget(project.budget?.estimated?.amount?.toString() || '');
    setActualBudget(project.budget?.actual?.amount?.toString() || '');
    setEditMode(false);
    setError(null);
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    } else {
      return `₹${amount.toLocaleString('en-IN')}`;
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Budget Overview Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Budget Overview</Typography>
          {hasManageAccess && !editMode && !isBudgetLocked && (
            <Button size="small" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
              Edit Budget
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {isBudgetLocked && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Budget is locked because the project charter has been approved. Contact your project
            administrator if changes are required.
          </Alert>
        )}

        {editMode ? (
          // Edit Mode
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Estimated Budget (INR)"
                type="number"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Actual Spent (INR)"
                type="number"
                value={actualBudget}
                onChange={(e) => setActualBudget(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={handleCancel} disabled={loading}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        ) : (
          // View Mode
          <Grid container spacing={2}>
            {!project.budget && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info">
                  Budget is not set. Click &quot;Edit Budget&quot; to configure the project budget.
                </Alert>
              </Grid>
            )}

            {project.budget && (
              <>
                {/* Budget Health Alert */}
                {parseFloat(utilizationPercentage) > 100 && (
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="error" icon={<WarningIcon />}>
                      Budget exceeded! Total utilization is {utilizationPercentage}% of estimated
                      budget.
                    </Alert>
                  </Grid>
                )}
                {parseFloat(utilizationPercentage) > 85 &&
                  parseFloat(utilizationPercentage) <= 100 && (
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="warning" icon={<WarningIcon />}>
                        Budget utilization is at {utilizationPercentage}%. Approaching limit.
                      </Alert>
                    </Grid>
                  )}

                {/* Budget Cards */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Estimated Budget
                      </Typography>
                      <Typography variant="h5" fontWeight="medium">
                        {formatCurrency(estimated)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ bgcolor: 'error.light' }}>
                    <CardContent>
                      <Typography variant="body2" gutterBottom>
                        Actual Spent
                      </Typography>
                      <Typography variant="h5" fontWeight="medium">
                        {formatCurrency(totalSpent)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ bgcolor: 'warning.light' }}>
                    <CardContent>
                      <Typography variant="body2" gutterBottom>
                        Committed
                      </Typography>
                      <Typography variant="h5" fontWeight="medium">
                        {formatCurrency(totalCommitted)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ bgcolor: remaining >= 0 ? 'success.light' : 'error.light' }}>
                    <CardContent>
                      <Typography variant="body2" gutterBottom>
                        Remaining
                      </Typography>
                      <Typography variant="h5" fontWeight="medium">
                        {formatCurrency(Math.abs(remaining))}
                        {remaining < 0 && ' over'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Budget Utilization Progress */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Budget Utilization
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {utilizationPercentage}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(parseFloat(utilizationPercentage), 100)}
                      sx={{ height: 10, borderRadius: 5 }}
                      color={getBudgetHealthColor()}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: 'block' }}
                    >
                      {formatCurrency(totalUtilized)} of {formatCurrency(estimated)} utilized
                    </Typography>
                  </Box>
                </Grid>

                {/* Variance */}
                {variance !== 0 && (
                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      {variance > 0 ? (
                        <TrendingUpIcon color="error" />
                      ) : (
                        <TrendingDownIcon color="success" />
                      )}
                      <Typography
                        variant="body2"
                        color={variance > 0 ? 'error.main' : 'success.main'}
                      >
                        {variance > 0 ? 'Over' : 'Under'} budget by{' '}
                        {formatCurrency(Math.abs(variance))} (
                        {Math.abs(parseFloat(variancePercentage))}%)
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        )}
      </Paper>

      {/* Budget Breakdown */}
      {project.budget && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Budget Breakdown
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">% of Budget</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      Procurement
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {project.procurementItems?.length || 0} items
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatCurrency(breakdown.procurementCommitted)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {estimated > 0
                        ? ((breakdown.procurementCommitted / estimated) * 100).toFixed(1)
                        : '0'}
                      %
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label="Committed" size="small" color="warning" />
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      Vendor Contracts
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {project.vendors?.length || 0} vendors
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatCurrency(breakdown.vendorCommitted)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {estimated > 0
                        ? ((breakdown.vendorCommitted / estimated) * 100).toFixed(1)
                        : '0'}
                      %
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label="Committed" size="small" color="warning" />
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      Actual Expenses
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatCurrency(totalSpent)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {estimated > 0 ? ((totalSpent / estimated) * 100).toFixed(1) : '0'}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label="Spent" size="small" color="error" />
                  </TableCell>
                </TableRow>

                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="bold">
                      Total Utilized
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight="bold">
                      {formatCurrency(totalUtilized)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body1" fontWeight="bold">
                      {utilizationPercentage}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={parseFloat(utilizationPercentage) > 100 ? 'Over Budget' : 'On Track'}
                      size="small"
                      color={getBudgetHealthColor()}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Cost Centre Integration Note */}
      <Alert severity="info">
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Automatic Cost Tracking
        </Typography>
        <Typography variant="body2">
          {calculatingCost ? (
            <>Calculating actual costs from accounting transactions...</>
          ) : calculatedActualCost !== null ? (
            <>
              Actual costs are automatically calculated from posted accounting transactions (vendor
              bills, payments, and expense claims) linked to this project. The budget utilization
              reflects real-time financial data from your accounting system.
            </>
          ) : (
            <>
              Budget tracking is automatically calculated from procurement commitments. Actual costs
              will be calculated from accounting transactions once bills and payments are posted.
            </>
          )}
        </Typography>
      </Alert>
    </Box>
  );
}

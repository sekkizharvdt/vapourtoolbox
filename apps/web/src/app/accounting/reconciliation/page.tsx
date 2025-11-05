'use client';

import { useState, useEffect } from 'react';
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
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { BankStatement } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { CreateBankStatementDialog } from './components/CreateBankStatementDialog';
import { ReconciliationWorkspace } from './components/ReconciliationWorkspace';

type TabValue = 'statements' | 'reconcile';

export default function BankReconciliationPage() {
  const { claims } = useAuth();
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('statements');

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Real-time listener for bank statements
  useEffect(() => {
    const { db } = getFirebase();
    const statementsRef = collection(db, 'bankStatements');
    const q = query(statementsRef, orderBy('statementDate', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statementsData: BankStatement[] = [];
      snapshot.forEach((doc) => {
        statementsData.push({ id: doc.id, ...doc.data() } as unknown as BankStatement);
      });
      setStatements(statementsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateStatement = () => {
    setCreateDialogOpen(true);
  };

  const handleViewReconciliation = (statementId: string) => {
    setSelectedStatementId(statementId);
    setActiveTab('reconcile');
  };

  const handleBackToStatements = () => {
    setSelectedStatementId(null);
    setActiveTab('statements');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECONCILED':
        return 'success';
      case 'IN_PROGRESS':
        return 'warning';
      case 'REVIEWED':
        return 'info';
      default:
        return 'default';
    }
  };

  const calculateReconciliationPercentage = (statement: BankStatement): number => {
    // This would be calculated from actual reconciliation data
    // For now, return 0 for DRAFT, 100 for RECONCILED
    if (statement.status === 'RECONCILED' || statement.status === 'REVIEWED') {
      return 100;
    }
    if (statement.status === 'IN_PROGRESS') {
      return 50; // Would be calculated from actual matched transactions
    }
    return 0;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading bank statements...</Typography>
      </Box>
    );
  }

  if (!canManage) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You do not have permission to access bank reconciliation. Please contact your
          administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Bank Reconciliation</Typography>
        {activeTab === 'statements' && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateStatement}>
            New Bank Statement
          </Button>
        )}
        {activeTab === 'reconcile' && (
          <Button variant="outlined" onClick={handleBackToStatements}>
            Back to Statements
          </Button>
        )}
      </Stack>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Bank Statements" value="statements" />
        {selectedStatementId && <Tab label="Reconciliation Workspace" value="reconcile" />}
      </Tabs>

      {activeTab === 'statements' && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Statements
                  </Typography>
                  <Typography variant="h4">{statements.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Reconciled
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {
                      statements.filter((s) => s.status === 'RECONCILED' || s.status === 'REVIEWED')
                        .length
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    In Progress
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {statements.filter((s) => s.status === 'IN_PROGRESS').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h4" color="text.secondary">
                    {statements.filter((s) => s.status === 'DRAFT').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Statements Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Statement Date</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Opening Balance</TableCell>
                  <TableCell align="right">Closing Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No bank statements found. Click &quot;New Bank Statement&quot; to upload
                        your first statement.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  statements.map((statement) => {
                    const percentage = calculateReconciliationPercentage(statement);
                    return (
                      <TableRow key={statement.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {statement.accountName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {statement.bankName} - {statement.accountNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {new Date(statement.statementDate.toDate()).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(statement.startDate.toDate()).toLocaleDateString()} -{' '}
                          {new Date(statement.endDate.toDate()).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(statement.openingBalance)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(statement.closingBalance)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statement.status}
                            size="small"
                            color={getStatusColor(statement.status)}
                            icon={
                              statement.status === 'RECONCILED' ||
                              statement.status === 'REVIEWED' ? (
                                <CheckCircleIcon />
                              ) : statement.status === 'IN_PROGRESS' ? (
                                <WarningIcon />
                              ) : undefined
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={percentage}
                              sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {percentage.toFixed(0)}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View & Reconcile">
                            <IconButton
                              size="small"
                              onClick={() => handleViewReconciliation(statement.id!)}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Generate Report">
                            <IconButton size="small">
                              <AssessmentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {activeTab === 'reconcile' && selectedStatementId && (
        <ReconciliationWorkspace
          statementId={selectedStatementId}
          onBack={handleBackToStatements}
        />
      )}

      <CreateBankStatementDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
}

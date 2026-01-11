'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/AuthContext';
import { useFirestoreDb } from '@/lib/firebase/FirestoreProvider';
import {
  getInterprojectLoans,
  createInterprojectLoan,
  recordRepayment,
  type CreateInterprojectLoanInput,
  type RecordRepaymentInput,
} from '@/lib/accounting/interprojectLoanService';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { InterprojectLoan, CostCentre } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function InterprojectLoansPage() {
  const { user } = useAuth();
  const db = useFirestoreDb();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRepaymentDialogOpen, setIsRepaymentDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<InterprojectLoan | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state for new loan
  const [newLoan, setNewLoan] = useState<{
    lendingProjectId: string;
    borrowingProjectId: string;
    principalAmount: string;
    interestRate: string;
    interestCalculationMethod: 'SIMPLE' | 'COMPOUND';
    startDate: string;
    maturityDate: string;
    repaymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'BULLET';
    notes: string;
  }>({
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

  // Form state for repayment
  const [repayment, setRepayment] = useState({
    principalAmount: '',
    interestAmount: '',
    repaymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

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
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['interprojectLoans', statusFilter],
    queryFn: async () => {
      if (!db) return [];
      const filters = statusFilter !== 'all' ? { status: statusFilter as InterprojectLoan['status'] } : undefined;
      return getInterprojectLoans(db, filters);
    },
    enabled: !!db,
  });

  // Calculate summary
  const summary = {
    totalLoans: loans.length,
    activeLoans: loans.filter((l) => ['ACTIVE', 'PARTIALLY_REPAID'].includes(l.status)).length,
    totalPrincipal: loans.reduce((sum, l) => sum + l.principalAmount, 0),
    totalOutstanding: loans
      .filter((l) => ['ACTIVE', 'PARTIALLY_REPAID'].includes(l.status))
      .reduce((sum, l) => sum + l.remainingPrincipal, 0),
  };

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
      repaymentDate: new Date().toISOString().split('T')[0],
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

  const getStatusBadge = (status: InterprojectLoan['status']) => {
    const variants: Record<InterprojectLoan['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ACTIVE: 'default',
      PARTIALLY_REPAID: 'secondary',
      FULLY_REPAID: 'outline',
      DEFAULTED: 'destructive',
      WRITTEN_OFF: 'destructive',
    };

    return <Badge variant={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const getProjectName = (projectId: string) => {
    const project = costCentres.find((c) => c.id === projectId);
    return project?.name || projectId;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Interproject Loans</h1>
          <p className="text-muted-foreground">
            Manage loans between projects with automatic journal entries
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Loan
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Loans</CardDescription>
            <CardTitle className="text-2xl">{summary.totalLoans}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Loans</CardDescription>
            <CardTitle className="text-2xl">{summary.activeLoans}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Principal</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalPrincipal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding Balance</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary.totalOutstanding)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PARTIALLY_REPAID">Partially Repaid</SelectItem>
            <SelectItem value="FULLY_REPAID">Fully Repaid</SelectItem>
            <SelectItem value="DEFAULTED">Defaulted</SelectItem>
            <SelectItem value="WRITTEN_OFF">Written Off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loans Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading loans...</div>
          ) : loans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No interproject loans found. Create your first loan to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Maturity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                    <TableCell>{getProjectName(loan.lendingProjectId)}</TableCell>
                    <TableCell>{getProjectName(loan.borrowingProjectId)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(loan.principalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(loan.remainingPrincipal)}
                    </TableCell>
                    <TableCell>
                      {loan.interestRate}% {loan.interestCalculationMethod}
                    </TableCell>
                    <TableCell>{getStatusBadge(loan.status)}</TableCell>
                    <TableCell>
                      {new Date(loan.maturityDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {['ACTIVE', 'PARTIALLY_REPAID'].includes(loan.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setIsRepaymentDialogOpen(true);
                          }}
                        >
                          Record Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Loan Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Interproject Loan</DialogTitle>
            <DialogDescription>
              Create a new loan between two projects. Journal entries will be generated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lending Project</Label>
                <Select
                  value={newLoan.lendingProjectId}
                  onValueChange={(v) => setNewLoan({ ...newLoan, lendingProjectId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCentres.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Borrowing Project</Label>
                <Select
                  value={newLoan.borrowingProjectId}
                  onValueChange={(v) => setNewLoan({ ...newLoan, borrowingProjectId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCentres
                      .filter((cc) => cc.id !== newLoan.lendingProjectId)
                      .map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Principal Amount</Label>
                <Input
                  type="number"
                  value={newLoan.principalAmount}
                  onChange={(e) => setNewLoan({ ...newLoan, principalAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  value={newLoan.interestRate}
                  onChange={(e) => setNewLoan({ ...newLoan, interestRate: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Interest Method</Label>
                <Select
                  value={newLoan.interestCalculationMethod}
                  onValueChange={(v) =>
                    setNewLoan({
                      ...newLoan,
                      interestCalculationMethod: v as 'SIMPLE' | 'COMPOUND',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">Simple Interest</SelectItem>
                    <SelectItem value="COMPOUND">Compound Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Repayment Frequency</Label>
                <Select
                  value={newLoan.repaymentFrequency}
                  onValueChange={(v) =>
                    setNewLoan({
                      ...newLoan,
                      repaymentFrequency: v as typeof newLoan.repaymentFrequency,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="SEMI_ANNUALLY">Semi-Annually</SelectItem>
                    <SelectItem value="ANNUALLY">Annually</SelectItem>
                    <SelectItem value="BULLET">Bullet (At Maturity)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newLoan.startDate}
                  onChange={(e) => setNewLoan({ ...newLoan, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Maturity Date</Label>
                <Input
                  type="date"
                  value={newLoan.maturityDate}
                  onChange={(e) => setNewLoan({ ...newLoan, maturityDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={newLoan.notes}
                onChange={(e) => setNewLoan({ ...newLoan, notes: e.target.value })}
                placeholder="Add any notes about this loan..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Repayment Dialog */}
      <Dialog open={isRepaymentDialogOpen} onOpenChange={setIsRepaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Repayment</DialogTitle>
            <DialogDescription>
              {selectedLoan && (
                <>
                  Recording payment for loan {selectedLoan.loanNumber}. Outstanding balance:{' '}
                  {formatCurrency(selectedLoan.remainingPrincipal)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Principal Payment</Label>
                <Input
                  type="number"
                  value={repayment.principalAmount}
                  onChange={(e) =>
                    setRepayment({ ...repayment, principalAmount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Interest Payment</Label>
                <Input
                  type="number"
                  value={repayment.interestAmount}
                  onChange={(e) =>
                    setRepayment({ ...repayment, interestAmount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={repayment.repaymentDate}
                onChange={(e) =>
                  setRepayment({ ...repayment, repaymentDate: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={repayment.notes}
                onChange={(e) => setRepayment({ ...repayment, notes: e.target.value })}
                placeholder="Add any notes about this payment..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRepaymentDialogOpen(false);
                setSelectedLoan(null);
                resetRepaymentForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordRepayment}
              disabled={
                recordRepaymentMutation.isPending ||
                (!repayment.principalAmount && !repayment.interestAmount)
              }
            >
              {recordRepaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

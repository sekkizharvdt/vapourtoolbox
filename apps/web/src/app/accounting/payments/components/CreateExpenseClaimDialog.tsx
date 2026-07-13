'use client';

import React, { useState, useEffect } from 'react';
import {
  TextField,
  Grid,
  MenuItem,
  Box,
  Typography,
  Alert,
  Autocomplete,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { getFirebase } from '@/lib/firebase';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import {
  Timestamp,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { COLLECTIONS } from '@vapour/firebase';
import type { TransactionStatus } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { generateExpenseClaimGLEntries } from '@/lib/accounting/glEntry';
import { roundToPaisa } from '@/lib/accounting/amountHelpers';
import { formatCurrency } from '@/lib/utils/formatters';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

interface ClaimantOption {
  id: string;
  displayName: string;
  email: string;
}

/** Expense line as stored on the transaction document (ExpenseLineItem + accountId for edit round-trip) */
interface StoredExpenseItem {
  id: string;
  description: string;
  expenseDate: unknown;
  category: string;
  amount: number;
  currency: string;
  hasReceipt: boolean;
  isApproved: boolean;
  accountId?: string;
}

interface ExpenseClaimDoc {
  id?: string;
  type: 'EXPENSE_CLAIM';
  transactionNumber: string;
  expenseDate: unknown; // Firestore Timestamp | Date | string
  claimantUserId: string;
  claimantName?: string;
  expenseItems?: StoredExpenseItem[];
  reimbursementPayableAccountId?: string;
  claimStatus?: string;
  status?: TransactionStatus;
  projectId?: string;
  notes?: string;
  description?: string;
}

interface ExpenseLineRow {
  key: string;
  description: string;
  accountId: string | null;
  amount: number;
}

interface CreateExpenseClaimDialogProps {
  open: boolean;
  onClose: () => void;
  editingClaim?: ExpenseClaimDoc | null;
}

/** Convert a Firestore Timestamp | Date | string to a yyyy-MM-dd input value (rule 14) */
function toDateInputValue(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'object' && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate().toISOString().split('T')[0] || '';
  }
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0] || '';
  }
  if (typeof raw === 'string') return raw.split('T')[0] || '';
  return '';
}

function newLineRow(): ExpenseLineRow {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    accountId: null,
    amount: 0,
  };
}

export function CreateExpenseClaimDialog({
  open,
  onClose,
  editingClaim,
}: CreateExpenseClaimDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Claimant (employee) selection
  const [users, setUsers] = useState<ClaimantOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [claimantUserId, setClaimantUserId] = useState<string | null>(null);
  const [claimantName, setClaimantName] = useState<string>('');

  // Form fields
  const [claimDate, setClaimDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [status, setStatus] = useState<TransactionStatus>('DRAFT');
  const [payableAccountId, setPayableAccountId] = useState<string | null>(null);
  const [lines, setLines] = useState<ExpenseLineRow[]>([newLineRow()]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  // Load employees (users) when the dialog opens — house pattern for user pickers
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { db } = getFirebase();
        const snapshot = await getDocs(
          query(collection(db, COLLECTIONS.USERS), orderBy('displayName', 'asc'))
        );
        if (cancelled) return;
        const userData: ClaimantOption[] = snapshot.docs
          .map((d) => {
            const data = d.data() as { displayName?: string; email?: string; isActive?: boolean };
            return {
              id: d.id,
              displayName: data.displayName || data.email || d.id,
              email: data.email || '',
              isActive: data.isActive,
            };
          })
          .filter((u) => u.isActive !== false)
          .map(({ id, displayName, email }) => ({ id, displayName, email }));
        setUsers(userData);
      } catch (err) {
        console.error('[CreateExpenseClaimDialog] Failed to load users:', err);
        if (!cancelled) setError('Failed to load employees');
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset form when dialog opens/closes (rule 14b — re-sync every field).
  // Derived state (claimant name, line accounts) restores directly from the
  // saved document, since selector callbacks don't fire on pre-fill (rule 15).
  useEffect(() => {
    if (open) {
      if (editingClaim) {
        setClaimDate(
          toDateInputValue(editingClaim.expenseDate) || new Date().toISOString().split('T')[0] || ''
        );
        setClaimantUserId(editingClaim.claimantUserId || null);
        setClaimantName(editingClaim.claimantName || '');
        setStatus(editingClaim.status || 'DRAFT');
        setPayableAccountId(editingClaim.reimbursementPayableAccountId || null);
        const restoredLines: ExpenseLineRow[] = (editingClaim.expenseItems || []).map(
          (item, idx) => ({
            key: item.id || `restored-${idx}`,
            description: item.description || '',
            accountId: item.accountId || null,
            amount: item.amount ?? 0,
          })
        );
        setLines(restoredLines.length > 0 ? restoredLines : [newLineRow()]);
        setProjectId(editingClaim.projectId || null);
        setNotes(editingClaim.notes ?? editingClaim.description ?? '');
      } else {
        setClaimDate(new Date().toISOString().split('T')[0] || '');
        setClaimantUserId(null);
        setClaimantName('');
        setStatus('DRAFT');
        setPayableAccountId(null);
        setLines([newLineRow()]);
        setProjectId(null);
        setNotes('');
      }
      setError('');
    }
  }, [open, editingClaim]);

  const updateLine = (key: string, patch: Partial<ExpenseLineRow>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  };

  const addLine = () => setLines((prev) => [...prev, newLineRow()]);

  const totalAmount = roundToPaisa(
    lines.reduce((sum, line) => sum + roundToPaisa(line.amount || 0), 0)
  );

  const handleSubmit = async () => {
    // rule19-exempt: reads Chart of Accounts docs for GL leg code/name and writes a NEW transaction doc — different documents; the read does not mutate
    // Validation (rule 23 — descriptive errors)
    if (!claimantUserId) {
      setError('Please select the employee claiming the expenses');
      return;
    }
    if (!claimDate) {
      setError('Please select a claim date');
      return;
    }
    if (!payableAccountId) {
      setError('Please select the reimbursement payable (liability) account to credit');
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!(line.description ?? '').trim()) {
        setError(`Expense line ${i + 1}: description is required`);
        return;
      }
      if (!line.accountId) {
        setError(`Expense line ${i + 1}: expense category account is required`);
        return;
      }
      if (roundToPaisa(line.amount || 0) <= 0) {
        setError(`Expense line ${i + 1}: amount must be greater than zero (got ${line.amount})`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Generate transaction number for new claims (first Firestore call — rule 35)
      let transactionNumber = editingClaim?.transactionNumber;
      if (!editingClaim) {
        transactionNumber = await retryOnStaleToken(() =>
          generateTransactionNumber('EXPENSE_CLAIM')
        );
      }

      // Fetch account docs for GL code/name. Selector callbacks don't fire
      // on pre-populated values (rule 15), so read accounts directly.
      const uniqueAccountIds = Array.from(
        new Set([payableAccountId, ...lines.map((l) => l.accountId as string)])
      );
      const accountSnaps = await Promise.all(
        uniqueAccountIds.map((id) =>
          retryOnStaleToken(() => getDoc(doc(db, COLLECTIONS.ACCOUNTS, id)))
        )
      );
      const accountsById = new Map<string, { code: string; name: string }>();
      for (let i = 0; i < uniqueAccountIds.length; i++) {
        const snap = accountSnaps[i]!;
        if (!snap.exists()) {
          setError(`Selected account no longer exists in the Chart of Accounts`);
          setLoading(false);
          return;
        }
        const data = snap.data() as { code?: string; name?: string };
        accountsById.set(uniqueAccountIds[i]!, {
          code: data.code || '',
          name: data.name || '',
        });
      }
      const payableAccount = accountsById.get(payableAccountId)!;

      // Generate GL entries: Dr each expense line account, Cr reimbursement payable
      const glResult = generateExpenseClaimGLEntries({
        lines: lines.map((line) => ({
          accountId: line.accountId!,
          accountCode: accountsById.get(line.accountId!)?.code || '',
          accountName: accountsById.get(line.accountId!)?.name || '',
          description: line.description.trim(),
          amount: roundToPaisa(line.amount),
        })),
        payableAccountId,
        payableAccountCode: payableAccount.code,
        payableAccountName: payableAccount.name,
        claimantName,
        ...(projectId && { projectId }),
      });
      if (!glResult.success) {
        setError(`Failed to generate GL entries: ${glResult.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      const dateTs = Timestamp.fromDate(new Date(claimDate));
      const categories = Array.from(
        new Set(lines.map((line) => accountsById.get(line.accountId!)?.name || 'General'))
      );

      const expenseItems: StoredExpenseItem[] = lines.map((line, idx) => ({
        id: line.key || `line-${idx}`,
        description: line.description.trim(),
        expenseDate: dateTs,
        category: accountsById.get(line.accountId!)?.name || 'General',
        amount: roundToPaisa(line.amount),
        currency: 'INR',
        hasReceipt: false,
        isApproved: false,
        accountId: line.accountId!,
      }));

      // Build claim data. No entityId: the counterparty is an employee
      // (users collection), tracked via claimantUserId — reports exclude
      // EXPENSE_CLAIM from entity ledgers.
      const claimData: Record<string, unknown> = {
        type: 'EXPENSE_CLAIM',
        transactionNumber: transactionNumber || '',
        date: dateTs,
        expenseDate: dateTs,
        claimantUserId,
        claimantName,
        expenseCategory: categories.join(', '),
        expenseItems,
        reimbursementPayableAccountId: payableAccountId,
        totalClaimAmount: totalAmount,
        totalAmount,
        amount: totalAmount,
        baseAmount: totalAmount,
        currency: 'INR',
        reimbursedAmount: 0,
        claimStatus: editingClaim?.claimStatus || 'SUBMITTED',
        status,
        description: (notes ?? '').trim() || `Expense claim — ${claimantName}`,
        // Conditional spread — Firestore rejects undefined (rule 12)
        ...((notes ?? '').trim() && { notes: notes.trim() }),
        ...(projectId && { projectId, costCentreId: projectId }),
        entries: glResult.entries,
        attachments: [],
        ...(editingClaim ? {} : { createdAt: Timestamp.now(), createdBy: user?.uid || 'unknown' }),
        ...(editingClaim ? { updatedBy: user?.uid || 'unknown' } : {}),
        updatedAt: Timestamp.now(),
      };

      const auditContext = user
        ? createAuditContext(user.uid, user.email || '', user.displayName || user.email || '')
        : null;

      if (editingClaim?.id) {
        const editingId = editingClaim.id;
        await retryOnStaleToken(() =>
          updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingId), claimData)
        );

        if (auditContext) {
          await retryOnStaleToken(() =>
            logAuditEvent(
              db,
              auditContext,
              'TRANSACTION_UPDATED',
              'TRANSACTION',
              editingId,
              `Expense claim ${transactionNumber} updated for ${claimantName}`,
              {
                entityName: transactionNumber || '',
                metadata: { claimantUserId, claimantName, amount: totalAmount, status },
              }
            )
          );
        }
      } else {
        const docRef = await retryOnStaleToken(() =>
          addDoc(collection(db, COLLECTIONS.TRANSACTIONS), claimData)
        );

        if (auditContext) {
          await retryOnStaleToken(() =>
            logAuditEvent(
              db,
              auditContext,
              'TRANSACTION_CREATED',
              'TRANSACTION',
              docRef.id,
              `Expense claim ${transactionNumber} created for ${claimantName}`,
              {
                entityName: transactionNumber || '',
                metadata: { claimantUserId, claimantName, amount: totalAmount, status },
              }
            )
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[CreateExpenseClaimDialog] Error saving claim:', err);
      setError(err instanceof Error ? err.message : 'Failed to save expense claim');
    } finally {
      setLoading(false);
    }
  };

  const selectedClaimant = users.find((u) => u.id === claimantUserId) || null;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingClaim ? 'Edit Expense Claim' : 'Create Expense Claim'}
      maxWidth="lg"
    >
      <Box sx={{ p: 2 }}>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          Record reimbursable expenses an employee paid out of pocket. Each line debits an expense
          account; the total is credited to the reimbursement payable account until the employee is
          paid back.
        </Alert>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Claim Details
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              options={users}
              value={selectedClaimant}
              loading={loadingUsers}
              onChange={(_, newValue) => {
                setClaimantUserId(newValue?.id || null);
                setClaimantName(newValue?.displayName || '');
              }}
              getOptionLabel={(option) => option.displayName}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label="Employee (Claimant)" required size="small" />
              )}
              size="small"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Claim Date"
              type="date"
              size="small"
              value={claimDate}
              onChange={(e) => setClaimDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TransactionStatus)}
              required
            >
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="POSTED">Posted</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={payableAccountId}
              onChange={setPayableAccountId}
              label="Reimbursement Payable Account (Credit)"
              filterByType="LIABILITY"
              excludeGroups
              required
              placeholder="Search liability accounts..."
              helperText="Liability account credited until the employee is reimbursed"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ProjectSelector
              value={projectId}
              onChange={setProjectId}
              label="Project / Cost Centre (Optional)"
              onlyActive
            />
          </Grid>

          {/* Expense line items */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
              Expense Items
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '35%' }}>Description</TableCell>
                  <TableCell sx={{ width: '35%' }}>Expense Category (Account)</TableCell>
                  <TableCell sx={{ width: '20%' }} align="right">
                    Amount
                  </TableCell>
                  <TableCell sx={{ width: '10%' }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        value={line.description}
                        onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        placeholder="e.g., Taxi fare for client visit"
                      />
                    </TableCell>
                    <TableCell>
                      <AccountSelector
                        value={line.accountId}
                        onChange={(accountId) => updateLine(line.key, { accountId })}
                        label=""
                        filterByType="EXPENSE"
                        excludeGroups
                        placeholder="Search expense accounts..."
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={line.amount}
                        onChange={(e) =>
                          updateLine(line.key, { amount: parseFloat(e.target.value) || 0 })
                        }
                        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                        sx={{ maxWidth: 140 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Remove line">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => removeLine(line.key)}
                            disabled={lines.length <= 1}
                            aria-label="Remove line"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4}>
                    <Button startIcon={<AddIcon />} onClick={addLine} size="small">
                      Add Expense Line
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} align="right">
                    <Typography variant="subtitle2">Total Claim</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{formatCurrency(totalAmount)}</Typography>
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              placeholder="Additional notes about this claim"
            />
          </Grid>
        </Grid>
      </Box>

      <FormDialogActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={editingClaim ? 'Update Claim' : 'Create Claim'}
        loading={loading}
      />
    </FormDialog>
  );
}

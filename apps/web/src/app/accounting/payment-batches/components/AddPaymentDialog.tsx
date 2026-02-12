'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  InputAdornment,
  Tabs,
  Tab,
  Typography,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Switch,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import { getFirebase } from '@/lib/firebase';
import {
  addBatchPayment,
  updateBatchPayment,
  getOutstandingBillsForProject,
} from '@/lib/accounting/paymentBatchService';

const PAYMENT_CATEGORIES: { value: BatchPaymentCategory; label: string }[] = [
  { value: 'SALARY', label: 'Salary' },
  { value: 'TAXES_DUTIES', label: 'Taxes & Duties' },
  { value: 'PROJECTS', label: 'Projects' },
  { value: 'LOANS', label: 'Loans' },
  { value: 'ADMINISTRATION', label: 'Administration' },
  { value: '3D_PRINTER', label: '3D Printer' },
  { value: 'OTHER', label: 'Other' },
];
import type {
  BatchPayeeType,
  BatchPaymentCategory,
  BatchPayment,
  VendorBill,
  BusinessEntity,
  Project,
} from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

interface AddPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  sourceProjectIds: string[];
  onAdded: () => void;
  editingPayment?: BatchPayment | null;
}

type TabValue = 'bills' | 'recurring' | 'manual';

export default function AddPaymentDialog({
  open,
  onClose,
  batchId,
  sourceProjectIds,
  onAdded,
  editingPayment,
}: AddPaymentDialogProps) {
  const isEditing = !!editingPayment;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('bills');

  // Bills tab state
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [showAllProjects, setShowAllProjects] = useState(false);

  // Manual tab state
  const [payeeType, setPayeeType] = useState<BatchPayeeType>('VENDOR');
  const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);
  const [entityName, setEntityName] = useState('');
  const [amount, setAmount] = useState('');
  const [tdsAmount, setTdsAmount] = useState('');
  const [tdsSection, setTdsSection] = useState('');
  const [category, setCategory] = useState<BatchPaymentCategory | ''>('');
  const [notes, setNotes] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Load outstanding bills
  useEffect(() => {
    if (!open || tab !== 'bills') return;

    const loadBills = async () => {
      setLoadingBills(true);
      try {
        const { db } = getFirebase();
        const projectId = sourceProjectIds[0];
        const billList = await getOutstandingBillsForProject(db, projectId, showAllProjects);
        setBills(billList);
      } catch (err) {
        console.error('[AddPaymentDialog] Error loading bills:', err);
      } finally {
        setLoadingBills(false);
      }
    };

    loadBills();
  }, [open, tab, sourceProjectIds, showAllProjects]);

  const resetForm = () => {
    setTab('bills');
    setSelectedBills(new Set());
    setShowAllProjects(false);
    setPayeeType('VENDOR');
    setSelectedEntity(null);
    setEntityName('');
    setAmount('');
    setTdsAmount('');
    setTdsSection('');
    setCategory('');
    setNotes('');
    setSelectedProject(null);
    setError(null);
  };

  // Populate form when editing
  useEffect(() => {
    if (open && editingPayment) {
      setTab('manual');
      setPayeeType(editingPayment.payeeType);
      setEntityName(editingPayment.entityName);
      setAmount(String(editingPayment.amount));
      setTdsAmount(editingPayment.tdsAmount ? String(editingPayment.tdsAmount) : '');
      setTdsSection(editingPayment.tdsSection || '');
      setCategory(editingPayment.category || '');
      setNotes(editingPayment.notes || '');
      if (editingPayment.projectId && editingPayment.projectName) {
        setSelectedProject({
          id: editingPayment.projectId,
          name: editingPayment.projectName,
        } as Project);
      }
    } else if (open && !editingPayment) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingPayment]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleBillToggle = (billId: string) => {
    const newSet = new Set(selectedBills);
    if (newSet.has(billId)) {
      newSet.delete(billId);
    } else {
      newSet.add(billId);
    }
    setSelectedBills(newSet);
  };

  const handleAddBills = async () => {
    if (selectedBills.size === 0) {
      setError('Please select at least one bill');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();

      for (const billId of selectedBills) {
        const bill = bills.find((b) => b.id === billId);
        if (!bill) continue;

        await addBatchPayment(db, batchId, {
          linkedType: 'VENDOR_BILL',
          linkedId: bill.id,
          linkedReference: bill.vendorInvoiceNumber || bill.transactionNumber,
          payeeType: 'VENDOR',
          entityId: bill.entityId,
          entityName: bill.entityName || 'Unknown Vendor',
          amount: bill.outstandingAmount || bill.baseAmount || bill.totalAmount,
          currency: bill.currency || 'INR',
          projectId: bill.projectId || bill.costCentreId,
          projectName: undefined, // Project name will be looked up by the batch detail page
        });
      }

      onAdded();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payments');
    } finally {
      setSaving(false);
    }
  };

  const handleAddManual = async () => {
    if (!entityName.trim() && !selectedEntity) {
      setError('Please enter a payee name or select an entity');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const paymentInput = {
        linkedType: editingPayment?.linkedType || ('MANUAL' as const),
        payeeType,
        entityId: selectedEntity?.id,
        entityName: selectedEntity?.name || entityName.trim(),
        amount: parseFloat(amount),
        currency: 'INR',
        tdsAmount: tdsAmount ? parseFloat(tdsAmount) : undefined,
        tdsSection: tdsSection || undefined,
        projectId: selectedProject?.id,
        projectName: selectedProject?.name,
        category: category || undefined,
        notes: notes || undefined,
      };

      if (isEditing && editingPayment) {
        await updateBatchPayment(db, batchId, editingPayment.id, paymentInput);
      } else {
        await addBatchPayment(db, batchId, paymentInput);
      }

      onAdded();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'add'} payment`
      );
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
      <DialogContent>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as TabValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Outstanding Bills" value="bills" disabled={isEditing} />
          <Tab label="Manual Payment" value="manual" />
        </Tabs>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Bills Tab */}
        {tab === 'bills' && (
          <Box>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Typography variant="body2" color="text.secondary">
                Select bills to pay from this batch
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showAllProjects}
                    onChange={(e) => setShowAllProjects(e.target.checked)}
                    size="small"
                  />
                }
                label="Show all projects"
              />
            </Box>

            {loadingBills && <LinearProgress sx={{ mb: 2 }} />}

            {bills.length === 0 && !loadingBills ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No outstanding bills found.
              </Typography>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {bills.map((bill) => {
                  const isSelected = selectedBills.has(bill.id);
                  const isCrossProject =
                    sourceProjectIds.length > 0 &&
                    bill.projectId &&
                    !sourceProjectIds.includes(bill.projectId) &&
                    !sourceProjectIds.includes(bill.costCentreId || '');

                  return (
                    <ListItem key={bill.id} disablePadding>
                      <ListItemButton onClick={() => handleBillToggle(bill.id)} dense>
                        <ListItemIcon>
                          <Checkbox edge="start" checked={isSelected} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">
                                {bill.entityName || 'Unknown Vendor'}
                              </Typography>
                              {isCrossProject && (
                                <Chip
                                  label="Cross-Project"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {bill.vendorInvoiceNumber || bill.transactionNumber}
                              {' | '}
                              Due: {formatDate(bill.dueDate)}
                              {bill.costCentreId && ` | Project: ${bill.costCentreId}`}
                            </Typography>
                          }
                        />
                        <Typography
                          variant="body1"
                          fontWeight="medium"
                          color={bill.paymentStatus === 'OVERDUE' ? 'error.main' : 'text.primary'}
                        >
                          {formatCurrency(
                            bill.outstandingAmount || bill.baseAmount || bill.totalAmount
                          )}
                        </Typography>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}

            {selectedBills.size > 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2">
                  Selected: {selectedBills.size} bill{selectedBills.size !== 1 ? 's' : ''} | Total:{' '}
                  {formatCurrency(
                    bills
                      .filter((b) => selectedBills.has(b.id))
                      .reduce(
                        (sum, b) => sum + (b.outstandingAmount || b.baseAmount || b.totalAmount),
                        0
                      )
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Manual Tab */}
        {tab === 'manual' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Payee Type</InputLabel>
              <Select
                value={payeeType}
                label="Payee Type"
                onChange={(e) => setPayeeType(e.target.value as BatchPayeeType)}
              >
                <MenuItem value="VENDOR">Vendor</MenuItem>
                <MenuItem value="EMPLOYEE">Employee</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>

            {payeeType === 'VENDOR' ? (
              <EntitySelector
                value={selectedEntity?.id || null}
                onChange={() => {}}
                onEntitySelect={(entity: BusinessEntity | null) => setSelectedEntity(entity)}
                label="Vendor"
                filterByRole="VENDOR"
              />
            ) : (
              <TextField
                label="Payee Name"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                fullWidth
                required
                placeholder="e.g., Sathiyamoorthi"
              />
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                fullWidth
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">INR</InputAdornment>,
                }}
              />
              <TextField
                label="TDS Amount"
                value={tdsAmount}
                onChange={(e) => setTdsAmount(e.target.value)}
                type="number"
                sx={{ width: 150 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">INR</InputAdornment>,
                }}
              />
              <TextField
                label="TDS Section"
                value={tdsSection}
                onChange={(e) => setTdsSection(e.target.value)}
                sx={{ width: 120 }}
                placeholder="194C"
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                label="Category"
                onChange={(e) => setCategory(e.target.value as BatchPaymentCategory)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {PAYMENT_CATEGORIES.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ProjectSelector
              value={selectedProject?.id || null}
              onChange={(projectId, projectName) => {
                if (projectId && projectName) {
                  setSelectedProject({ id: projectId, name: projectName } as Project);
                } else {
                  setSelectedProject(null);
                }
              }}
              label="Project (Optional)"
              helperText="Assign this payment to a project"
            />

            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="e.g., 7500 TDS, Loan repayment"
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        {tab === 'bills' ? (
          <Button
            variant="contained"
            onClick={handleAddBills}
            disabled={saving || selectedBills.size === 0}
          >
            {saving
              ? 'Adding...'
              : `Add ${selectedBills.size} Bill${selectedBills.size !== 1 ? 's' : ''}`}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleAddManual}
            disabled={saving || (!entityName.trim() && !selectedEntity) || !amount}
          >
            {saving ? 'Saving...' : isEditing ? 'Save Payment' : 'Add Payment'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

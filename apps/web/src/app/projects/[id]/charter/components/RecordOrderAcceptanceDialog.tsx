'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Grid,
  Divider,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import type {
  OrderAcceptanceRecord,
  OrderAcceptanceTerms,
  OrderAcceptanceMilestone,
  OrderAcceptanceDeliverable,
  ProjectDeliverable,
  Money,
  CurrencyCode,
} from '@vapour/types';

export interface OrderAcceptanceFormData {
  documentReference?: string;
  documentDate?: Timestamp;
  contractValue?: Money;
  terms: OrderAcceptanceTerms;
}

interface RecordOrderAcceptanceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing draft record, if editing one already in DRAFT. Undefined = new. */
  record?: OrderAcceptanceRecord;
  onSave: (data: OrderAcceptanceFormData) => void;
  loading: boolean;
}

const TRIGGER_TYPE_LABELS: Record<OrderAcceptanceMilestone['triggerType'], string> = {
  SUBMISSION: 'On Submission',
  ACCEPTANCE: 'On Acceptance',
  DATE: 'On Date',
  OTHER: 'Other',
};

const DELIVERABLE_TYPE_LABELS: Record<ProjectDeliverable['type'], string> = {
  DOCUMENT: 'Document',
  PRODUCT: 'Product',
  SERVICE: 'Service',
  MILESTONE: 'Milestone',
};

/** Firestore Timestamp -> `yyyy-mm-dd` for a `<TextField type="date">` (rule 14). */
function tsToInputDate(ts: unknown): string {
  if (!ts) return '';
  let d: Date | null = null;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    d = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    d = ts;
  }
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function numToInput(n: number | undefined): string {
  return n === undefined || n === null ? '' : String(n);
}

export function RecordOrderAcceptanceDialog({
  open,
  onClose,
  record,
  onSave,
  loading,
}: RecordOrderAcceptanceDialogProps) {
  // Document reference / date / contract value
  const [documentReference, setDocumentReference] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [contractCurrency, setContractCurrency] = useState<CurrencyCode>('INR');

  // Schedule
  const [scheduleDurationDays, setScheduleDurationDays] = useState('');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Payment terms
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [retentionPercentage, setRetentionPercentage] = useState('');
  const [paymentMilestones, setPaymentMilestones] = useState<OrderAcceptanceMilestone[]>([]);
  const [newMsDescription, setNewMsDescription] = useState('');
  const [newMsPercentage, setNewMsPercentage] = useState('');
  const [newMsTriggerType, setNewMsTriggerType] =
    useState<OrderAcceptanceMilestone['triggerType']>('SUBMISSION');
  const [newMsTriggerDescription, setNewMsTriggerDescription] = useState('');

  // Deliverables register
  const [deliverables, setDeliverables] = useState<OrderAcceptanceDeliverable[]>([]);
  const [newDelName, setNewDelName] = useState('');
  const [newDelDescription, setNewDelDescription] = useState('');
  const [newDelType, setNewDelType] = useState<ProjectDeliverable['type']>('DOCUMENT');

  // Key personnel
  const [keyPersonnel, setKeyPersonnel] = useState<{ name: string; role: string }[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');

  // Other notes
  const [otherTermsNotes, setOtherTermsNotes] = useState('');

  // Resync every field whenever the dialog reopens or the underlying record
  // changes (rule 14b) — every saved field is restored on edit (rule 22).
  useEffect(() => {
    if (!open) return;

    setDocumentReference(record?.documentReference ?? '');
    setDocumentDate(tsToInputDate(record?.documentDate));
    setContractAmount(numToInput(record?.contractValue?.amount));
    setContractCurrency(record?.contractValue?.currency ?? 'INR');

    const terms = record?.terms;
    setScheduleDurationDays(numToInput(terms?.scheduleDurationDays));
    setScheduleStartDate(tsToInputDate(terms?.scheduleStartDate));
    setScheduleNotes(terms?.scheduleNotes ?? '');

    setPaymentTermsDays(numToInput(terms?.paymentTermsDays));
    setRetentionPercentage(numToInput(terms?.retentionPercentage));
    setPaymentMilestones(terms?.paymentMilestones ?? []);
    setNewMsDescription('');
    setNewMsPercentage('');
    setNewMsTriggerType('SUBMISSION');
    setNewMsTriggerDescription('');

    setDeliverables(terms?.deliverables ?? []);
    setNewDelName('');
    setNewDelDescription('');
    setNewDelType('DOCUMENT');

    setKeyPersonnel(terms?.keyPersonnel ?? []);
    setNewPersonName('');
    setNewPersonRole('');

    setOtherTermsNotes(terms?.otherTermsNotes ?? '');
  }, [open, record]);

  const handleAddMilestone = () => {
    if (!newMsDescription.trim() || !newMsPercentage.trim()) return;
    setPaymentMilestones([
      ...paymentMilestones,
      {
        description: newMsDescription.trim(),
        paymentPercentage: Number(newMsPercentage),
        triggerType: newMsTriggerType,
        ...((newMsTriggerDescription ?? '').trim() !== '' && {
          triggerDescription: newMsTriggerDescription.trim(),
        }),
      },
    ]);
    setNewMsDescription('');
    setNewMsPercentage('');
    setNewMsTriggerType('SUBMISSION');
    setNewMsTriggerDescription('');
  };

  const handleRemoveMilestone = (index: number) => {
    setPaymentMilestones(paymentMilestones.filter((_, i) => i !== index));
  };

  const handleAddDeliverable = () => {
    if (!newDelName.trim()) return;
    setDeliverables([
      ...deliverables,
      {
        name: newDelName.trim(),
        ...((newDelDescription ?? '').trim() !== '' && { description: newDelDescription.trim() }),
        type: newDelType,
      },
    ]);
    setNewDelName('');
    setNewDelDescription('');
    setNewDelType('DOCUMENT');
  };

  const handleRemoveDeliverable = (index: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== index));
  };

  const handleAddPersonnel = () => {
    if (!newPersonName.trim() || !newPersonRole.trim()) return;
    setKeyPersonnel([...keyPersonnel, { name: newPersonName.trim(), role: newPersonRole.trim() }]);
    setNewPersonName('');
    setNewPersonRole('');
  };

  const handleRemovePersonnel = (index: number) => {
    setKeyPersonnel(keyPersonnel.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const terms: OrderAcceptanceTerms = {
      ...((scheduleDurationDays ?? '').trim() !== '' && {
        scheduleDurationDays: Number(scheduleDurationDays),
      }),
      ...(scheduleStartDate !== '' && {
        scheduleStartDate: Timestamp.fromDate(new Date(scheduleStartDate)),
      }),
      ...((scheduleNotes ?? '').trim() !== '' && { scheduleNotes: scheduleNotes.trim() }),
      ...((paymentTermsDays ?? '').trim() !== '' && {
        paymentTermsDays: Number(paymentTermsDays),
      }),
      ...((retentionPercentage ?? '').trim() !== '' && {
        retentionPercentage: Number(retentionPercentage),
      }),
      ...(paymentMilestones.length > 0 && { paymentMilestones }),
      ...(deliverables.length > 0 && { deliverables }),
      ...(keyPersonnel.length > 0 && { keyPersonnel }),
      ...((otherTermsNotes ?? '').trim() !== '' && { otherTermsNotes: otherTermsNotes.trim() }),
    };

    const data: OrderAcceptanceFormData = {
      ...((documentReference ?? '').trim() !== '' && {
        documentReference: documentReference.trim(),
      }),
      ...(documentDate !== '' && { documentDate: Timestamp.fromDate(new Date(documentDate)) }),
      ...((contractAmount ?? '').trim() !== '' && {
        contractValue: { amount: Number(contractAmount), currency: contractCurrency },
      }),
      terms,
    };

    onSave(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{record ? 'Edit Order Acceptance' : 'Record Order Acceptance'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {/* Document reference / date / contract value */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Signed Order / Agreement
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Document Reference"
                  value={documentReference}
                  onChange={(e) => setDocumentReference(e.target.value)}
                  fullWidth
                  placeholder="e.g. PO26XP062901"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Signature Date"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 8, md: 3 }}>
                <TextField
                  label="Contract Value"
                  type="number"
                  value={contractAmount}
                  onChange={(e) => setContractAmount(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 4, md: 1 }}>
                <TextField
                  select
                  label="Currency"
                  value={contractCurrency}
                  onChange={(e) => setContractCurrency(e.target.value as CurrencyCode)}
                  fullWidth
                >
                  <MenuItem value="INR">INR</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="SGD">SGD</MenuItem>
                  <MenuItem value="AED">AED</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Schedule */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Schedule
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Duration (days)"
                  type="number"
                  value={scheduleDurationDays}
                  onChange={(e) => setScheduleDurationDays(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={scheduleStartDate}
                  onChange={(e) => setScheduleStartDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Schedule Notes"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  fullWidth
                  placeholder="e.g. 12 months from order date"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Payment terms */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Payment Terms
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  label="Payment Terms (days)"
                  type="number"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  label="Retention (%)"
                  type="number"
                  value={retentionPercentage}
                  onChange={(e) => setRetentionPercentage(e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Typography variant="caption" color="text.secondary">
              Payment Milestones
            </Typography>
            <Grid container spacing={1} sx={{ mt: 0.5, mb: 1 }} alignItems="center">
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Description"
                  value={newMsDescription}
                  onChange={(e) => setNewMsDescription(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <TextField
                  label="Payment %"
                  type="number"
                  value={newMsPercentage}
                  onChange={(e) => setNewMsPercentage(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Trigger</InputLabel>
                  <Select
                    value={newMsTriggerType}
                    label="Trigger"
                    onChange={(e) =>
                      setNewMsTriggerType(e.target.value as OrderAcceptanceMilestone['triggerType'])
                    }
                  >
                    {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 4, md: 3 }}>
                <TextField
                  label="Trigger detail"
                  value={newMsTriggerDescription}
                  onChange={(e) => setNewMsTriggerDescription(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g. 30-day deemed acceptance"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 1 }}>
                <Button
                  variant="outlined"
                  onClick={handleAddMilestone}
                  disabled={!newMsDescription.trim() || !newMsPercentage.trim()}
                  fullWidth
                >
                  Add
                </Button>
              </Grid>
            </Grid>
            <List dense>
              {paymentMilestones.map((ms, index) => (
                <ListItem key={index} divider>
                  <ListItemText
                    primary={`${ms.description} — ${ms.paymentPercentage}%`}
                    secondary={`${TRIGGER_TYPE_LABELS[ms.triggerType]}${
                      ms.triggerDescription ? ` (${ms.triggerDescription})` : ''
                    }`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemoveMilestone(index)}
                      aria-label="Remove milestone"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          {/* Deliverables register */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Deliverables Register
            </Typography>
            <Grid container spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Name"
                  value={newDelName}
                  onChange={(e) => setNewDelName(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Description"
                  value={newDelDescription}
                  onChange={(e) => setNewDelDescription(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 8, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={newDelType}
                    label="Type"
                    onChange={(e) => setNewDelType(e.target.value as ProjectDeliverable['type'])}
                  >
                    {Object.entries(DELIVERABLE_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 4, md: 1 }}>
                <Button
                  variant="outlined"
                  onClick={handleAddDeliverable}
                  disabled={!newDelName.trim()}
                  fullWidth
                >
                  Add
                </Button>
              </Grid>
            </Grid>
            <List dense>
              {deliverables.map((d, index) => (
                <ListItem key={index} divider>
                  <ListItemText
                    primary={`${d.name} (${DELIVERABLE_TYPE_LABELS[d.type]})`}
                    secondary={d.description}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemoveDeliverable(index)}
                      aria-label="Remove deliverable"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          {/* Key personnel */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Key Personnel
            </Typography>
            <Grid container spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Grid size={{ xs: 6, md: 5 }}>
                <TextField
                  label="Name"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 6, md: 5 }}>
                <TextField
                  label="Role"
                  value={newPersonRole}
                  onChange={(e) => setNewPersonRole(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleAddPersonnel}
                  disabled={!newPersonName.trim() || !newPersonRole.trim()}
                  fullWidth
                >
                  Add
                </Button>
              </Grid>
            </Grid>
            <List dense>
              {keyPersonnel.map((p, index) => (
                <ListItem key={index} divider>
                  <ListItemText primary={p.name} secondary={p.role} />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemovePersonnel(index)}
                      aria-label="Remove person"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider />

          {/* Other notes */}
          <TextField
            label="Other Terms / Notes"
            value={otherTermsNotes}
            onChange={(e) => setOtherTermsNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : record ? 'Save Changes' : 'Save Draft'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

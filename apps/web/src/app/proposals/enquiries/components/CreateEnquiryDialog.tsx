'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Paper,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  AutoAwesome as AiIcon,
  UploadFile as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { Controller, useForm } from 'react-hook-form';
import { Timestamp } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '@/lib/firebase/clientApp';
import type {
  EnquiryDocument,
  BusinessEntity,
  EnquiryCondition,
  UnifiedScopeMatrix,
} from '@vapour/types';
import { parsedScopeToMatrix, type ParsedScopeCategory } from '@/lib/enquiry/parsedScope';

// Contact from BusinessEntity.contacts array
interface EntityContactInfo {
  id: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary: boolean;
  notes?: string;
}
import { useFirestore } from '@/lib/firebase/hooks';
import { createEnquiry } from '@/lib/enquiry/enquiryService';
import { useAuth } from '@/contexts/AuthContext';
import type { EnquirySource, EnquiryUrgency, WorkComponent, CurrencyCode } from '@vapour/types';
import { ENQUIRY_URGENCY_LABELS } from '@vapour/types';
import {
  WORK_COMPONENT_LABELS,
  WORK_COMPONENT_ORDER,
  CONDITION_CATEGORY_LABELS,
  CONDITION_CATEGORY_ORDER,
} from '@vapour/constants';
import { createEnquiryFormSchema } from '@vapour/validation';
import { EntitySelector } from '@/components/common/forms/EntitySelector';

// Fallback tenant ID for users without multi-tenant claims
const FALLBACK_TENANT_ID = 'default-entity';

// Explicit form type definition (instead of z.infer which has cross-package issues)
interface CreateEnquiryFormValues {
  clientId: string;
  clientContactPerson: string;
  clientEmail: string;
  clientPhone: string;
  clientReferenceNumber?: string;
  title: string;
  description: string;
  receivedVia: EnquirySource;
  referenceSource?: string;
  workComponents: WorkComponent[];
  industry?: string;
  location?: string;
  urgency: EnquiryUrgency;
  estimatedBudget?: {
    amount: number;
    currency?: CurrencyCode;
  };
  receivedDate: Date;
  requiredDeliveryDate?: Date;
  requirements: string[];
  attachments: EnquiryDocument[];
  assignedToUserId?: string;
}

interface CreateEnquiryDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedFieldsResult {
  title?: string;
  description?: string;
  clientName?: string;
  clientContactPerson?: string;
  clientEmail?: string;
  clientPhone?: string;
  location?: string;
  industry?: string;
  workComponents?: WorkComponent[];
  requiredDeliveryDate?: string;
  documentDate?: string;
  requirements?: string[];
  urgency?: 'STANDARD' | 'URGENT';
}

interface ParsedConditionResult {
  category: EnquiryCondition['category'];
  summary: string;
  verbatim?: string;
}

interface ParseEnquiryResponse {
  success: boolean;
  fields: ParsedFieldsResult;
  conditions: ParsedConditionResult[];
  scope: ParsedScopeCategory[];
  warnings?: string[];
}

const newConditionId = (): string => Math.random().toString(36).slice(2, 11);

export function CreateEnquiryDialog({ open, onClose, onSuccess }: CreateEnquiryDialogProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // State for entity contacts when a client is selected
  const [entityContacts, setEntityContacts] = useState<EntityContactInfo[]>([]);

  // AI parser state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<{
    severity: 'success' | 'info' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [aiFilledKeys, setAiFilledKeys] = useState<Set<string>>(new Set());

  // Conditions parsed from the SOW or added manually
  const [conditions, setConditions] = useState<EnquiryCondition[]>([]);

  // Scope outline parsed from the SOW (immutable record of what the buyer asked for —
  // copied to the proposal's editable scope matrix on proposal create)
  const [requestedScope, setRequestedScope] = useState<UnifiedScopeMatrix | undefined>(undefined);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateEnquiryFormValues>({
    mode: 'onBlur',
    defaultValues: {
      title: '',
      clientId: '',
      clientContactPerson: '',
      clientEmail: '',
      clientPhone: '',
      receivedVia: 'EMAIL',
      receivedDate: new Date(),
      urgency: 'STANDARD',
      workComponents: [],
      description: '',
      requirements: [],
      attachments: [],
    },
  });

  /* ─── AI parser ──────────────────────────────────────────────────────── */

  const handlePdfPicked = (file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setParseStatus({ severity: 'error', message: 'Only PDF files are supported.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseStatus({ severity: 'error', message: 'File too large (max 10 MB).' });
      return;
    }
    setPdfFile(file);
    setParseStatus(null);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const applyParsedFields = (fields: ParsedFieldsResult) => {
    const filled = new Set<string>();
    if (fields.title) {
      setValue('title', fields.title);
      filled.add('title');
    }
    if (fields.description) {
      setValue('description', fields.description);
      filled.add('description');
    }
    if (fields.clientContactPerson) {
      setValue('clientContactPerson', fields.clientContactPerson);
      filled.add('clientContactPerson');
    }
    if (fields.clientEmail) {
      setValue('clientEmail', fields.clientEmail);
      filled.add('clientEmail');
    }
    if (fields.clientPhone) {
      setValue('clientPhone', fields.clientPhone);
      filled.add('clientPhone');
    }
    if (fields.location) {
      setValue('location', fields.location);
      filled.add('location');
    }
    if (fields.industry) {
      setValue('industry', fields.industry);
      filled.add('industry');
    }
    if (fields.workComponents && fields.workComponents.length > 0) {
      setValue('workComponents', fields.workComponents);
      filled.add('workComponents');
    }
    if (fields.urgency) {
      setValue('urgency', fields.urgency);
      filled.add('urgency');
    }
    if (fields.requiredDeliveryDate) {
      const d = new Date(fields.requiredDeliveryDate);
      if (!Number.isNaN(d.getTime())) {
        setValue('requiredDeliveryDate', d);
        filled.add('requiredDeliveryDate');
      }
    }
    if (fields.requirements && fields.requirements.length > 0) {
      setValue('requirements', fields.requirements);
      filled.add('requirements');
    }
    setAiFilledKeys(filled);
  };

  const handleParse = async () => {
    if (!pdfFile) return;
    if (!user?.uid) {
      setParseStatus({ severity: 'error', message: 'Sign in first.' });
      return;
    }

    setParsing(true);
    setParseStatus({ severity: 'info', message: 'Reading the document — this takes ~30 seconds.' });

    try {
      const base64 = await fileToBase64(pdfFile);
      const fn = getFunctions(firebaseApp, 'asia-south1');
      const callable = httpsCallable<
        { fileName: string; mimeType: string; fileBase64: string; fileSize: number },
        ParseEnquiryResponse
      >(fn, 'parseEnquiryDocument');
      const res = await callable({
        fileName: pdfFile.name,
        mimeType: pdfFile.type,
        fileBase64: base64,
        fileSize: pdfFile.size,
      });
      const result = res.data;
      applyParsedFields(result.fields);
      setConditions(
        result.conditions.map((c) => ({
          id: newConditionId(),
          category: c.category,
          summary: c.summary,
          verbatim: c.verbatim,
          source: 'AI_PARSED',
        }))
      );
      const scopeMatrix = result.scope?.length ? parsedScopeToMatrix(result.scope) : undefined;
      setRequestedScope(scopeMatrix);
      const scopeItemCount = scopeMatrix?.categories.reduce((s, c) => s + c.items.length, 0) ?? 0;

      const filledCount =
        Object.keys(result.fields).length +
        (result.conditions.length > 0 ? 1 : 0) +
        (scopeItemCount > 0 ? 1 : 0);
      const warnings = result.warnings?.join(' ') ?? '';
      if (filledCount === 0) {
        setParseStatus({
          severity: 'warning',
          message:
            warnings || "Couldn't pull anything structured from the document. Fill in manually.",
        });
      } else {
        const fieldCount = Object.keys(result.fields).length;
        const parts = [
          `${fieldCount} field${fieldCount === 1 ? '' : 's'}`,
          `${result.conditions.length} condition${result.conditions.length === 1 ? '' : 's'}`,
          `${scopeItemCount} scope item${scopeItemCount === 1 ? '' : 's'}`,
        ];
        setParseStatus({
          severity: 'success',
          message: `Filled ${parts.join(', ')}. Review and edit anything before saving.${warnings ? ' ' + warnings : ''}`,
        });
      }
    } catch (err) {
      console.error('parseEnquiryDocument failed', err);
      setParseStatus({
        severity: 'error',
        message:
          err instanceof Error
            ? `Couldn't read the document: ${err.message}`
            : "Couldn't read the document — try again or fill manually.",
      });
    } finally {
      setParsing(false);
    }
  };

  /* ─── Conditions editor ──────────────────────────────────────────────── */

  const addCondition = () =>
    setConditions((prev) => [
      ...prev,
      {
        id: newConditionId(),
        category: 'OTHER',
        summary: '',
        source: 'MANUAL',
      },
    ]);

  const updateCondition = (id: string, patch: Partial<EnquiryCondition>) =>
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const removeCondition = (id: string) => setConditions((prev) => prev.filter((c) => c.id !== id));

  /* ─── Submit ─────────────────────────────────────────────────────────── */

  const onSubmit = async (data: CreateEnquiryFormValues) => {
    const tenantId = claims?.tenantId || FALLBACK_TENANT_ID;

    if (!db || !user?.uid) {
      setError('Missing required authentication data. Please ensure you are properly logged in.');
      return;
    }

    // Validate with Zod schema
    const validation = createEnquiryFormSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      setError(firstError?.message || 'Please check your form data');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Drop any conditions with empty summaries before saving
      const cleanedConditions = conditions
        .map((c) => ({ ...c, summary: c.summary.trim() }))
        .filter((c) => c.summary.length > 0);

      await createEnquiry(
        db,
        {
          ...data,
          conditions: cleanedConditions.length > 0 ? cleanedConditions : undefined,
          ...(requestedScope && requestedScope.categories.length > 0 && { requestedScope }),
          estimatedBudget: data.estimatedBudget
            ? {
                amount: data.estimatedBudget.amount,
                currency: data.estimatedBudget.currency || 'INR',
              }
            : undefined,
          receivedDate: Timestamp.fromDate(data.receivedDate),
          requiredDeliveryDate: data.requiredDeliveryDate
            ? Timestamp.fromDate(data.requiredDeliveryDate)
            : undefined,
          tenantId,
        },
        user.uid
      );

      reset();
      setConditions([]);
      setRequestedScope(undefined);
      setPdfFile(null);
      setParseStatus(null);
      setAiFilledKeys(new Set());
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating enquiry:', error);
      setError('Failed to create enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setEntityContacts([]);
    setConditions([]);
    setRequestedScope(undefined);
    setPdfFile(null);
    setParseStatus(null);
    setAiFilledKeys(new Set());
    onClose();
  };

  // Handle entity selection - populate contacts dropdown
  const handleEntitySelect = (entity: BusinessEntity | null) => {
    if (entity && entity.contacts && entity.contacts.length > 0) {
      setEntityContacts(entity.contacts);
      // Auto-select primary contact if available
      const primaryContact = entity.contacts.find((c) => c.isPrimary);
      if (primaryContact) {
        setValue('clientContactPerson', primaryContact.name);
        setValue('clientEmail', primaryContact.email || '');
        setValue('clientPhone', primaryContact.phone || primaryContact.mobile || '');
      }
    } else {
      setEntityContacts([]);
      setValue('clientContactPerson', '');
      setValue('clientEmail', '');
      setValue('clientPhone', '');
    }
  };

  // Handle contact selection from dropdown
  const handleContactSelect = (contactId: string) => {
    const contact = entityContacts.find((c) => c.id === contactId);
    if (contact) {
      setValue('clientContactPerson', contact.name);
      setValue('clientEmail', contact.email || '');
      setValue('clientPhone', contact.phone || contact.mobile || '');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Create New Enquiry</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* AI parser drop zone */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'action.hover',
                borderStyle: 'dashed',
                borderColor: pdfFile ? 'primary.main' : 'divider',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <AiIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2">Have an SOW PDF? Read it for me.</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Drop the PDF here and the form below will fill in. You can edit anything before
                saving.
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<UploadIcon />}
                  disabled={parsing}
                >
                  {pdfFile ? 'Pick a different PDF' : 'Pick a PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => handlePdfPicked(e.target.files?.[0] ?? null)}
                  />
                </Button>
                {pdfFile && (
                  <>
                    <Chip
                      label={`${pdfFile.name} (${(pdfFile.size / 1024).toFixed(0)} KB)`}
                      size="small"
                      onDelete={() => {
                        setPdfFile(null);
                        setParseStatus(null);
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={parsing ? <CircularProgress size={14} /> : <AiIcon />}
                      onClick={handleParse}
                      disabled={parsing}
                    >
                      {parsing ? 'Reading…' : 'Read PDF'}
                    </Button>
                  </>
                )}
              </Stack>
              {parseStatus && (
                <Alert
                  severity={parseStatus.severity}
                  sx={{ mt: 1.5 }}
                  onClose={() => setParseStatus(null)}
                >
                  {parseStatus.message}
                </Alert>
              )}
            </Paper>

            <Grid container spacing={3}>
              {/* Title */}
              <Grid size={12}>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Enquiry Title"
                      fullWidth
                      required
                      error={!!errors.title}
                      helperText={errors.title?.message}
                    />
                  )}
                />
              </Grid>

              {/* Client Selection */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <EntitySelector
                      value={field.value}
                      onChange={field.onChange}
                      onEntitySelect={handleEntitySelect}
                      label="Client"
                      required
                      filterByRole="CUSTOMER"
                      error={!!errors.clientId}
                      helperText={errors.clientId?.message}
                    />
                  )}
                />
              </Grid>

              {/* Client Contact Person - Dropdown when contacts available */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientContactPerson"
                  control={control}
                  render={({ field }) =>
                    entityContacts.length > 0 ? (
                      <FormControl fullWidth error={!!errors.clientContactPerson}>
                        <InputLabel>Contact Person</InputLabel>
                        <Select
                          value={entityContacts.find((c) => c.name === field.value)?.id || ''}
                          onChange={(e) => {
                            const contactId = e.target.value as string;
                            if (contactId) {
                              handleContactSelect(contactId);
                            }
                          }}
                          label="Contact Person"
                        >
                          {entityContacts.map((contact) => (
                            <MenuItem key={contact.id} value={contact.id}>
                              {contact.name}
                              {contact.designation && ` (${contact.designation})`}
                              {contact.isPrimary && ' ⭐'}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {errors.clientContactPerson?.message ||
                            'Select a contact from the client'}
                        </FormHelperText>
                      </FormControl>
                    ) : (
                      <TextField
                        {...field}
                        label="Contact Person"
                        fullWidth
                        error={!!errors.clientContactPerson}
                        helperText={errors.clientContactPerson?.message || 'Select a client first'}
                      />
                    )
                  }
                />
              </Grid>

              {/* Client Email */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientEmail"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Client Email"
                      type="email"
                      fullWidth
                      error={!!errors.clientEmail}
                      helperText={errors.clientEmail?.message || 'Auto-filled from contact'}
                    />
                  )}
                />
              </Grid>

              {/* Client Phone */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientPhone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Client Phone"
                      fullWidth
                      error={!!errors.clientPhone}
                      helperText={errors.clientPhone?.message || 'Auto-filled from contact'}
                    />
                  )}
                />
              </Grid>

              {/* Received Date */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="receivedDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Received Date"
                      value={field.value}
                      onChange={field.onChange}
                      format="dd/MM/yyyy"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          error: !!errors.receivedDate,
                          helperText: errors.receivedDate?.message,
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Urgency */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="urgency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.urgency}>
                      <InputLabel>Urgency</InputLabel>
                      <Select {...field} label="Urgency">
                        {Object.entries(ENQUIRY_URGENCY_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>{errors.urgency?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              {/* Type of work — multi-select cards */}
              <Grid size={12}>
                <Controller
                  name="workComponents"
                  control={control}
                  render={({ field }) => {
                    const value = field.value ?? [];
                    const toggle = (key: WorkComponent) => {
                      field.onChange(
                        value.includes(key) ? value.filter((k) => k !== key) : [...value, key]
                      );
                    };
                    return (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          Type of work
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          Tick everything this proposal will cover. You can refine the scope later.
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              sm: 'repeat(2, 1fr)',
                              md: 'repeat(3, 1fr)',
                            },
                            gap: 1.5,
                          }}
                        >
                          {WORK_COMPONENT_ORDER.map((key) => {
                            const label = WORK_COMPONENT_LABELS[key];
                            const selected = value.includes(key);
                            return (
                              <Card
                                key={key}
                                variant="outlined"
                                sx={{
                                  position: 'relative',
                                  borderColor: selected ? 'primary.main' : 'divider',
                                  borderWidth: selected ? 2 : 1,
                                  bgcolor: selected ? 'action.selected' : 'background.paper',
                                  transition: 'all 120ms ease',
                                }}
                              >
                                <CardActionArea onClick={() => toggle(key)} sx={{ height: '100%' }}>
                                  <CardContent sx={{ py: 1.5, pr: 4 }}>
                                    <Typography variant="subtitle2">{label.title}</Typography>
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ mt: 0.5 }}
                                    >
                                      {label.description}
                                    </Typography>
                                  </CardContent>
                                </CardActionArea>
                                {selected && (
                                  <CheckIcon
                                    color="primary"
                                    sx={{
                                      position: 'absolute',
                                      top: 8,
                                      right: 8,
                                      pointerEvents: 'none',
                                    }}
                                  />
                                )}
                              </Card>
                            );
                          })}
                        </Box>
                        {errors.workComponents?.message && (
                          <FormHelperText error sx={{ mt: 1 }}>
                            {errors.workComponents.message}
                          </FormHelperText>
                        )}
                      </Box>
                    );
                  }}
                />
              </Grid>

              {/* Description */}
              <Grid size={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description / Scope Overview"
                      fullWidth
                      multiline
                      rows={4}
                      error={!!errors.description}
                      helperText={
                        errors.description?.message ||
                        (aiFilledKeys.has('description')
                          ? '✨ Filled from PDF — edit if needed'
                          : '')
                      }
                    />
                  )}
                />
              </Grid>

              {/* Conditions section */}
              <Grid size={12}>
                <ConditionsEditor
                  conditions={conditions}
                  onAdd={addCondition}
                  onUpdate={updateCondition}
                  onRemove={removeCondition}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Enquiry'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/* ─── Conditions editor sub-component ──────────────────────────────────── */

interface ConditionsEditorProps {
  conditions: EnquiryCondition[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<EnquiryCondition>) => void;
  onRemove: (id: string) => void;
}

function ConditionsEditor({ conditions, onAdd, onUpdate, onRemove }: ConditionsEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle2">Conditions from the buyer</Typography>
          <Typography variant="body2" color="text.secondary">
            Stipulations the buyer expects you to meet — qualifications, commercial terms,
            compliance, reporting, and so on.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} size="small" onClick={onAdd}>
          Add condition
        </Button>
      </Stack>

      {conditions.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No conditions yet. Use the SOW reader above, or add one by hand.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1}>
          {conditions.map((c) => {
            const expanded = expandedIds.has(c.id);
            return (
              <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                      value={c.category}
                      onChange={(e) =>
                        onUpdate(c.id, { category: e.target.value as EnquiryCondition['category'] })
                      }
                    >
                      {CONDITION_CATEGORY_ORDER.map((cat) => (
                        <MenuItem key={cat} value={cat}>
                          {CONDITION_CATEGORY_LABELS[cat]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Short summary, ~10 words"
                    value={c.summary}
                    onChange={(e) => onUpdate(c.id, { summary: e.target.value })}
                  />
                  {c.source === 'AI_PARSED' && (
                    <Chip
                      size="small"
                      icon={<AiIcon fontSize="small" />}
                      label="AI"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {c.verbatim && (
                    <IconButton size="small" onClick={() => toggleExpand(c.id)}>
                      {expanded ? (
                        <CollapseIcon fontSize="small" />
                      ) : (
                        <ExpandIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  <IconButton size="small" color="error" onClick={() => onRemove(c.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                {c.verbatim && (
                  <Collapse in={expanded}>
                    <Box
                      sx={{
                        mt: 1.5,
                        pl: 2,
                        py: 1,
                        borderLeft: 3,
                        borderColor: 'primary.light',
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        From the document
                      </Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        “{c.verbatim}”
                      </Typography>
                    </Box>
                  </Collapse>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

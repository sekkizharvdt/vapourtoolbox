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
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { Controller, useForm } from 'react-hook-form';
import { Timestamp } from 'firebase/firestore';
import type { EnquiryDocument, BusinessEntity } from '@vapour/types';

// Contact from BusinessEntity.contacts array
interface EntityContactInfo {
  id: string;
  name: string;
  designation?: string;
  email: string;
  phone: string;
  mobile?: string;
  isPrimary: boolean;
  notes?: string;
}
import { useFirestore } from '@/lib/firebase/hooks';
import { createEnquiry } from '@/lib/enquiry/enquiryService';
import { useAuth } from '@/contexts/AuthContext';
import type {
  EnquirySource,
  EnquiryUrgency,
  EnquiryProjectType,
  CurrencyCode,
} from '@vapour/types';
import { ENQUIRY_URGENCY_LABELS, ENQUIRY_PROJECT_TYPE_LABELS } from '@vapour/types';
import { createEnquiryFormSchema } from '@vapour/validation';
import { EntitySelector } from '@/components/common/forms/EntitySelector';

// Fallback entity ID for users without multi-entity claims
const FALLBACK_ENTITY_ID = 'default-entity';

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
  projectType?: EnquiryProjectType;
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

export function CreateEnquiryDialog({ open, onClose, onSuccess }: CreateEnquiryDialogProps) {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // State for entity contacts when a client is selected
  const [entityContacts, setEntityContacts] = useState<EntityContactInfo[]>([]);

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
      projectType: 'SUPPLY_ONLY',
      description: '',
      requirements: [],
      attachments: [],
    },
  });

  const onSubmit = async (data: CreateEnquiryFormValues) => {
    const entityId = claims?.entityId || FALLBACK_ENTITY_ID;

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

      await createEnquiry(
        db,
        {
          ...data,
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
          entityId,
        },
        user.uid
      );

      reset();
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
        setValue('clientEmail', primaryContact.email);
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
      setValue('clientEmail', contact.email);
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

              {/* Project Type */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="projectType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.projectType}>
                      <InputLabel>Project Type</InputLabel>
                      <Select {...field} label="Project Type">
                        {Object.entries(ENQUIRY_PROJECT_TYPE_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>{errors.projectType?.message}</FormHelperText>
                    </FormControl>
                  )}
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
                      helperText={errors.description?.message}
                    />
                  )}
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

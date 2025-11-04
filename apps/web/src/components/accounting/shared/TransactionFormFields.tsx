'use client';

import React from 'react';
import { Grid, TextField, MenuItem } from '@mui/material';
import type { TransactionStatus } from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

interface TransactionFormFieldsProps {
  /**
   * Transaction date (ISO date string)
   */
  date: string;
  /**
   * Callback to update date
   */
  onDateChange: (date: string) => void;
  /**
   * Transaction due date (ISO date string)
   */
  dueDate: string;
  /**
   * Callback to update due date
   */
  onDueDateChange: (dueDate: string) => void;
  /**
   * Entity (customer/vendor) ID
   */
  entityId: string | null;
  /**
   * Callback to update entity ID
   */
  onEntityChange: (entityId: string | null) => void;
  /**
   * Transaction status
   */
  status: TransactionStatus;
  /**
   * Callback to update status
   */
  onStatusChange: (status: TransactionStatus) => void;
  /**
   * Transaction description
   */
  description: string;
  /**
   * Callback to update description
   */
  onDescriptionChange: (description: string) => void;
  /**
   * Reference number (PO, job reference, etc.)
   */
  reference: string;
  /**
   * Callback to update reference
   */
  onReferenceChange: (reference: string) => void;
  /**
   * Project/Cost Centre ID
   */
  projectId: string | null;
  /**
   * Callback to update project ID
   */
  onProjectChange: (projectId: string | null) => void;
  /**
   * Entity selector label (e.g., "Customer" for invoices, "Vendor" for bills)
   */
  entityLabel: string;
  /**
   * Entity role filter for EntitySelector
   */
  entityRole: 'CUSTOMER' | 'VENDOR';
  /**
   * Whether fields are disabled (read-only mode)
   */
  disabled?: boolean;
}

/**
 * Reusable form fields component for transaction dialogs (invoices, bills).
 * Includes date fields, entity selector, status, description, reference, and project.
 *
 * @example
 * ```tsx
 * <TransactionFormFields
 *   date={date}
 *   onDateChange={setDate}
 *   dueDate={dueDate}
 *   onDueDateChange={setDueDate}
 *   entityId={entityId}
 *   onEntityChange={setEntityId}
 *   status={status}
 *   onStatusChange={setStatus}
 *   description={description}
 *   onDescriptionChange={setDescription}
 *   reference={reference}
 *   onReferenceChange={setReference}
 *   projectId={projectId}
 *   onProjectChange={setProjectId}
 *   entityLabel="Customer"
 *   entityRole="CUSTOMER"
 * />
 * ```
 */
export function TransactionFormFields({
  date,
  onDateChange,
  dueDate,
  onDueDateChange,
  entityId,
  onEntityChange,
  status,
  onStatusChange,
  description,
  onDescriptionChange,
  reference,
  onReferenceChange,
  projectId,
  onProjectChange,
  entityLabel,
  entityRole,
  disabled = false,
}: TransactionFormFieldsProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          required
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Due Date"
          type="date"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <EntitySelector
          value={entityId}
          onChange={onEntityChange}
          label={entityLabel}
          required
          filterByRole={entityRole}
          disabled={disabled}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Status"
          select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as TransactionStatus)}
          required
          disabled={disabled}
        >
          <MenuItem value="DRAFT">Draft</MenuItem>
          <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
          <MenuItem value="APPROVED">Approved</MenuItem>
          <MenuItem value="POSTED">Posted</MenuItem>
          <MenuItem value="VOID">Void</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          multiline
          rows={2}
          disabled={disabled}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Reference"
          value={reference}
          onChange={(e) => onReferenceChange(e.target.value)}
          helperText="PO number, job reference, etc."
          disabled={disabled}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <ProjectSelector
          value={projectId}
          onChange={onProjectChange}
          label="Project / Cost Centre"
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );
}

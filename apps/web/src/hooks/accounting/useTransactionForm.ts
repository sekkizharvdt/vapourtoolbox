import { useState, useEffect, useCallback } from 'react';
import type { TransactionStatus } from '@vapour/types';

interface TransactionFormData {
  date: string;
  dueDate: string;
  entityId: string | null;
  entityName: string;
  description: string;
  reference: string;
  projectId: string | null;
  status: TransactionStatus;
}

interface UseTransactionFormOptions {
  /**
   * Initial transaction data for editing
   */
  initialData?: Omit<Partial<TransactionFormData>, 'date' | 'dueDate'> & {
    date?: Date | string;
    dueDate?: Date | string;
  };
  /**
   * Whether the dialog is open
   */
  isOpen?: boolean;
  /**
   * Callback to execute when form is reset
   */
  onReset?: () => void;
}

interface UseTransactionFormReturn extends TransactionFormData {
  /**
   * Update date field
   */
  setDate: (date: string) => void;
  /**
   * Update due date field
   */
  setDueDate: (dueDate: string) => void;
  /**
   * Update entity ID
   */
  setEntityId: (entityId: string | null) => void;
  /**
   * Update entity name
   */
  setEntityName: (name: string) => void;
  /**
   * Update description
   */
  setDescription: (description: string) => void;
  /**
   * Update reference number
   */
  setReference: (reference: string) => void;
  /**
   * Update project/cost centre ID
   */
  setProjectId: (projectId: string | null) => void;
  /**
   * Update transaction status
   */
  setStatus: (status: TransactionStatus) => void;
  /**
   * Reset form to initial/default values
   */
  resetForm: () => void;
  /**
   * Get all form data as an object
   */
  getFormData: () => TransactionFormData;
}

/**
 * Converts Date or string to ISO date string for input fields
 */
function toDateString(date: Date | string | undefined | null): string {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0] || '';
  }
  if (typeof date === 'string') {
    return date;
  }
  return '';
}

/**
 * Custom hook for managing common transaction form state.
 * Handles date, entity, description, reference, project, and status fields.
 * Automatically resets form when dialog opens/closes.
 *
 * @example
 * ```tsx
 * const formState = useTransactionForm({
 *   initialData: editingInvoice,
 *   isOpen: dialogOpen,
 * });
 *
 * // Use in JSX
 * <TextField
 *   value={formState.description}
 *   onChange={(e) => formState.setDescription(e.target.value)}
 * />
 * ```
 */
export function useTransactionForm(
  options: UseTransactionFormOptions = {}
): UseTransactionFormReturn {
  const { initialData, isOpen, onReset } = options;

  // Form state
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '');
  const [dueDate, setDueDate] = useState<string>('');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('DRAFT');

  // Reset form to default values
  const resetToDefaults = useCallback(() => {
    setDate(new Date().toISOString().split('T')[0] || '');
    setDueDate('');
    setEntityId(null);
    setEntityName('');
    setDescription('');
    setReference('');
    setProjectId(null);
    setStatus('DRAFT');
    onReset?.();
  }, [onReset]);

  // Load initial data (for editing)
  const loadInitialData = useCallback(() => {
    if (!initialData) {
      resetToDefaults();
      return;
    }

    // Convert dates to strings for input fields
    const dateStr = toDateString(initialData.date);
    const dueDateStr = toDateString(initialData.dueDate);

    setDate(dateStr || new Date().toISOString().split('T')[0] || '');
    setDueDate(dueDateStr || '');
    setEntityId(initialData.entityId ?? null);
    setEntityName(initialData.entityName || '');
    setDescription(initialData.description || '');
    setReference(initialData.reference || '');
    setProjectId(initialData.projectId ?? null);
    setStatus(initialData.status || 'DRAFT');
  }, [initialData, resetToDefaults]);

  // Reset form when dialog opens/closes or initial data changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        loadInitialData();
      } else {
        resetToDefaults();
      }
    }
  }, [isOpen, initialData, loadInitialData, resetToDefaults]);

  // Get all form data as an object
  const getFormData = useCallback((): TransactionFormData => {
    return {
      date,
      dueDate,
      entityId,
      entityName,
      description,
      reference,
      projectId,
      status,
    };
  }, [date, dueDate, entityId, entityName, description, reference, projectId, status]);

  return {
    date,
    dueDate,
    entityId,
    entityName,
    description,
    reference,
    projectId,
    status,
    setDate,
    setDueDate,
    setEntityId,
    setEntityName,
    setDescription,
    setReference,
    setProjectId,
    setStatus,
    resetForm: resetToDefaults,
    getFormData,
  };
}

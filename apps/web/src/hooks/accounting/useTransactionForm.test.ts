/**
 * useTransactionForm Hook Tests
 *
 * Tests for the useTransactionForm hook that manages common transaction form state.
 * Covers form initialization, updates, reset functionality, and date conversions.
 */

import { renderHook, act } from '@testing-library/react';
import { useTransactionForm } from './useTransactionForm';
import type { TransactionStatus } from '@vapour/types';

describe('useTransactionForm Hook', () => {
  describe('Initialization', () => {
    it('should initialize with default values when no initialData provided', () => {
      const { result } = renderHook(() => useTransactionForm());

      const today = new Date().toISOString().split('T')[0];

      expect(result.current.date).toBe(today);
      expect(result.current.dueDate).toBe('');
      expect(result.current.entityId).toBeNull();
      expect(result.current.entityName).toBe('');
      expect(result.current.description).toBe('');
      expect(result.current.reference).toBe('');
      expect(result.current.projectId).toBeNull();
      expect(result.current.status).toBe('DRAFT');
    });

    it('should initialize with provided initialData when dialog opens', () => {
      const initialData = {
        date: new Date('2025-01-15'),
        dueDate: new Date('2025-02-15'),
        entityId: 'entity-123',
        entityName: 'Acme Corp',
        description: 'Invoice for services',
        reference: 'INV-2025-001',
        projectId: 'project-456',
        status: 'PENDING_APPROVAL' as TransactionStatus,
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData,
          isOpen: true,
        })
      );

      expect(result.current.date).toBe('2025-01-15');
      expect(result.current.dueDate).toBe('2025-02-15');
      expect(result.current.entityId).toBe('entity-123');
      expect(result.current.entityName).toBe('Acme Corp');
      expect(result.current.description).toBe('Invoice for services');
      expect(result.current.reference).toBe('INV-2025-001');
      expect(result.current.projectId).toBe('project-456');
      expect(result.current.status).toBe('PENDING_APPROVAL');
    });

    it('should handle string dates in initialData', () => {
      const initialData = {
        date: '2025-01-15',
        dueDate: '2025-02-15',
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData,
          isOpen: true,
        })
      );

      expect(result.current.date).toBe('2025-01-15');
      expect(result.current.dueDate).toBe('2025-02-15');
    });

    it('should handle Firestore Timestamp objects in initialData', () => {
      // Simulate Firestore Timestamp by using Date objects
      const initialData = {
        date: new Date('2025-01-15'),
        dueDate: new Date('2025-01-15'),
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData,
          isOpen: true,
        })
      );

      expect(result.current.date).toBe('2025-01-15');
      expect(result.current.dueDate).toBe('2025-01-15');
    });
  });

  describe('Field Updates', () => {
    it('should update date field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setDate('2025-03-01');
      });

      expect(result.current.date).toBe('2025-03-01');
    });

    it('should update dueDate field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setDueDate('2025-04-01');
      });

      expect(result.current.dueDate).toBe('2025-04-01');
    });

    it('should update entityId field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setEntityId('entity-789');
      });

      expect(result.current.entityId).toBe('entity-789');
    });

    it('should update entityName field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setEntityName('New Customer');
      });

      expect(result.current.entityName).toBe('New Customer');
    });

    it('should update description field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setDescription('Payment for consulting services');
      });

      expect(result.current.description).toBe('Payment for consulting services');
    });

    it('should update reference field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setReference('PAY-2025-042');
      });

      expect(result.current.reference).toBe('PAY-2025-042');
    });

    it('should update projectId field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setProjectId('project-999');
      });

      expect(result.current.projectId).toBe('project-999');
    });

    it('should update status field', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setStatus('APPROVED');
      });

      expect(result.current.status).toBe('APPROVED');
    });

    it('should allow setting entityId to null', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setEntityId('entity-123');
      });
      expect(result.current.entityId).toBe('entity-123');

      act(() => {
        result.current.setEntityId(null);
      });
      expect(result.current.entityId).toBeNull();
    });

    it('should allow setting projectId to null', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setProjectId('project-456');
      });
      expect(result.current.projectId).toBe('project-456');

      act(() => {
        result.current.setProjectId(null);
      });
      expect(result.current.projectId).toBeNull();
    });
  });

  describe('Form Reset', () => {
    it('should reset form to default values', () => {
      const { result } = renderHook(() => useTransactionForm());

      // Set some values
      act(() => {
        result.current.setDate('2025-03-01');
        result.current.setDueDate('2025-04-01');
        result.current.setEntityId('entity-123');
        result.current.setEntityName('Test Entity');
        result.current.setDescription('Test description');
        result.current.setReference('REF-001');
        result.current.setProjectId('project-456');
        result.current.setStatus('APPROVED');
      });

      // Reset form
      act(() => {
        result.current.resetForm();
      });

      const today = new Date().toISOString().split('T')[0];

      expect(result.current.date).toBe(today);
      expect(result.current.dueDate).toBe('');
      expect(result.current.entityId).toBeNull();
      expect(result.current.entityName).toBe('');
      expect(result.current.description).toBe('');
      expect(result.current.reference).toBe('');
      expect(result.current.projectId).toBeNull();
      expect(result.current.status).toBe('DRAFT');
    });

    it('should call onReset callback when form is reset', () => {
      const onReset = jest.fn();
      const { result } = renderHook(() => useTransactionForm({ onReset }));

      act(() => {
        result.current.resetForm();
      });

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should reset when dialog closes', () => {
      const { result, rerender } = renderHook(({ isOpen }) => useTransactionForm({ isOpen }), {
        initialProps: { isOpen: true },
      });

      // Set some values
      act(() => {
        result.current.setDescription('Test description');
        result.current.setEntityId('entity-123');
      });

      expect(result.current.description).toBe('Test description');
      expect(result.current.entityId).toBe('entity-123');

      // Close dialog
      rerender({ isOpen: false });

      // Reopen dialog - should be reset
      rerender({ isOpen: true });

      expect(result.current.description).toBe('');
      expect(result.current.entityId).toBeNull();
    });
  });

  describe('getFormData', () => {
    it('should return all form data as an object', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setDate('2025-01-15');
        result.current.setDueDate('2025-02-15');
        result.current.setEntityId('entity-123');
        result.current.setEntityName('Test Entity');
        result.current.setDescription('Test description');
        result.current.setReference('REF-001');
        result.current.setProjectId('project-456');
        result.current.setStatus('PENDING_APPROVAL');
      });

      const formData = result.current.getFormData();

      expect(formData).toEqual({
        date: '2025-01-15',
        dueDate: '2025-02-15',
        entityId: 'entity-123',
        entityName: 'Test Entity',
        description: 'Test description',
        reference: 'REF-001',
        projectId: 'project-456',
        status: 'PENDING_APPROVAL',
      });
    });

    it('should return current state even if partially filled', () => {
      const { result } = renderHook(() => useTransactionForm());

      act(() => {
        result.current.setEntityId('entity-123');
        result.current.setDescription('Partial data');
      });

      const formData = result.current.getFormData();

      expect(formData.entityId).toBe('entity-123');
      expect(formData.description).toBe('Partial data');
      expect(formData.reference).toBe('');
      expect(formData.projectId).toBeNull();
    });
  });

  describe('Dialog Open/Close Behavior', () => {
    it('should load initialData when dialog opens', () => {
      const initialData = {
        entityId: 'entity-123',
        description: 'Edit mode',
      };

      const { result, rerender } = renderHook(
        ({ isOpen }) => useTransactionForm({ initialData, isOpen }),
        { initialProps: { isOpen: false } }
      );

      // Initially closed, should have default values
      expect(result.current.entityId).toBeNull();

      // Open dialog
      rerender({ isOpen: true });

      // Should load initial data
      expect(result.current.entityId).toBe('entity-123');
      expect(result.current.description).toBe('Edit mode');
    });

    it('should reset to defaults when opening without initialData', () => {
      const { result, rerender } = renderHook(({ isOpen }) => useTransactionForm({ isOpen }), {
        initialProps: { isOpen: false },
      });

      // Set some values while closed
      act(() => {
        result.current.setEntityId('entity-123');
        result.current.setDescription('Some data');
      });

      // Open dialog without initialData
      rerender({ isOpen: true });

      // Should reset to defaults
      expect(result.current.entityId).toBeNull();
      expect(result.current.description).toBe('');
    });

    it('should reload initialData when it changes', () => {
      const { result, rerender } = renderHook(
        ({ initialData }) =>
          useTransactionForm({
            initialData,
            isOpen: true,
          }),
        {
          initialProps: {
            initialData: { entityId: 'entity-123', description: 'Original' },
          },
        }
      );

      expect(result.current.entityId).toBe('entity-123');
      expect(result.current.description).toBe('Original');

      // Change initialData
      rerender({
        initialData: { entityId: 'entity-456', description: 'Updated' },
      });

      expect(result.current.entityId).toBe('entity-456');
      expect(result.current.description).toBe('Updated');
    });
  });

  describe('Date Conversion Edge Cases', () => {
    it('should handle missing dates in initialData', () => {
      // When dates are not provided, should use defaults
      const initialData = {
        entityId: 'test-entity',
        description: 'Test transaction',
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData,
          isOpen: true,
        })
      );

      const today = new Date().toISOString().split('T')[0];
      expect(result.current.date).toBe(today); // Falls back to today
      expect(result.current.dueDate).toBe('');
      expect(result.current.entityId).toBe('test-entity');
    });

    it('should handle dates already in YYYY-MM-DD format', () => {
      const initialData = {
        date: '2025-06-15',
        dueDate: '2025-07-15',
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData,
          isOpen: true,
        })
      );

      expect(result.current.date).toBe('2025-06-15');
      expect(result.current.dueDate).toBe('2025-07-15');
    });
  });

  describe('Transaction Status Values', () => {
    it('should handle all valid transaction statuses', () => {
      const statuses: TransactionStatus[] = [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'PAID',
      ];

      const { result } = renderHook(() => useTransactionForm());

      statuses.forEach((status) => {
        act(() => {
          result.current.setStatus(status);
        });
        expect(result.current.status).toBe(status);
      });
    });

    it('should default to DRAFT status', () => {
      const { result } = renderHook(() => useTransactionForm());

      expect(result.current.status).toBe('DRAFT');
    });

    it('should preserve status from initialData', () => {
      const initialData = {
        status: 'APPROVED' as TransactionStatus,
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData,
          isOpen: true,
        })
      );

      expect(result.current.status).toBe('APPROVED');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should support creating a new invoice', () => {
      const { result } = renderHook(() =>
        useTransactionForm({
          isOpen: true,
        })
      );

      act(() => {
        result.current.setDate('2025-01-20');
        result.current.setDueDate('2025-02-20');
        result.current.setEntityId('customer-123');
        result.current.setEntityName('ABC Corp');
        result.current.setDescription('Consulting services for Q1 2025');
        result.current.setReference('INV-2025-123');
        result.current.setProjectId('project-consulting');
        result.current.setStatus('DRAFT');
      });

      const formData = result.current.getFormData();

      expect(formData).toEqual({
        date: '2025-01-20',
        dueDate: '2025-02-20',
        entityId: 'customer-123',
        entityName: 'ABC Corp',
        description: 'Consulting services for Q1 2025',
        reference: 'INV-2025-123',
        projectId: 'project-consulting',
        status: 'DRAFT',
      });
    });

    it('should support editing an existing bill', () => {
      const existingBill = {
        date: new Date('2025-01-10'),
        dueDate: new Date('2025-02-10'),
        entityId: 'vendor-456',
        entityName: 'Supplier XYZ',
        description: 'Office supplies',
        reference: 'BILL-2025-045',
        projectId: 'project-office',
        status: 'PENDING_APPROVAL' as TransactionStatus,
      };

      const { result } = renderHook(() =>
        useTransactionForm({
          initialData: existingBill,
          isOpen: true,
        })
      );

      // Verify loaded correctly
      expect(result.current.entityId).toBe('vendor-456');
      expect(result.current.description).toBe('Office supplies');

      // Edit description
      act(() => {
        result.current.setDescription('Office supplies - Updated quantity');
        result.current.setStatus('APPROVED');
      });

      const formData = result.current.getFormData();
      expect(formData.description).toBe('Office supplies - Updated quantity');
      expect(formData.status).toBe('APPROVED');
    });

    it('should support payment recording workflow', () => {
      const { result } = renderHook(() => useTransactionForm({ isOpen: true }));

      act(() => {
        result.current.setDate('2025-01-25');
        result.current.setEntityId('vendor-789');
        result.current.setEntityName('Tech Solutions Ltd');
        result.current.setDescription('Payment for software licenses');
        result.current.setReference('PAY-2025-089');
        result.current.setStatus('PAID');
      });

      const formData = result.current.getFormData();

      expect(formData.status).toBe('PAID');
      expect(formData.reference).toBe('PAY-2025-089');
      expect(formData.description).toContain('software licenses');
    });
  });
});

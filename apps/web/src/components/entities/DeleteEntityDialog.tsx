'use client';

import { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';
import { checkEntityCascadeDelete } from '@/lib/entities/businessEntityService';
import { ConfirmDialog } from '@vapour/ui';

interface DeleteEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteEntityDialog({ open, entity, onClose, onSuccess }: DeleteEntityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cascadeWarning, setCascadeWarning] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!entity?.id) return;

    setLoading(true);
    setError('');
    setCascadeWarning(null);

    try {
      const { db } = getFirebase();

      // Check for cascade delete violations
      const cascadeCheck = await checkEntityCascadeDelete(db, entity.id);

      if (!cascadeCheck.canDelete) {
        setCascadeWarning(cascadeCheck.message);
        setLoading(false);
        return;
      }

      const entityRef = doc(db, COLLECTIONS.ENTITIES, entity.id);

      // Soft delete - mark as inactive
      await updateDoc(entityRef, {
        isActive: false,
        status: 'inactive',
        updatedAt: Timestamp.now(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error deleting entity:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete entity. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Entity"
      message={
        <>
          Are you sure you want to delete <strong>{entity?.name}</strong>?
        </>
      }
      description="This will mark the entity as inactive. The entity and its data will be preserved in the system but will not appear in active lists."
      variant="error"
      confirmLabel="Delete"
      loading={loading}
      error={error}
      warning={cascadeWarning || undefined}
    />
  );
}

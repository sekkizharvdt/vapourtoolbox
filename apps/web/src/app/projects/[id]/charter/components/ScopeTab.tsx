'use client';

import { useState } from 'react';
import { Box, Alert } from '@mui/material';
import type { Project } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProjects } from '@vapour/constants';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { useEditableList } from './scope/useEditableList';
import { EditableListSection } from './scope/EditableListSection';
import { DeliveryPeriodSection } from './scope/DeliveryPeriodSection';
import { ConstraintsSection } from './scope/ConstraintsSection';

interface ScopeTabProps {
  project: Project;
}

export function ScopeTab({ project }: ScopeTabProps) {
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';

  // Editable lists
  const assumptionsHook = useEditableList(project.charter?.scope?.assumptions || []);
  const inScopeHook = useEditableList(project.charter?.scope?.inScope || []);
  const outOfScopeHook = useEditableList(project.charter?.scope?.outOfScope || []);

  // Delivery period data type
  type DeliveryData = {
    startDate: string;
    endDate: string;
    duration: string;
    description: string;
  };

  // Delivery period state
  const [, setDeliveryData] = useState<DeliveryData>({
    startDate: '',
    endDate: '',
    duration: '',
    description: '',
  });

  // Constraints state
  const [constraints, setConstraints] = useState(project.charter?.scope?.constraints || []);

  // Save delivery period to Firestore
  const saveDeliveryPeriod = async (data: DeliveryData) => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      const deliveryPeriod =
        data.startDate || data.endDate || data.duration || data.description
          ? {
              startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
              endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
              duration: data.duration ? parseInt(data.duration, 10) : null,
              description: data.description || null,
            }
          : null;

      await updateDoc(projectRef, {
        'charter.deliveryPeriod': deliveryPeriod,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setDeliveryData(data);
      alert('Delivery period updated successfully');
    } catch (err) {
      console.error('[ScopeTab] Error saving delivery period:', err);
      setError(err instanceof Error ? err.message : 'Failed to save delivery period');
    } finally {
      setLoading(false);
    }
  };

  // Save all scope data to Firestore
  const saveScope = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      await updateDoc(projectRef, {
        'charter.scope.assumptions': assumptionsHook.items,
        'charter.scope.constraints': constraints,
        'charter.scope.inScope': inScopeHook.items,
        'charter.scope.outOfScope': outOfScopeHook.items,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      alert('Scope updated successfully');
    } catch (err) {
      console.error('[ScopeTab] Error saving scope:', err);
      setError(err instanceof Error ? err.message : 'Failed to save scope');
    } finally {
      setLoading(false);
    }
  };

  // Handle constraint changes
  const handleConstraintsChange = (newConstraints: typeof constraints) => {
    setConstraints(newConstraints);
    // Auto-save constraints
    (async () => {
      try {
        const { db } = getFirebase();
        const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);
        await updateDoc(projectRef, {
          'charter.scope.constraints': newConstraints,
          updatedAt: Timestamp.now(),
          updatedBy: userId,
        });
      } catch (err) {
        console.error('[ScopeTab] Error saving constraints:', err);
        setError(err instanceof Error ? err.message : 'Failed to save constraints');
      }
    })();
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <DeliveryPeriodSection
        hasManageAccess={hasManageAccess}
        loading={loading}
        deliveryPeriod={project.charter?.deliveryPeriod}
        onSave={saveDeliveryPeriod}
      />

      <EditableListSection
        title="Assumptions"
        placeholder="Add new assumption..."
        emptyMessage="No assumptions defined yet"
        hasManageAccess={hasManageAccess}
        loading={loading}
        listHook={assumptionsHook}
        onSave={saveScope}
      />

      <ConstraintsSection
        hasManageAccess={hasManageAccess}
        loading={loading}
        constraints={constraints}
        onSave={handleConstraintsChange}
      />

      <EditableListSection
        title="In-Scope Items"
        placeholder="Add in-scope item..."
        emptyMessage="No in-scope items defined yet"
        hasManageAccess={hasManageAccess}
        loading={loading}
        listHook={inScopeHook}
        onSave={saveScope}
      />

      <EditableListSection
        title="Out-of-Scope / Exclusions"
        placeholder="Add exclusion..."
        emptyMessage="No exclusions defined yet"
        hasManageAccess={hasManageAccess}
        loading={loading}
        listHook={outOfScopeHook}
        onSave={saveScope}
      />
    </Box>
  );
}

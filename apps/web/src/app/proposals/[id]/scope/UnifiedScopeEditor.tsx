'use client';

/**
 * Unified Scope Editor Component
 *
 * Main editor for the EPC scope matrix, replacing the old tabbed ScopeMatrixEditor.
 * Organizes scope items into 11 discipline categories, each rendered as a collapsible
 * section with either a CHECKLIST or MATRIX display type. Items have row-level
 * include/exclude toggles and cell-level activity toggles for matrix categories.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as CompleteIcon,
  ArrowForward as ArrowIcon,
  PriceChange as PricingIcon,
} from '@mui/icons-material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { getEnquiryById } from '@/lib/enquiry/enquiryService';
import { Timestamp } from 'firebase/firestore';
import type {
  Proposal,
  UnifiedScopeMatrix,
  UnifiedScopeItem,
  ScopeCategoryKey,
} from '@vapour/types';
import { SCOPE_CATEGORY_ORDER, SCOPE_CATEGORY_DEFAULTS } from '@vapour/types';
import { ScopeCategorySection } from './components/ScopeCategorySection';
import { AddUnifiedScopeItemDialog } from './components/AddUnifiedScopeItemDialog';
import { useToast } from '@/components/common/Toast';

interface UnifiedScopeEditorProps {
  proposalId: string;
}

/**
 * Create a default empty unified scope matrix with all 11 categories
 */
function createDefaultMatrix(): UnifiedScopeMatrix {
  return {
    categories: SCOPE_CATEGORY_ORDER.map((key, index) => ({
      id: crypto.randomUUID(),
      categoryKey: key,
      label: SCOPE_CATEGORY_DEFAULTS[key].label,
      displayType: SCOPE_CATEGORY_DEFAULTS[key].displayType,
      ...(SCOPE_CATEGORY_DEFAULTS[key].activityTemplate && {
        activityTemplate: SCOPE_CATEGORY_DEFAULTS[key].activityTemplate,
      }),
      items: [],
      order: index,
    })),
  };
}

export function UnifiedScopeEditor({ proposalId }: UnifiedScopeEditorProps) {
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [matrix, setMatrix] = useState<UnifiedScopeMatrix>(createDefaultMatrix());
  const [enquiryRequestedScope, setEnquiryRequestedScope] = useState<UnifiedScopeMatrix | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Add item dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogCategoryId, setAddDialogCategoryId] = useState<string | null>(null);

  // Load proposal data
  useEffect(() => {
    if (!db || !proposalId) return;

    const loadProposal = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getProposalById(db, proposalId);
        if (!data) {
          setError('Proposal not found');
          return;
        }

        setProposal(data);

        // Use unifiedScopeMatrix if present, else create default
        if (data.unifiedScopeMatrix) {
          setMatrix(data.unifiedScopeMatrix);
        } else {
          setMatrix(createDefaultMatrix());
        }

        // Look up the parent enquiry's requestedScope (if any) so we can
        // surface a "Pull from SOW" action when items are missing here.
        if (data.enquiryId) {
          try {
            const enq = await getEnquiryById(db, data.enquiryId);
            setEnquiryRequestedScope(enq?.requestedScope ?? null);
          } catch (enqErr) {
            console.warn('Could not load parent enquiry for scope refresh', enqErr);
            setEnquiryRequestedScope(null);
          }
        }
      } catch (err) {
        console.error('Error loading proposal:', err);
        setError('Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [db, proposalId]);

  // Handle opening add item dialog for a category
  const handleOpenAddDialog = useCallback((categoryId: string) => {
    setAddDialogCategoryId(categoryId);
    setAddDialogOpen(true);
  }, []);

  // Handle adding a new item to a category
  const handleAddItem = useCallback((categoryId: string, newItem: UnifiedScopeItem) => {
    setMatrix((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === categoryId ? { ...cat, items: [...cat.items, newItem] } : cat
      ),
    }));
    setHasChanges(true);
  }, []);

  // Handle updating an item within a category. If `targetCategoryKey` is
  // supplied and differs from the source's categoryKey, the item is moved:
  // removed from the source category and re-numbered into the destination.
  const handleUpdateItem = useCallback(
    (categoryId: string, updatedItem: UnifiedScopeItem, targetCategoryKey?: ScopeCategoryKey) => {
      setMatrix((prev) => {
        const sourceCat = prev.categories.find((c) => c.id === categoryId);
        if (!sourceCat) return prev;
        const isMoving = !!targetCategoryKey && targetCategoryKey !== sourceCat.categoryKey;

        if (!isMoving) {
          return {
            ...prev,
            categories: prev.categories.map((cat) =>
              cat.id === categoryId
                ? {
                    ...cat,
                    items: cat.items.map((item) =>
                      item.id === updatedItem.id ? updatedItem : item
                    ),
                  }
                : cat
            ),
          };
        }

        const targetCat = prev.categories.find((c) => c.categoryKey === targetCategoryKey);
        if (!targetCat) return prev;

        return {
          ...prev,
          categories: prev.categories.map((cat) => {
            if (cat.id === categoryId) {
              return { ...cat, items: cat.items.filter((i) => i.id !== updatedItem.id) };
            }
            if (cat.id === targetCat.id) {
              const movedItem: UnifiedScopeItem = {
                ...updatedItem,
                order: cat.items.length,
                itemNumber: `${(cat.order ?? 0) + 1}.${cat.items.length + 1}`,
              };
              return { ...cat, items: [...cat.items, movedItem] };
            }
            return cat;
          }),
        };
      });
      setHasChanges(true);
    },
    []
  );

  // Handle deleting an item from a category
  const handleDeleteItem = useCallback((categoryId: string, itemId: string) => {
    setMatrix((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === categoryId
          ? { ...cat, items: cat.items.filter((item) => item.id !== itemId) }
          : cat
      ),
    }));
    setHasChanges(true);
  }, []);

  // Save scope matrix
  const handleSave = async (markComplete = false) => {
    if (!db || !user || !proposal) return;

    try {
      setSaving(true);
      setError(null);

      const updatedMatrix: UnifiedScopeMatrix = {
        ...matrix,
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedBy: user.uid,
        isComplete: markComplete ? true : matrix.isComplete,
      };

      await updateProposal(
        db,
        proposalId,
        { unifiedScopeMatrix: updatedMatrix },
        user.uid,
        claims?.permissions ?? 0
      );

      setMatrix(updatedMatrix);
      setHasChanges(false);
      toast.success(
        markComplete ? 'Scope marked as complete! Continue to pricing.' : 'Scope saved successfully'
      );

      if (markComplete) {
        router.push(`/proposals/${proposalId}/pricing`);
      }
    } catch (err) {
      console.error('Error saving scope matrix:', err);
      setError('Failed to save scope matrix');
      toast.error('Failed to save scope matrix');
    } finally {
      setSaving(false);
    }
  };

  // Count how many items live on the parent enquiry's requestedScope but
  // aren't yet on this proposal's matrix. Drives the "Pull from SOW" banner.
  const itemsAvailableFromEnquiry = (() => {
    if (!enquiryRequestedScope) return 0;
    let count = 0;
    for (const enquiryCat of enquiryRequestedScope.categories) {
      const matrixCat = matrix.categories.find((c) => c.categoryKey === enquiryCat.categoryKey);
      if (!matrixCat) {
        count += enquiryCat.items.length;
        continue;
      }
      const existingNames = new Set(matrixCat.items.map((i) => i.name.trim().toLowerCase()));
      for (const item of enquiryCat.items) {
        if (!existingNames.has(item.name.trim().toLowerCase())) count += 1;
      }
    }
    return count;
  })();

  const handlePullFromEnquiry = useCallback(() => {
    if (!enquiryRequestedScope) return;
    setMatrix((prev) => {
      const next = prev.categories.map((cat) => {
        const enquiryCat = enquiryRequestedScope.categories.find(
          (c) => c.categoryKey === cat.categoryKey
        );
        if (!enquiryCat) return cat;
        const existingNames = new Set(cat.items.map((i) => i.name.trim().toLowerCase()));
        const newItems: UnifiedScopeItem[] = enquiryCat.items
          .filter((it) => !existingNames.has(it.name.trim().toLowerCase()))
          .map((it, idx) => ({
            ...it,
            id: crypto.randomUUID(),
            itemNumber: `${(cat.order ?? 0) + 1}.${cat.items.length + idx + 1}`,
            order: cat.items.length + idx,
            included: true,
            source: 'AI_PARSED' as const,
          }));
        return newItems.length > 0 ? { ...cat, items: [...cat.items, ...newItems] } : cat;
      });
      return { ...prev, categories: next };
    });
    setHasChanges(true);
    toast.success(`Pulled ${itemsAvailableFromEnquiry} items from the enquiry SOW.`);
  }, [enquiryRequestedScope, itemsAvailableFromEnquiry, toast]);

  // Compute summary stats
  const totalItems = matrix.categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const includedItems = matrix.categories.reduce(
    (sum, cat) => sum + cat.items.filter((i) => i.included).length,
    0
  );
  const excludedItems = totalItems - includedItems;
  const serviceItems = matrix.categories.reduce(
    (sum, cat) =>
      sum + cat.items.filter((i) => i.included && i.classification === 'SERVICE').length,
    0
  );
  const supplyItems = matrix.categories.reduce(
    (sum, cat) => sum + cat.items.filter((i) => i.included && i.classification === 'SUPPLY').length,
    0
  );

  // Find the category for the add dialog
  const addDialogCategory = matrix.categories.find((c) => c.id === addDialogCategoryId) || null;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !proposal) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!proposal) {
    return <Alert severity="error">Proposal not found</Alert>;
  }

  return (
    <Box>
      {/* Proposal Info Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">{proposal.proposalNumber}</Typography>
            <Typography variant="body2" color="text.secondary">
              {proposal.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Client: {proposal.clientName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {matrix.isComplete && (
              <Chip icon={<CompleteIcon />} label="Scope Complete" color="success" size="small" />
            )}
            <Chip label={`${totalItems} items`} variant="outlined" size="small" />
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Pull-from-enquiry banner — visible when the parent enquiry's SOW has
          items that aren't on this proposal yet (e.g. proposal was created
          before the SOW was AI-parsed). */}
      {itemsAvailableFromEnquiry > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="primary" size="small" onClick={handlePullFromEnquiry}>
              Pull from SOW
            </Button>
          }
        >
          {itemsAvailableFromEnquiry} scope item{itemsAvailableFromEnquiry === 1 ? '' : 's'} from
          the enquiry SOW {itemsAvailableFromEnquiry === 1 ? 'is' : 'are'} not yet in this
          proposal&apos;s scope.
        </Alert>
      )}

      {/* Category Sections */}
      {matrix.categories.map((category) => (
        <ScopeCategorySection
          key={category.id}
          category={category}
          allCategories={matrix.categories.map((c) => ({
            categoryKey: c.categoryKey,
            label: c.label,
          }))}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onAddItem={handleOpenAddDialog}
        />
      ))}

      {/* Summary Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="subtitle2">Summary:</Typography>
          <Chip label={`${includedItems} included`} color="success" size="small" />
          {excludedItems > 0 && (
            <Chip label={`${excludedItems} excluded`} color="default" size="small" />
          )}
          <Divider orientation="vertical" flexItem />
          <Chip
            label={`${serviceItems} services`}
            color="primary"
            variant="outlined"
            size="small"
          />
          <Chip label={`${supplyItems} supply`} color="secondary" variant="outlined" size="small" />
        </Box>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => router.push(`/proposals/${proposalId}`)}
          disabled={saving}
        >
          Back to Proposal
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={() => handleSave(false)}
          loading={saving}
          disabled={!hasChanges}
        >
          Save Draft
        </LoadingButton>
        {matrix.isComplete ? (
          <Button
            variant="contained"
            color="success"
            startIcon={<PricingIcon />}
            endIcon={<ArrowIcon />}
            onClick={() => router.push(`/proposals/${proposalId}/pricing`)}
          >
            Continue to Pricing
          </Button>
        ) : (
          <LoadingButton
            variant="contained"
            color="success"
            startIcon={<CompleteIcon />}
            onClick={() => handleSave(true)}
            loading={saving}
            disabled={totalItems === 0}
          >
            Mark Complete
          </LoadingButton>
        )}
      </Box>

      {/* Add Item Dialog */}
      <AddUnifiedScopeItemDialog
        open={addDialogOpen}
        category={addDialogCategory}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddItem}
      />
    </Box>
  );
}

'use client';

/**
 * Scope Matrix Editor Component
 *
 * A tabbed interface for editing services, supply, and exclusions.
 * Organized by project phases with drag-and-drop reordering.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as CompleteIcon,
  Add as AddIcon,
  Engineering as ServiceIcon,
  LocalShipping as SupplyIcon,
  Block as ExclusionIcon,
} from '@mui/icons-material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import type {
  Proposal,
  ScopeMatrix,
  ScopeItem,
  ScopeItemType,
} from '@vapour/types';
import { ScopeItemList } from './components/ScopeItemList';
import { AddScopeItemDialog } from './components/AddScopeItemDialog';
import { useToast } from '@/components/common/Toast';

interface ScopeMatrixEditorProps {
  proposalId: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`scope-tabpanel-${index}`}
      aria-labelledby={`scope-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export function ScopeMatrixEditor({ proposalId }: ScopeMatrixEditorProps) {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [scopeMatrix, setScopeMatrix] = useState<ScopeMatrix>({
    services: [],
    supply: [],
    exclusions: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addItemType, setAddItemType] = useState<ScopeItemType>('SERVICE');

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

        // Initialize scope matrix from proposal or create empty
        if (data.scopeMatrix) {
          setScopeMatrix(data.scopeMatrix);
        } else {
          setScopeMatrix({
            services: [],
            supply: [],
            exclusions: [],
          });
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

  // Handle adding a new item
  const handleAddItem = (type: ScopeItemType) => {
    setAddItemType(type);
    setAddDialogOpen(true);
  };

  // Handle item added from dialog
  const handleItemAdded = (newItem: ScopeItem) => {
    setScopeMatrix((prev) => {
      const key = newItem.type === 'SERVICE' ? 'services' : newItem.type === 'SUPPLY' ? 'supply' : 'exclusions';
      return {
        ...prev,
        [key]: [...prev[key], newItem],
      };
    });
    setHasChanges(true);
    setAddDialogOpen(false);
  };

  // Handle updating an item
  const handleUpdateItem = useCallback((updatedItem: ScopeItem) => {
    setScopeMatrix((prev) => {
      const key = updatedItem.type === 'SERVICE' ? 'services' : updatedItem.type === 'SUPPLY' ? 'supply' : 'exclusions';
      return {
        ...prev,
        [key]: prev[key].map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      };
    });
    setHasChanges(true);
  }, []);

  // Handle deleting an item
  const handleDeleteItem = useCallback((itemId: string, type: ScopeItemType) => {
    setScopeMatrix((prev) => {
      const key = type === 'SERVICE' ? 'services' : type === 'SUPPLY' ? 'supply' : 'exclusions';
      return {
        ...prev,
        [key]: prev[key].filter((item) => item.id !== itemId),
      };
    });
    setHasChanges(true);
  }, []);

  // Handle reordering items
  const handleReorderItems = useCallback((type: ScopeItemType, items: ScopeItem[]) => {
    setScopeMatrix((prev) => {
      const key = type === 'SERVICE' ? 'services' : type === 'SUPPLY' ? 'supply' : 'exclusions';
      return {
        ...prev,
        [key]: items,
      };
    });
    setHasChanges(true);
  }, []);

  // Save scope matrix
  const handleSave = async (markComplete = false) => {
    if (!db || !user || !proposal) return;

    try {
      setSaving(true);
      setError(null);

      const updatedMatrix: ScopeMatrix = {
        ...scopeMatrix,
        lastUpdatedAt: new Date() as unknown as import('firebase/firestore').Timestamp,
        lastUpdatedBy: user.uid,
        isComplete: markComplete ? true : scopeMatrix.isComplete,
      };

      await updateProposal(db, proposalId, { scopeMatrix: updatedMatrix }, user.uid);

      setScopeMatrix(updatedMatrix);
      setHasChanges(false);
      toast.success(markComplete ? 'Scope marked as complete' : 'Scope saved successfully');

      if (markComplete) {
        router.push('/proposals/scope-matrix');
      }
    } catch (err) {
      console.error('Error saving scope matrix:', err);
      setError('Failed to save scope matrix');
      toast.error('Failed to save scope matrix');
    } finally {
      setSaving(false);
    }
  };

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
    return (
      <Alert severity="error">
        Proposal not found
      </Alert>
    );
  }

  const totalItems = scopeMatrix.services.length + scopeMatrix.supply.length + scopeMatrix.exclusions.length;

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
            {scopeMatrix.isComplete && (
              <Chip
                icon={<CompleteIcon />}
                label="Scope Complete"
                color="success"
                size="small"
              />
            )}
            <Chip
              label={`${totalItems} items`}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="scope matrix tabs"
          >
            <Tab
              icon={<ServiceIcon />}
              iconPosition="start"
              label={`Services (${scopeMatrix.services.length})`}
            />
            <Tab
              icon={<SupplyIcon />}
              iconPosition="start"
              label={`Supply (${scopeMatrix.supply.length})`}
            />
            <Tab
              icon={<ExclusionIcon />}
              iconPosition="start"
              label={`Exclusions (${scopeMatrix.exclusions.length})`}
            />
          </Tabs>
        </Box>

        {/* Services Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Services - Work performed by VDT
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleAddItem('SERVICE')}
                size="small"
              >
                Add Service
              </Button>
            </Box>
            <ScopeItemList
              items={scopeMatrix.services}
              type="SERVICE"
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
              onReorder={(items) => handleReorderItems('SERVICE', items)}
              allItems={[...scopeMatrix.services, ...scopeMatrix.supply]}
            />
          </Box>
        </TabPanel>

        {/* Supply Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Supply - Physical items delivered
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleAddItem('SUPPLY')}
                size="small"
              >
                Add Supply Item
              </Button>
            </Box>
            <ScopeItemList
              items={scopeMatrix.supply}
              type="SUPPLY"
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
              onReorder={(items) => handleReorderItems('SUPPLY', items)}
              allItems={[...scopeMatrix.services, ...scopeMatrix.supply]}
            />
          </Box>
        </TabPanel>

        {/* Exclusions Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Exclusions - Items explicitly NOT included
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleAddItem('EXCLUSION')}
                size="small"
              >
                Add Exclusion
              </Button>
            </Box>
            <ScopeItemList
              items={scopeMatrix.exclusions}
              type="EXCLUSION"
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
              onReorder={(items) => handleReorderItems('EXCLUSION', items)}
              allItems={[...scopeMatrix.services, ...scopeMatrix.supply]}
            />
          </Box>
        </TabPanel>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => router.push('/proposals/scope-matrix')}
          disabled={saving}
        >
          Cancel
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
      </Box>

      {/* Add Item Dialog */}
      <AddScopeItemDialog
        open={addDialogOpen}
        type={addItemType}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleItemAdded}
        existingItems={[...scopeMatrix.services, ...scopeMatrix.supply, ...scopeMatrix.exclusions]}
      />
    </Box>
  );
}

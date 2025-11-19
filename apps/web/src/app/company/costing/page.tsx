'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';
import {
  CostConfiguration,
  DEFAULT_OVERHEAD_CONFIG,
  DEFAULT_CONTINGENCY_CONFIG,
  DEFAULT_PROFIT_CONFIG,
} from '@vapour/types';
import {
  getActiveCostConfiguration,
  createCostConfiguration,
  updateCostConfiguration,
} from '@/lib/bom/costConfig';
import CostConfigForm from '@/components/company/CostConfigForm';
import { Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';

export default function CostingSettingsPage() {
  const { user, claims } = useAuth();
  const { db } = getFirebase();
  const [activeConfig, setActiveConfig] = useState<CostConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Check if user has MANAGE_COMPANY_SETTINGS permission
  const canManageSettings = claims?.permissions
    ? hasPermission(claims.permissions, PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS)
    : false;

  // Single-tenant: Use 'company' as entityId
  const entityId = 'company';

  useEffect(() => {
    loadActiveConfig();
  }, []);

  const loadActiveConfig = async () => {
    try {
      setLoading(true);
      const config = await getActiveCostConfiguration(db, entityId);
      setActiveConfig(config);
    } catch (error) {
      console.error('Error loading cost configuration:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load cost configuration',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: {
    overhead: CostConfiguration['overhead'];
    contingency: CostConfiguration['contingency'];
    profit: CostConfiguration['profit'];
    name?: string;
    description?: string;
  }) => {
    if (!user) return;

    try {
      if (activeConfig) {
        // Update existing configuration
        await updateCostConfiguration(
          db,
          activeConfig.id,
          {
            overhead: data.overhead,
            contingency: data.contingency,
            profit: data.profit,
            name: data.name,
            description: data.description,
          },
          user.uid
        );
      } else {
        // Create new configuration
        await createCostConfiguration(
          db,
          {
            entityId,
            overhead: data.overhead,
            contingency: data.contingency,
            profit: data.profit,
            name: data.name,
            description: data.description,
          },
          user.uid
        );
      }

      setSnackbar({
        open: true,
        message: 'Cost configuration saved successfully',
        severity: 'success',
      });

      setEditMode(false);
      loadActiveConfig();
    } catch (error) {
      console.error('Error saving cost configuration:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save cost configuration',
        severity: 'error',
      });
    }
  };

  const handleCancel = () => {
    setEditMode(false);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!canManageSettings) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">
          You do not have permission to manage company costing settings.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Costing Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure overhead, contingency, and profit margins for BOM cost calculations
          </Typography>
        </Box>
        {!editMode && (
          <Button
            variant="outlined"
            startIcon={activeConfig ? <EditIcon /> : <AddIcon />}
            onClick={() => setEditMode(true)}
          >
            {activeConfig ? 'Edit Configuration' : 'Create Configuration'}
          </Button>
        )}
      </Box>

      {editMode ? (
        <CostConfigForm
          initialData={
            activeConfig || {
              overhead: DEFAULT_OVERHEAD_CONFIG,
              contingency: DEFAULT_CONTINGENCY_CONFIG,
              profit: DEFAULT_PROFIT_CONFIG,
            }
          }
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : activeConfig ? (
        <Card>
          <CardContent>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Current Configuration
              </Typography>
              {activeConfig.name && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {activeConfig.name}
                </Typography>
              )}
              {activeConfig.description && (
                <Typography variant="body2" color="text.secondary">
                  {activeConfig.description}
                </Typography>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Overhead
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: <strong>{activeConfig.overhead.enabled ? 'Enabled' : 'Disabled'}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rate: <strong>{activeConfig.overhead.ratePercent}%</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Applied to: <strong>{activeConfig.overhead.applicableTo}</strong>
              </Typography>
              {activeConfig.overhead.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {activeConfig.overhead.description}
                </Typography>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Contingency
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: <strong>{activeConfig.contingency.enabled ? 'Enabled' : 'Disabled'}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rate: <strong>{activeConfig.contingency.ratePercent}%</strong>
              </Typography>
              {activeConfig.contingency.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {activeConfig.contingency.description}
                </Typography>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Profit
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: <strong>{activeConfig.profit.enabled ? 'Enabled' : 'Disabled'}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rate: <strong>{activeConfig.profit.ratePercent}%</strong>
              </Typography>
              {activeConfig.profit.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {activeConfig.profit.description}
                </Typography>
              )}
            </Box>

            <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Last updated: {activeConfig.updatedAt.toDate().toLocaleString()}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          No cost configuration found. Click &quot;Create Configuration&quot; to set up overhead,
          contingency, and profit margins.
        </Alert>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

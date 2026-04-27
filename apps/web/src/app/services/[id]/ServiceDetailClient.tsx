'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Chip,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { SERVICE_CATEGORY_LABELS, SERVICE_CALCULATION_METHOD_LABELS } from '@vapour/types';
import type { Service } from '@vapour/types';
import { getServiceById, deleteService } from '@/lib/services/crud';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value || '-'}</Typography>
    </Grid>
  );
}

export default function ServiceDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { db } = getFirebase();

  // Static export: useParams() returns the placeholder; parse the real id from the path.
  const [serviceId, setServiceId] = useState<string | null>(null);
  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/services\/([^/]+)(?:\/|$)/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') {
      setServiceId(extracted);
    }
  }, [pathname]);

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    async function load() {
      if (!db || !serviceId) return;
      try {
        const result = await getServiceById(db, serviceId);
        setService(result);
      } catch (error) {
        console.error('Error loading service:', error);
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to load service. You may not have permission to view this item.'
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [db, serviceId]);

  const handleDelete = async () => {
    if (!db || !user?.uid || !serviceId) return;
    setDeleting(true);
    try {
      await deleteService(db, serviceId, user.uid);
      setSnackbar({ open: true, message: 'Service deleted' });
      router.push('/services');
    } catch (error) {
      console.error('Error deleting service:', error);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!service) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">{loadError || 'Service not found'}</Typography>
        {loadError && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {loadError}
          </Typography>
        )}
        <Button onClick={() => router.push('/services')} sx={{ mt: 2 }}>
          Back to Services
        </Button>
      </Box>
    );
  }

  const isPercentage =
    service.calculationMethod === 'PERCENTAGE_OF_MATERIAL' ||
    service.calculationMethod === 'PERCENTAGE_OF_TOTAL';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/services')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" component="h1">
              {service.name}
            </Typography>
            <Chip
              label={service.serviceCode}
              size="small"
              variant="outlined"
              sx={{ fontFamily: 'monospace' }}
            />
            {!service.isActive && <Chip label="Inactive" size="small" color="error" />}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {SERVICE_CATEGORY_LABELS[service.category]}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => router.push(`/services/${serviceId}/edit`)}
        >
          Edit
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </Box>

      {/* Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Service Details
        </Typography>
        <Grid container spacing={2}>
          <DetailRow label="Service Code" value={service.serviceCode} />
          <DetailRow label="Category" value={SERVICE_CATEGORY_LABELS[service.category]} />
          <DetailRow label="Standard Service" value={service.isStandard ? 'Yes' : 'No'} />
          <Grid size={12}>
            <Typography variant="caption" color="text.secondary">
              Description
            </Typography>
            <Typography variant="body1">{service.description || '-'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Costing
        </Typography>
        <Grid container spacing={2}>
          <DetailRow
            label="Calculation Method"
            value={SERVICE_CALCULATION_METHOD_LABELS[service.calculationMethod]}
          />
          <DetailRow
            label="Default Rate"
            value={
              service.defaultRateValue != null
                ? isPercentage
                  ? `${service.defaultRateValue}%`
                  : `${service.defaultCurrency ?? 'INR'} ${service.defaultRateValue.toLocaleString('en-IN')}`
                : '-'
            }
          />
        </Grid>
      </Paper>

      {/* Procurement Details */}
      {(service.unit ||
        service.estimatedTurnaroundDays ||
        service.testMethodStandard ||
        service.sampleRequirements ||
        service.requiredAccreditations?.length ||
        service.deliverables?.length) && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Procurement Details
          </Typography>
          <Grid container spacing={2}>
            {service.unit && <DetailRow label="Unit" value={service.unit} />}
            {service.estimatedTurnaroundDays != null && (
              <DetailRow
                label="Estimated Turnaround"
                value={`${service.estimatedTurnaroundDays} days`}
              />
            )}
            {service.testMethodStandard && (
              <DetailRow label="Test Method / Standard" value={service.testMethodStandard} />
            )}
            {service.sampleRequirements && (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Sample Requirements
                </Typography>
                <Typography variant="body1">{service.sampleRequirements}</Typography>
              </Grid>
            )}
            {service.requiredAccreditations?.length ? (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Required Accreditations
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {service.requiredAccreditations.map((acc) => (
                    <Chip key={acc} label={acc} size="small" color="info" variant="outlined" />
                  ))}
                </Box>
              </Grid>
            ) : null}
            {service.deliverables?.length ? (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Deliverables
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {service.deliverables.map((d) => (
                    <Chip key={d} label={d} size="small" variant="outlined" />
                  ))}
                </Box>
              </Grid>
            ) : null}
          </Grid>
        </Paper>
      )}

      {(service.applicableToCategories?.length ||
        service.applicableToItemTypes?.length ||
        service.applicableToComponentTypes?.length) && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Applicability Rules
          </Typography>
          <Grid container spacing={2}>
            {service.applicableToCategories?.length ? (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Applicable to BOM Categories
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {service.applicableToCategories.map((cat) => (
                    <Chip key={cat} label={cat} size="small" />
                  ))}
                </Box>
              </Grid>
            ) : null}
            {service.applicableToItemTypes?.length ? (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Applicable to Item Types
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {service.applicableToItemTypes.map((t) => (
                    <Chip key={t} label={t} size="small" />
                  ))}
                </Box>
              </Grid>
            ) : null}
          </Grid>
        </Paper>
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Service</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{service.name}&rdquo;? This will deactivate the
            service. It can be restored later.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}

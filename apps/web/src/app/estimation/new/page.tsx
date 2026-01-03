'use client';

import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { ArrowBack as BackIcon, Save as SaveIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { createBOM } from '@/lib/bom/bomService';
import { createLogger } from '@vapour/logger';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import type { BOMCategory, CreateBOMInput } from '@vapour/types';

const logger = createLogger({ context: 'NewBOMPage' });

// Fallback entity ID for users without entity assignment
const FALLBACK_ENTITY_ID = 'default-entity';

// Category options
const categories: { value: BOMCategory; label: string }[] = [
  { value: 'HEAT_EXCHANGER' as BOMCategory, label: 'Heat Exchanger' },
  { value: 'PRESSURE_VESSEL' as BOMCategory, label: 'Pressure Vessel' },
  { value: 'STORAGE_TANK' as BOMCategory, label: 'Storage Tank' },
  { value: 'PIPING_ASSEMBLY' as BOMCategory, label: 'Piping Assembly' },
  { value: 'PUMP_PACKAGE' as BOMCategory, label: 'Pump Package' },
  { value: 'STRUCTURE' as BOMCategory, label: 'Structure' },
  { value: 'ELECTRICAL' as BOMCategory, label: 'Electrical' },
  { value: 'INSTRUMENTATION_PACKAGE' as BOMCategory, label: 'Instrumentation Package' },
  { value: 'HVAC' as BOMCategory, label: 'HVAC' },
  { value: 'GENERAL_EQUIPMENT' as BOMCategory, label: 'General Equipment' },
  { value: 'OTHER' as BOMCategory, label: 'Other' },
];

export default function NewBOMPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db } = getFirebase();

  // Get entity ID from claims or use fallback
  const entityId = claims?.entityId || FALLBACK_ENTITY_ID;

  const [formData, setFormData] = useState<Omit<CreateBOMInput, 'entityId'>>({
    name: '',
    description: '',
    category: 'HEAT_EXCHANGER' as BOMCategory,
    projectId: '',
    projectName: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.uid || !db) {
      setError('User not authenticated');
      return;
    }

    if (!formData.name.trim()) {
      setError('BOM name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const input: CreateBOMInput = {
        ...formData,
        entityId,
      };

      const bom = await createBOM(db, input, user.uid);
      logger.info('BOM created', { bomId: bom.id, bomCode: bom.bomCode });

      // Navigate to BOM editor
      router.push(`/estimation/${bom.id}`);
    } catch (err) {
      logger.error('Error creating BOM', { error: err });
      setError('Failed to create BOM. Please try again.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/estimation');
  };

  return (
    <Container maxWidth="md">
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/estimation"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/estimation');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Estimation
        </Link>
        <Typography color="text.primary">New BOM</Typography>
      </Breadcrumbs>
      <Box sx={{ mb: 4 }}>
        <Button startIcon={<BackIcon />} onClick={handleCancel} sx={{ mb: 2 }}>
          Back to BOMs
        </Button>

        <Typography variant="h4" component="h1" gutterBottom>
          New Bill of Materials
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create a new BOM to start adding items and calculating costs
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            <TextField
              label="BOM Name"
              required
              fullWidth
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              helperText="Example: Shell & Tube Heat Exchanger HX-101"
              disabled={loading}
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              helperText="Optional: Brief description of the equipment"
              disabled={loading}
            />

            <TextField
              label="Category"
              select
              required
              fullWidth
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value as BOMCategory)}
              helperText="Select the equipment type"
              disabled={loading}
            >
              {categories.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </TextField>

            <ProjectSelector
              value={formData.projectId || null}
              onChange={(projectId, projectName) => {
                setFormData((prev) => ({
                  ...prev,
                  projectId: projectId || '',
                  projectName: projectName || '',
                }));
              }}
              disabled={loading}
            />

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button variant="outlined" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create BOM'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

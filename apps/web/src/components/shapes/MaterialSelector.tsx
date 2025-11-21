'use client';

import { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Chip,
  Stack,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase/clientApp';
import { queryMaterials } from '@/lib/materials/materialService';
import type { Material, MaterialCategory } from '@vapour/types';

interface MaterialSelectorProps {
  allowedCategories: string[];
  onMaterialSelect: (material: Material) => void;
}

export default function MaterialSelector({
  allowedCategories,
  onMaterialSelect,
}: MaterialSelectorProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedCategories]);

  const loadMaterials = async () => {
    setLoading(true);
    setError(null);
    try {
      // Initialize Firestore
      const db = getFirestore(firebaseApp);

      // Load materials for each allowed category directly from Firestore
      const promises = allowedCategories.map((category) =>
        queryMaterials(db, {
          categories: [category as MaterialCategory],
          isActive: true,
          limitResults: 10,
          sortField: 'name',
          sortDirection: 'asc',
        })
      );

      const results = await Promise.all(promises);
      const allMaterials = results.flatMap((result) => result.materials || []);

      setMaterials(allMaterials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (materials.length === 0) {
    return <Alert severity="info">No compatible materials found</Alert>;
  }

  return (
    <Grid container spacing={2}>
      {materials.map((material) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={material.id}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h6" component="h3" gutterBottom>
                {material.name}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {material.description}
              </Typography>

              <Stack spacing={1}>
                {material.specification?.grade && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Grade:
                    </Typography>
                    <Typography variant="body2">{material.specification.grade}</Typography>
                  </Box>
                )}

                {material.properties?.density && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Density:
                    </Typography>
                    <Typography variant="body2">{material.properties.density} kg/m³</Typography>
                  </Box>
                )}

                {material.currentPrice?.pricePerUnit?.amount && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Price:
                    </Typography>
                    <Typography variant="body2">
                      ₹{material.currentPrice.pricePerUnit.amount.toFixed(2)}/kg
                    </Typography>
                  </Box>
                )}
              </Stack>

              <Stack direction="row" spacing={0.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
                <Chip label={material.category} size="small" color="primary" />
                {material.isStandard && <Chip label="Standard" size="small" variant="outlined" />}
              </Stack>
            </CardContent>

            <CardActions>
              <Button variant="contained" onClick={() => onMaterialSelect(material)} fullWidth>
                Select Material
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

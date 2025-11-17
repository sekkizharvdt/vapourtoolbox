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
import { Star as StandardIcon, Science as CustomIcon } from '@mui/icons-material';

interface ShapeSelectorProps {
  category: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onShapeSelect: (shape: any) => void;
}

export default function ShapeSelector({ category, onShapeSelect }: ShapeSelectorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shapes, setShapes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShapes();
  }, [category]);

  const loadShapes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shapes/list?category=${category}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load shapes');
      }

      setShapes(data.shapes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shapes');
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

  if (shapes.length === 0) {
    return <Alert severity="info">No shapes available in this category</Alert>;
  }

  return (
    <Grid container spacing={2}>
      {shapes.map((shape) => (
        <Grid size={{ xs: 12, sm: 6 }} key={shape.id}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                {shape.isStandard ? (
                  <Chip icon={<StandardIcon />} label="Standard" size="small" color="primary" />
                ) : (
                  <Chip icon={<CustomIcon />} label="Custom" size="small" color="secondary" />
                )}
                {shape.usageCount > 0 && (
                  <Chip label={`Used ${shape.usageCount}×`} size="small" variant="outlined" />
                )}
              </Stack>

              <Typography variant="h6" component="h3" gutterBottom>
                {shape.name}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {shape.description}
              </Typography>

              {shape.standard && (
                <Typography variant="caption" color="text.secondary">
                  {shape.standard.standardBody} {shape.standard.standardNumber}
                </Typography>
              )}

              <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {shape.tags?.slice(0, 3).map((tag: string) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Stack>
            </CardContent>

            <CardActions>
              <Button variant="contained" onClick={() => onShapeSelect(shape)} fullWidth>
                Select Shape
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

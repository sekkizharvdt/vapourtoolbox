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
  Alert,
} from '@mui/material';
import { Star as StandardIcon, Science as CustomIcon } from '@mui/icons-material';
import { getShapesByCategory } from '@/lib/shapes/shapeData';
import type { Shape } from '@vapour/types';

interface ShapeSelectorProps {
  category: string;
  onShapeSelect: (shape: Shape) => void;
}

export default function ShapeSelector({ category, onShapeSelect }: ShapeSelectorProps) {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    // Load shapes directly from client-side data
    const categoryShapes = getShapesByCategory(category);
    setShapes(categoryShapes);
  }, [category]);

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
                {shape.standard ? (
                  <Chip icon={<StandardIcon />} label="Standard" size="small" color="primary" />
                ) : (
                  <Chip icon={<CustomIcon />} label="Custom" size="small" color="secondary" />
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

              {shape.tags && shape.tags.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                  {shape.tags.slice(0, 3).map((tag: string) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              )}
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

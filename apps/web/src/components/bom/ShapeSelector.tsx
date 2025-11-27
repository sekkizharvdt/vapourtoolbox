'use client';

/**
 * ShapeSelector Component
 *
 * Allows users to select a shape from the shape database for fabricated items
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Autocomplete,
  Paper,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import { Shape, ShapeCategory, SHAPE_CATEGORY_LABELS } from '@vapour/types';
import { getAllShapes, getAvailableCategories } from '@/lib/shapes/shapeData';

// Category display names
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  plates: 'Plates & Sheets',
  tubes: 'Tubes',
  vessels: 'Pressure Vessel Components',
  heatExchangers: 'Heat Exchanger Components',
  nozzles: 'Nozzles & Connections',
};

interface ShapeSelectorProps {
  value: string | null;
  onChange: (shapeId: string | null, shape: Shape | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export default function ShapeSelector({
  value,
  onChange,
  label = 'Select Shape',
  required = false,
  disabled = false,
  error,
}: ShapeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);

  // Get available categories
  const categories = useMemo(() => getAvailableCategories(), []);

  // Load all shapes
  useEffect(() => {
    const allShapes = getAllShapes();
    setShapes(allShapes);

    // If value is provided, find and select the shape
    if (value) {
      const shape = allShapes.find((s) => s.id === value);
      if (shape) {
        setSelectedShape(shape);
        // Find which category this shape belongs to
        for (const cat of categories) {
          const catShapes = allShapes.filter((s) => {
            const catMap: Record<string, ShapeCategory[]> = {
              plates: [
                ShapeCategory.PLATE_RECTANGULAR,
                ShapeCategory.PLATE_CIRCULAR,
                ShapeCategory.PLATE_CUSTOM,
              ],
              tubes: [ShapeCategory.TUBE_STRAIGHT],
              vessels: [
                ShapeCategory.SHELL_CYLINDRICAL,
                ShapeCategory.SHELL_CONICAL,
                ShapeCategory.HEAD_HEMISPHERICAL,
                ShapeCategory.HEAD_ELLIPSOIDAL,
                ShapeCategory.HEAD_TORISPHERICAL,
                ShapeCategory.HEAD_FLAT,
                ShapeCategory.HEAD_CONICAL,
              ],
              heatExchangers: [
                ShapeCategory.HX_TUBE_BUNDLE,
                ShapeCategory.HX_TUBE_SHEET,
                ShapeCategory.HX_BAFFLE,
                ShapeCategory.HX_TUBE_SUPPORT,
              ],
              nozzles: [
                ShapeCategory.NOZZLE_ASSEMBLY,
                ShapeCategory.NOZZLE_CUSTOM_CIRCULAR,
                ShapeCategory.NOZZLE_CUSTOM_RECTANGULAR,
                ShapeCategory.MANWAY_ASSEMBLY,
                ShapeCategory.REINFORCEMENT_PAD,
              ],
            };
            return catMap[cat]?.includes(s.category);
          });
          if (catShapes.some((s) => s.id === value)) {
            setSelectedCategory(cat);
            break;
          }
        }
      }
    }
  }, [value, categories]);

  // Filter shapes by selected category
  const filteredShapes = useMemo(() => {
    if (!selectedCategory) return shapes;

    const categoryMap: Record<string, ShapeCategory[]> = {
      plates: [
        ShapeCategory.PLATE_RECTANGULAR,
        ShapeCategory.PLATE_CIRCULAR,
        ShapeCategory.PLATE_CUSTOM,
      ],
      tubes: [ShapeCategory.TUBE_STRAIGHT],
      vessels: [
        ShapeCategory.SHELL_CYLINDRICAL,
        ShapeCategory.SHELL_CONICAL,
        ShapeCategory.HEAD_HEMISPHERICAL,
        ShapeCategory.HEAD_ELLIPSOIDAL,
        ShapeCategory.HEAD_TORISPHERICAL,
        ShapeCategory.HEAD_FLAT,
        ShapeCategory.HEAD_CONICAL,
      ],
      heatExchangers: [
        ShapeCategory.HX_TUBE_BUNDLE,
        ShapeCategory.HX_TUBE_SHEET,
        ShapeCategory.HX_BAFFLE,
        ShapeCategory.HX_TUBE_SUPPORT,
      ],
      nozzles: [
        ShapeCategory.NOZZLE_ASSEMBLY,
        ShapeCategory.NOZZLE_CUSTOM_CIRCULAR,
        ShapeCategory.NOZZLE_CUSTOM_RECTANGULAR,
        ShapeCategory.MANWAY_ASSEMBLY,
        ShapeCategory.REINFORCEMENT_PAD,
      ],
    };

    const allowedCategories = categoryMap[selectedCategory] || [];
    return shapes.filter((s) => allowedCategories.includes(s.category));
  }, [shapes, selectedCategory]);

  const handleCategoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedCategory(event.target.value);
    // Clear selection when category changes
    setSelectedShape(null);
    onChange(null, null);
  };

  const handleShapeChange = (_event: React.SyntheticEvent, newValue: Shape | null) => {
    setSelectedShape(newValue);
    onChange(newValue?.id || null, newValue);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Category Filter */}
      <TextField
        select
        label="Shape Category"
        value={selectedCategory}
        onChange={handleCategoryChange}
        fullWidth
        disabled={disabled}
        helperText="Filter shapes by category"
      >
        <MenuItem value="">All Categories</MenuItem>
        {categories.map((cat) => (
          <MenuItem key={cat} value={cat}>
            {CATEGORY_DISPLAY_NAMES[cat] || cat}
          </MenuItem>
        ))}
      </TextField>

      {/* Shape Selector */}
      <Autocomplete
        value={selectedShape}
        onChange={handleShapeChange}
        options={filteredShapes}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={!!error}
            helperText={error || 'Search by name or select from the list'}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...otherProps } = props;
          return (
            <li key={key} {...otherProps}>
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body1">{option.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip
                    label={SHAPE_CATEGORY_LABELS[option.category] || option.category}
                    size="small"
                    variant="outlined"
                  />
                  {option.isStandard && <Chip label="Standard" size="small" color="primary" />}
                </Stack>
                {option.description && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {option.description.slice(0, 100)}
                    {option.description.length > 100 ? '...' : ''}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        PaperComponent={({ children }) => (
          <Paper elevation={8} sx={{ maxHeight: 400 }}>
            {children}
          </Paper>
        )}
      />

      {/* Selected Shape Info */}
      {selectedShape && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            Selected: {selectedShape.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedShape.description}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              label={SHAPE_CATEGORY_LABELS[selectedShape.category]}
              size="small"
              color="primary"
              variant="outlined"
            />
            {selectedShape.standard && (
              <Chip
                label={`${selectedShape.standard.standardBody} ${selectedShape.standard.standardNumber || ''}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Parameters: {selectedShape.parameters.map((p) => p.name).join(', ')}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

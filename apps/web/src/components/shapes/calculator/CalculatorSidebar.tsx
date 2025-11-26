'use client';

import { Box, Paper, Stack, Divider, Typography } from '@mui/material';
import type { Shape, Material } from '@vapour/types';
import ShapeCategoryDropdown from './ShapeCategoryDropdown';
import ShapeDropdown from './ShapeDropdown';
import MaterialDropdown from './MaterialDropdown';
import ParameterInputForm from '../ParameterInputForm';

interface CalculatorSidebarProps {
  // Category selection
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;

  // Shape selection
  selectedShape: Shape | null;
  onShapeChange: (shape: Shape | null) => void;

  // Material selection
  selectedMaterial: Material | null;
  onMaterialChange: (material: Material | null) => void;

  // Parameter inputs
  parameterValues: Record<string, number>;
  onParameterChange: (values: Record<string, number>) => void;

  // Quantity
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}

export default function CalculatorSidebar({
  selectedCategory,
  onCategoryChange,
  selectedShape,
  onShapeChange,
  selectedMaterial,
  onMaterialChange,
  parameterValues,
  onParameterChange,
  quantity,
  onQuantityChange,
}: CalculatorSidebarProps) {
  return (
    <Paper
      sx={{
        p: 3,
        height: 'fit-content',
        position: 'sticky',
        top: 16,
      }}
    >
      <Typography variant="h6" gutterBottom>
        Shape Calculator
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={3}>
        {/* Step 1: Category Selection */}
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
            1. Select Category
          </Typography>
          <ShapeCategoryDropdown value={selectedCategory} onChange={onCategoryChange} />
        </Box>

        {/* Step 2: Shape Selection */}
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
            2. Select Shape
          </Typography>
          <ShapeDropdown
            category={selectedCategory}
            value={selectedShape}
            onChange={onShapeChange}
            disabled={!selectedCategory}
          />
        </Box>

        {/* Step 3: Material Selection */}
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
            3. Select Material
          </Typography>
          <MaterialDropdown
            allowedCategories={selectedShape?.allowedMaterialCategories}
            value={selectedMaterial}
            onChange={onMaterialChange}
            disabled={!selectedShape}
          />
        </Box>

        {/* Step 4: Parameters */}
        {selectedShape && selectedMaterial && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
                4. Enter Dimensions
              </Typography>
              <ParameterInputForm
                shape={selectedShape}
                material={selectedMaterial}
                onParameterChange={onParameterChange}
                onQuantityChange={onQuantityChange}
              />
            </Box>
          </>
        )}

        {/* Summary Info */}
        {selectedShape && selectedMaterial && Object.keys(parameterValues).length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Summary
              </Typography>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Shape
                  </Typography>
                  <Typography variant="body2">{selectedShape.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Material
                  </Typography>
                  <Typography variant="body2">{selectedMaterial.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Density
                  </Typography>
                  <Typography variant="body2">
                    {selectedMaterial.properties?.density || 'N/A'} kg/m³
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Quantity
                  </Typography>
                  <Typography variant="body2">{quantity}</Typography>
                </Box>
                {selectedShape.standard && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Standard
                    </Typography>
                    <Typography variant="body2">
                      {selectedShape.standard.standardBody} {selectedShape.standard.standardNumber}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}

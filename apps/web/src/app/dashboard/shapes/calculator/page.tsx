'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Button,
  Alert,
  Stack,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Save as SaveIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Science as TestIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSearchParams, useRouter } from 'next/navigation';

import CalculatorSidebar from '@/components/shapes/calculator/CalculatorSidebar';
import CalculationResults from '@/components/shapes/CalculationResults';
import FormulaTester from '@/components/shapes/FormulaTester';
import { calculateShape } from '@/lib/shapes/shapeCalculator';
import type { Shape, Material } from '@vapour/types';

// Flattened calculation result for display (not the database structure)
type CalculationResult = Record<string, unknown>;

export default function ShapeCalculatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State management
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFormulaTester, setShowFormulaTester] = useState(false);

  // Auto-calculation function with debouncing
  const performCalculation = useCallback(() => {
    if (!selectedShape || !selectedMaterial || Object.keys(parameterValues).length === 0) {
      setCalculationResult(null);
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      // Calculate directly on client-side
      const result = calculateShape({
        shape: selectedShape,
        material: selectedMaterial,
        parameterValues,
        quantity,
      });

      // Flatten the nested structure for the UI component
      const flattenedResult: CalculationResult = {
        // Keep all shape/material metadata
        shapeId: result.shapeId,
        shapeName: result.shapeName,
        shapeCategory: result.shapeCategory,
        materialId: result.materialId,
        materialName: result.materialName,
        materialDensity: result.materialDensity,
        materialPricePerKg: result.materialPricePerKg,
        parameterValues: result.parameterValues,
        // Flatten calculatedValues to top level
        ...result.calculatedValues,
        // Flatten costEstimate to top level
        ...result.costEstimate,
        // Keep top-level properties
        quantity: result.quantity,
        totalWeight: result.totalWeight,
        totalCost: result.totalCost,
        // Calculate cost per unit for display
        costPerUnit: result.quantity > 1 ? result.totalCost / result.quantity : result.totalCost,
      };

      setCalculationResult(flattenedResult);
    } catch (err) {
      console.error('Calculation error:', err);
      setError(err instanceof Error ? err.message : 'Calculation failed');
      setCalculationResult(null);
    } finally {
      setCalculating(false);
    }
  }, [selectedShape, selectedMaterial, parameterValues, quantity]);

  // Debounced auto-calculation (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      performCalculation();
    }, 300);

    return () => clearTimeout(timer);
  }, [performCalculation]);

  // URL state management - sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedShape) params.set('shape', selectedShape.id);
    if (selectedMaterial) params.set('material', selectedMaterial.id);
    if (quantity > 1) params.set('quantity', quantity.toString());

    // Encode parameter values as JSON
    if (Object.keys(parameterValues).length > 0) {
      params.set('params', JSON.stringify(parameterValues));
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    if (newUrl !== `?${searchParams.toString()}`) {
      router.replace(`/dashboard/shapes/calculator${newUrl}`, { scroll: false });
    }
  }, [
    selectedCategory,
    selectedShape,
    selectedMaterial,
    parameterValues,
    quantity,
    router,
    searchParams,
  ]);

  // Handlers
  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    // Clear shape when category changes (handled by ShapeDropdown)
  };

  const handleShapeChange = (shape: Shape | null) => {
    setSelectedShape(shape);
    // Clear material when shape changes if not compatible (handled by MaterialDropdown)
    // Reset parameters when shape changes
    if (shape?.id !== selectedShape?.id) {
      setParameterValues({});
    }
  };

  const handleMaterialChange = (material: Material | null) => {
    setSelectedMaterial(material);
  };

  const handleParameterChange = (values: Record<string, number>) => {
    setParameterValues(values);
  };

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity);
  };

  const handleReset = () => {
    setSelectedCategory(null);
    setSelectedShape(null);
    setSelectedMaterial(null);
    setParameterValues({});
    setQuantity(1);
    setCalculationResult(null);
    setError(null);
    router.replace('/dashboard/shapes/calculator', { scroll: false });
  };

  const handleSave = async () => {
    // Save calculation to database (future enhancement)
  };

  const handleExportPDF = async () => {
    // Export calculation as PDF (future enhancement)
  };

  const handleExportExcel = async () => {
    // Export calculation as Excel (future enhancement)
  };

  const handleShare = async () => {
    // Copy current URL to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const hasValidInputs =
    selectedShape && selectedMaterial && Object.keys(parameterValues).length > 0;

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Shape Calculator
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Calculate dimensions, weights, material requirements, and costs for fabricated shapes
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            startIcon={<TestIcon />}
            onClick={() => setShowFormulaTester(!showFormulaTester)}
            variant="outlined"
          >
            {showFormulaTester ? 'Hide' : 'Show'} Formula Tester
          </Button>
          {calculationResult && (
            <>
              <Button startIcon={<SaveIcon />} onClick={handleSave} variant="outlined">
                Save
              </Button>
              <Button startIcon={<PdfIcon />} onClick={handleExportPDF} variant="outlined">
                Export PDF
              </Button>
              <Button startIcon={<ExcelIcon />} onClick={handleExportExcel} variant="outlined">
                Export Excel
              </Button>
              <Button startIcon={<ShareIcon />} onClick={handleShare} variant="outlined">
                Share
              </Button>
            </>
          )}
          <Button
            startIcon={<RefreshIcon />}
            onClick={handleReset}
            variant="outlined"
            color="secondary"
          >
            Reset
          </Button>
        </Stack>
      </Box>

      {/* Formula Tester */}
      {showFormulaTester && (
        <Box sx={{ mb: 3 }}>
          <FormulaTester />
        </Box>
      )}

      {/* Main Content - Sidebar + Results Layout */}
      <Grid container spacing={3}>
        {/* Left Sidebar - Input Controls */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <CalculatorSidebar
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            selectedShape={selectedShape}
            onShapeChange={handleShapeChange}
            selectedMaterial={selectedMaterial}
            onMaterialChange={handleMaterialChange}
            parameterValues={parameterValues}
            onParameterChange={handleParameterChange}
            quantity={quantity}
            onQuantityChange={handleQuantityChange}
          />
        </Grid>

        {/* Right Panel - Results */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {/* Calculating indicator */}
          {calculating && hasValidInputs && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Calculating...
              </Typography>
            </Box>
          )}

          {/* Error display */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Results or placeholder */}
          {calculationResult ? (
            <Paper sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Calculation Results</Typography>
              </Box>
              <CalculationResults result={calculationResult} />
            </Paper>
          ) : (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                bgcolor: 'action.hover',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {!selectedCategory
                  ? 'Select a shape category to begin'
                  : !selectedShape
                    ? 'Choose a shape from the dropdown'
                    : !selectedMaterial
                      ? 'Select a material for the shape'
                      : 'Enter dimensions to see results'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Results will appear automatically as you enter parameters
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}

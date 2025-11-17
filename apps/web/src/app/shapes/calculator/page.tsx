'use client';

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Stack,
  Divider,
} from '@mui/material';
import {
  Calculate as CalculateIcon,
  Save as SaveIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Science as TestIcon,
} from '@mui/icons-material';

import ShapeCategorySelector from '@/components/shapes/ShapeCategorySelector';
import ShapeSelector from '@/components/shapes/ShapeSelector';
import MaterialSelector from '@/components/shapes/MaterialSelector';
import ParameterInputForm from '@/components/shapes/ParameterInputForm';
import CalculationResults from '@/components/shapes/CalculationResults';
import FormulaTester from '@/components/shapes/FormulaTester';

export default function ShapeCalculatorPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<any | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [calculationResult, setCalculationResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFormulaTester, setShowFormulaTester] = useState(false);

  const steps = ['Select Shape', 'Choose Material', 'Enter Parameters', 'View Results'];

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const handleShapeSelect = (shape: any) => {
    setSelectedShape(shape);
    setActiveStep(1);
  };

  const handleMaterialSelect = (material: any) => {
    setSelectedMaterial(material);
    setActiveStep(2);
  };

  const handleParameterChange = (values: Record<string, number>) => {
    setParameterValues(values);
  };

  const handleCalculate = async () => {
    if (!selectedShape || !selectedMaterial) return;

    setLoading(true);
    try {
      // Call calculation API
      const response = await fetch('/api/shapes/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shapeId: selectedShape.id,
          shape: selectedShape,
          materialId: selectedMaterial.id,
          material: selectedMaterial,
          parameterValues: Object.entries(parameterValues).map(([name, value]) => ({
            name,
            value,
          })),
          quantity,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Calculation failed');
      }

      setCalculationResult(result);
      setActiveStep(3);
    } catch (error) {
      console.error('Calculation error:', error);
      alert(error instanceof Error ? error.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Implement save to database
    console.log('Save calculation');
  };

  const handleExportPDF = async () => {
    // Implement PDF export
    console.log('Export to PDF');
  };

  const handleExportExcel = async () => {
    // Implement Excel export
    console.log('Export to Excel');
  };

  const handleShare = async () => {
    // Implement share functionality
    console.log('Share calculation');
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedCategory(null);
    setSelectedShape(null);
    setSelectedMaterial(null);
    setParameterValues({});
    setCalculationResult(null);
  };

  return (
    <Container maxWidth="xl">
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
        <Stack direction="row" spacing={2}>
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
          <Button onClick={handleReset} variant="outlined" color="secondary">
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

      {/* Progress Stepper */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Step 1: Select Shape */}
      {activeStep === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Shape Categories
                </Typography>
                <ShapeCategorySelector
                  selectedCategory={selectedCategory}
                  onCategorySelect={handleCategorySelect}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {selectedCategory ? 'Select Shape' : 'Select a Category'}
                </Typography>
                {selectedCategory ? (
                  <ShapeSelector category={selectedCategory} onShapeSelect={handleShapeSelect} />
                ) : (
                  <Alert severity="info">Please select a category from the left panel</Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Step 2: Select Material */}
      {activeStep === 1 && selectedShape && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Select Material for {selectedShape.name}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <MaterialSelector
              allowedCategories={selectedShape.allowedMaterialCategories}
              onMaterialSelect={handleMaterialSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Enter Parameters */}
      {activeStep === 2 && selectedShape && selectedMaterial && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Enter Parameters for {selectedShape.name}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <ParameterInputForm
                  shape={selectedShape}
                  material={selectedMaterial}
                  onParameterChange={handleParameterChange}
                  onQuantityChange={setQuantity}
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<CalculateIcon />}
                    onClick={handleCalculate}
                    disabled={loading || Object.keys(parameterValues).length === 0}
                  >
                    {loading ? 'Calculating...' : 'Calculate'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Shape
                    </Typography>
                    <Typography variant="body1">{selectedShape.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Material
                    </Typography>
                    <Typography variant="body1">{selectedMaterial.name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Density
                    </Typography>
                    <Typography variant="body1">
                      {selectedMaterial.physicalProperties?.density || 'N/A'} kg/m³
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Quantity
                    </Typography>
                    <Typography variant="body1">{quantity}</Typography>
                  </Box>
                  {selectedShape.standard && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Standard
                      </Typography>
                      <Typography variant="body2">
                        {selectedShape.standard.standardBody}{' '}
                        {selectedShape.standard.standardNumber}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Step 4: View Results */}
      {activeStep === 3 && calculationResult && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Calculation Results
            </Typography>
            <Divider sx={{ my: 2 }} />
            <CalculationResults result={calculationResult} />
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

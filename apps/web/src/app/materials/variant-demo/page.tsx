'use client';

import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  Divider,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import { ShoppingCart as CartIcon } from '@mui/icons-material';
import type { Material, MaterialVariant } from '@vapour/types';
import { MaterialCategory } from '@vapour/types';
import {
  MaterialVariantSelector,
  MaterialVariantList,
  MaterialPickerDialog,
} from '@/components/materials';

/**
 * Material Variant Demo Page
 *
 * Demonstrates the variant selection UI components.
 * Shows example materials with variants and how to use the components.
 */
export default function MaterialVariantDemoPage() {
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [selectedFullCode, setSelectedFullCode] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedMaterial, setPickedMaterial] = useState<{
    material: Material;
    variant?: MaterialVariant;
    fullCode: string;
  } | null>(null);

  // Example material with variants
  const exampleMaterial: Material = {
    id: 'demo-mat-1',
    materialCode: 'PL-SS-304',
    name: 'Stainless Steel 304 Plate',
    description: 'ASTM A240 Grade 304 stainless steel plate with various thicknesses and finishes',
    category: MaterialCategory.PLATES_STAINLESS_STEEL,
    materialType: 'RAW_MATERIAL',
    specification: {
      standard: 'ASTM A240',
      grade: '304',
      form: 'Plate',
      finish: '2B',
    },
    properties: {
      density: 8000,
      densityUnit: 'kg/m3',
      tensileStrength: 515,
      yieldStrength: 205,
      maxOperatingTemp: 870,
    },
    hasVariants: true,
    variants: [
      {
        id: 'var-1',
        variantCode: '2B',
        displayName: '3mm - 2B Finish',
        dimensions: { thickness: 3 },
        weightPerUnit: 24,
        isAvailable: true,
        leadTimeDays: 7,
        minimumOrderQuantity: 100,
        currentPrice: {
          id: 'price-1',
          materialId: 'demo-mat-1',
          pricePerUnit: { amount: 450, currency: 'INR' },
          unit: 'kg',
          currency: 'INR',
          sourceType: 'VENDOR_QUOTE',
          effectiveDate: Timestamp.fromMillis(Date.now()),
          expiryDate: Timestamp.fromMillis(Date.now() + 86400 * 30 * 1000),
          vendorId: 'vendor-1',
          isActive: true,
          isForecast: false,
          createdAt: Timestamp.fromMillis(Date.now()),
          createdBy: 'demo',
          updatedAt: Timestamp.fromMillis(Date.now()),
          updatedBy: 'demo',
        },
        priceHistory: [],
        createdAt: Timestamp.fromMillis(Date.now()),
        updatedAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'demo',
        updatedBy: 'demo',
      },
      {
        id: 'var-2',
        variantCode: '2B',
        displayName: '5mm - 2B Finish',
        dimensions: { thickness: 5 },
        weightPerUnit: 40,
        isAvailable: true,
        leadTimeDays: 10,
        minimumOrderQuantity: 50,
        currentPrice: {
          id: 'price-2',
          materialId: 'demo-mat-1',
          pricePerUnit: { amount: 470, currency: 'INR' },
          unit: 'kg',
          currency: 'INR',
          sourceType: 'VENDOR_QUOTE',
          effectiveDate: Timestamp.fromMillis(Date.now()),
          expiryDate: Timestamp.fromMillis(Date.now() + 86400 * 30 * 1000),
          vendorId: 'vendor-1',
          isActive: true,
          isForecast: false,
          createdAt: Timestamp.fromMillis(Date.now()),
          createdBy: 'demo',
          updatedAt: Timestamp.fromMillis(Date.now()),
          updatedBy: 'demo',
        },
        priceHistory: [],
        createdAt: Timestamp.fromMillis(Date.now()),
        updatedAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'demo',
        updatedBy: 'demo',
      },
      {
        id: 'var-3',
        variantCode: '2B',
        displayName: '10mm - 2B Finish',
        dimensions: { thickness: 10 },
        weightPerUnit: 80,
        isAvailable: true,
        leadTimeDays: 14,
        currentStock: 250,
        minimumOrderQuantity: 25,
        currentPrice: {
          id: 'price-3',
          materialId: 'demo-mat-1',
          pricePerUnit: { amount: 510, currency: 'INR' },
          unit: 'kg',
          currency: 'INR',
          sourceType: 'VENDOR_QUOTE',
          effectiveDate: Timestamp.fromMillis(Date.now()),
          expiryDate: Timestamp.fromMillis(Date.now() + 86400 * 30 * 1000),
          vendorId: 'vendor-1',
          isActive: true,
          isForecast: false,
          createdAt: Timestamp.fromMillis(Date.now()),
          createdBy: 'demo',
          updatedAt: Timestamp.fromMillis(Date.now()),
          updatedBy: 'demo',
        },
        priceHistory: [],
        createdAt: Timestamp.fromMillis(Date.now()),
        updatedAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'demo',
        updatedBy: 'demo',
      },
      {
        id: 'var-4',
        variantCode: 'BA',
        displayName: '3mm - BA Finish',
        dimensions: { thickness: 3 },
        weightPerUnit: 24,
        isAvailable: true,
        leadTimeDays: 21,
        minimumOrderQuantity: 100,
        currentPrice: {
          id: 'price-4',
          materialId: 'demo-mat-1',
          pricePerUnit: { amount: 580, currency: 'INR' },
          unit: 'kg',
          currency: 'INR',
          sourceType: 'VENDOR_QUOTE',
          effectiveDate: Timestamp.fromMillis(Date.now()),
          expiryDate: Timestamp.fromMillis(Date.now() + 86400 * 30 * 1000),
          vendorId: 'vendor-1',
          isActive: true,
          isForecast: false,
          createdAt: Timestamp.fromMillis(Date.now()),
          createdBy: 'demo',
          updatedAt: Timestamp.fromMillis(Date.now()),
          updatedBy: 'demo',
        },
        priceHistory: [],
        createdAt: Timestamp.fromMillis(Date.now()),
        updatedAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'demo',
        updatedBy: 'demo',
      },
    ],
    baseUnit: 'kg',
    preferredVendors: [],
    priceHistory: [],
    tags: ['stainless-steel', 'plate', '304', 'ASTM'],
    isStandard: true,
    isActive: true,
    trackInventory: false,
    createdAt: Timestamp.fromMillis(Date.now()),
    createdBy: 'demo',
    updatedAt: Timestamp.fromMillis(Date.now()),
    updatedBy: 'demo',
  };

  const handleVariantSelect = (variant: MaterialVariant | null, fullCode: string) => {
    setSelectedVariant(variant);
    setSelectedFullCode(fullCode);
  };

  const handleMaterialPick = (material: Material, variant?: MaterialVariant, fullCode?: string) => {
    setPickedMaterial({
      material,
      variant,
      fullCode: fullCode || material.materialCode,
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          Material Variant UI Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Demonstration of material variant selection components
        </Typography>
      </Box>

      {/* Example 1: Variant Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. Material Variant Selector
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Interactive component for selecting a specific variant from a material&apos;s options
        </Typography>

        <MaterialVariantSelector
          material={exampleMaterial}
          selectedVariantId={selectedVariant?.id}
          onVariantSelect={handleVariantSelect}
          showPricing
          showLeadTime
          showStock
        />

        {selectedFullCode && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              You selected: <strong>{selectedFullCode}</strong>
            </Typography>
            {selectedVariant && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Variant ID: {selectedVariant.id} | Thickness: {selectedVariant.dimensions.thickness}
                mm | Lead Time: {selectedVariant.leadTimeDays} days
              </Typography>
            )}
          </Alert>
        )}
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* Example 2: Variant List */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. Material Variant List
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Table view of all variants with their specifications and pricing
        </Typography>

        <MaterialVariantList material={exampleMaterial} showPricing showStock />
      </Paper>

      <Divider sx={{ my: 4 }} />

      {/* Example 3: Material Picker Dialog */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          3. Material Picker Dialog
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Complete material selection flow with search, filtering, and variant selection
        </Typography>

        <Button
          variant="contained"
          startIcon={<CartIcon />}
          onClick={() => setPickerOpen(true)}
          size="large"
        >
          Open Material Picker
        </Button>

        {pickedMaterial && (
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Selected Material:
              </Typography>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {pickedMaterial.fullCode}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <Typography variant="body2">{pickedMaterial.material.name}</Typography>
                {pickedMaterial.variant && (
                  <Typography variant="caption" color="text.secondary">
                    Variant: {pickedMaterial.variant.displayName} | Thickness:{' '}
                    {pickedMaterial.variant.dimensions.thickness}mm
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        <MaterialPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleMaterialPick}
          title="Select Material for Order"
        />
      </Paper>

      {/* Code Examples */}
      <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom>
          Usage Examples
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Variant Selector:
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: 'grey.900',
              color: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
            }}
          >
            {`<MaterialVariantSelector
  material={material}
  selectedVariantId={selectedVariant?.id}
  onVariantSelect={(variant, fullCode) => {
    console.log('Selected:', fullCode);
  }}
  showPricing
  showLeadTime
  showStock
/>`}
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Variant List:
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: 'grey.900',
              color: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
            }}
          >
            {`<MaterialVariantList
  material={material}
  showPricing
  showStock
/>`}
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Material Picker Dialog:
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: 'grey.900',
              color: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
            }}
          >
            {`<MaterialPickerDialog
  open={open}
  onClose={() => setOpen(false)}
  onSelect={(material, variant, fullCode) => {
    console.log('Picked:', fullCode);
  }}
  title="Select Material"
  requireVariantSelection
/>`}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
  Stack,
  Alert,
  Divider,
  Grid,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type { Material, MaterialVariant } from '@vapour/types';
import {
  generateVariantCode,
  formatThickness,
  formatPrice,
  formatLeadTime,
  getVariantAvailability,
  sortVariantsByThickness,
  filterAvailableVariants,
  getVariantDisplayName,
  hasVariants,
} from '@/lib/materials/variantUtils';

interface MaterialVariantSelectorProps {
  material: Material;
  selectedVariantId?: string;
  onVariantSelect: (variant: MaterialVariant | null, fullCode: string) => void;
  showPricing?: boolean;
  showLeadTime?: boolean;
  showStock?: boolean;
  showUnavailable?: boolean;
  compact?: boolean;
}

/**
 * Material Variant Selector Component
 *
 * Allows users to select a specific variant of a material.
 * Displays variant details including thickness, price, lead time, and availability.
 * Generates full specification code (e.g., PL-SS-304-4thk-2B) when variant is selected.
 */
export default function MaterialVariantSelector({
  material,
  selectedVariantId,
  onVariantSelect,
  showPricing = true,
  showLeadTime = true,
  showStock = false,
  showUnavailable = false,
  compact = false,
}: MaterialVariantSelectorProps) {
  const [expanded, setExpanded] = useState(true);

  // Get variants (filter unavailable if needed)
  const variants = useMemo(() => {
    if (!material.variants || material.variants.length === 0) {
      return [];
    }

    const variantList = showUnavailable
      ? material.variants
      : filterAvailableVariants(material.variants);

    return sortVariantsByThickness(variantList);
  }, [material.variants, showUnavailable]);

  // Handle variant selection
  const handleVariantChange = (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (variant) {
      const fullCode = generateVariantCode(material.materialCode, variant);
      onVariantSelect(variant, fullCode);
    } else {
      onVariantSelect(null, material.materialCode);
    }
  };

  // If material has no variants, show info message
  if (!hasVariants(material)) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        This material has no variants. The base material code{' '}
        <strong>{material.materialCode}</strong> will be used.
      </Alert>
    );
  }

  // If no variants available after filtering
  if (variants.length === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        No available variants found for this material. All variants may be discontinued or
        unavailable.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            Select Variant
          </Typography>
          <Chip label={`${variants.length} options`} size="small" />
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s',
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        {/* Base Material Code Info */}
        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            Base Material: <strong>{material.materialCode}</strong> - {material.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Select a variant below to generate the full specification code
          </Typography>
        </Alert>

        {/* Variant List */}
        <RadioGroup
          value={selectedVariantId || ''}
          onChange={(e) => handleVariantChange(e.target.value)}
        >
          <Stack spacing={compact ? 1 : 2}>
            {variants.map((variant) => {
              const availability = getVariantAvailability(variant);
              const fullCode = generateVariantCode(material.materialCode, variant);
              const isSelected = selectedVariantId === variant.id;

              return (
                <Card
                  key={variant.id}
                  variant="outlined"
                  sx={{
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderWidth: isSelected ? 2 : 1,
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={() => handleVariantChange(variant.id)}
                >
                  <CardContent
                    sx={{ p: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}
                  >
                    <Grid container spacing={2} alignItems="center">
                      {/* Radio Button */}
                      <Grid size="auto">
                        <FormControlLabel
                          value={variant.id}
                          control={<Radio />}
                          label=""
                          sx={{ m: 0 }}
                        />
                      </Grid>

                      {/* Variant Details */}
                      <Grid size="grow">
                        <Box>
                          {/* Variant Name & Code */}
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                          >
                            <Typography variant="body1" fontWeight="medium">
                              {getVariantDisplayName(variant)}
                            </Typography>
                            {isSelected && (
                              <Chip
                                icon={<CheckCircleIcon />}
                                label="Selected"
                                size="small"
                                color="primary"
                              />
                            )}
                          </Box>

                          {/* Full Specification Code */}
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Code: <strong>{fullCode}</strong>
                          </Typography>

                          {/* Variant Properties */}
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}
                          >
                            {/* Thickness */}
                            {variant.dimensions.thickness && (
                              <Chip
                                label={formatThickness(variant.dimensions.thickness)}
                                size="small"
                                variant="outlined"
                              />
                            )}

                            {/* Availability */}
                            <Chip
                              label={availability.label}
                              size="small"
                              color={availability.color}
                            />

                            {/* Lead Time */}
                            {showLeadTime && variant.leadTimeDays !== undefined && (
                              <Chip
                                label={formatLeadTime(variant.leadTimeDays)}
                                size="small"
                                variant="outlined"
                              />
                            )}

                            {/* Stock */}
                            {showStock && variant.currentStock !== undefined && (
                              <Chip
                                label={`Stock: ${variant.currentStock}`}
                                size="small"
                                color={variant.currentStock > 0 ? 'success' : 'default'}
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </Box>
                      </Grid>

                      {/* Pricing */}
                      {showPricing && variant.currentPrice && (
                        <Grid
                          size={{
                            xs: 12,
                            sm: "auto"
                          }}>
                          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                            <Typography variant="h6" color="primary">
                              {formatPrice(
                                variant.currentPrice.pricePerUnit,
                                variant.currentPrice.currency
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              per {material.baseUnit}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>

                    {/* Additional Info (if not compact) */}
                    {!compact && variant.minimumOrderQuantity && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Min. Order Quantity: {variant.minimumOrderQuantity} {material.baseUnit}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </RadioGroup>

        {/* Selected Variant Summary */}
        {selectedVariantId && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'success.lighter', borderRadius: 1 }}>
            <Typography variant="body2" fontWeight="medium" color="success.dark">
              Selected Specification:
            </Typography>
            <Typography variant="h6" color="success.dark" sx={{ mt: 0.5 }}>
              {generateVariantCode(
                material.materialCode,
                variants.find((v) => v.id === selectedVariantId)!
              )}
            </Typography>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

'use client';

import { useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Info as InfoIcon,
  LocalShipping as ShippingIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import type { Material } from '@vapour/types';
import {
  generateVariantCode,
  formatThickness,
  formatPrice,
  formatLeadTime,
  formatWeight,
  getVariantAvailability,
  sortVariantsByThickness,
  getVariantDisplayName,
  hasVariants,
} from '@/lib/materials/variantUtils';
import { formatDate } from '@/lib/utils/formatters';

interface MaterialVariantListProps {
  material: Material;
  showPricing?: boolean;
  showStock?: boolean;
  compact?: boolean;
}

/**
 * Material Variant List Component
 *
 * Displays all variants of a material in a table format.
 * Used on material detail pages to show available options.
 */
export default function MaterialVariantList({
  material,
  showPricing = true,
  showStock = true,
  compact = false,
}: MaterialVariantListProps) {
  // Get sorted variants
  const variants = useMemo(() => {
    if (!material.variants || material.variants.length === 0) {
      return [];
    }
    return sortVariantsByThickness(material.variants);
  }, [material.variants]);

  // If material has no variants
  if (!hasVariants(material)) {
    return (
      <Alert severity="info" icon={<InfoIcon />}>
        <Typography variant="body2">
          This material has no variants. Use the base material code:{' '}
          <strong>{material.materialCode}</strong>
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">Available Variants</Typography>
        <Chip label={`${variants.length} variants`} color="primary" />
      </Stack>

      {/* Info Alert */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2">
          Base Material Code: <strong>{material.materialCode}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Full specification codes shown below include variant details (e.g.,{' '}
          {material.materialCode}-4thk-2B)
        </Typography>
      </Alert>

      {/* Variants Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size={compact ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>Variant</TableCell>
              <TableCell>Full Specification Code</TableCell>
              {!compact && <TableCell>Dimensions</TableCell>}
              {!compact && <TableCell>Weight</TableCell>}
              <TableCell>Availability</TableCell>
              <TableCell>Lead Time</TableCell>
              {showPricing && <TableCell align="right">Price</TableCell>}
              {showStock && <TableCell align="center">Stock</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {variants.map((variant) => {
              const availability = getVariantAvailability(variant);
              const fullCode = generateVariantCode(material.materialCode, variant);

              return (
                <TableRow
                  key={variant.id}
                  hover
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    opacity: variant.isAvailable ? 1 : 0.6,
                  }}
                >
                  {/* Variant Name */}
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {getVariantDisplayName(variant)}
                    </Typography>
                    {variant.displayName && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {variant.displayName}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Full Specification Code */}
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{
                        bgcolor: 'action.hover',
                        px: 1,
                        py: 0.5,
                        borderRadius: 0.5,
                        display: 'inline-block',
                      }}
                    >
                      {fullCode}
                    </Typography>
                  </TableCell>

                  {/* Dimensions */}
                  {!compact && (
                    <TableCell>
                      <Stack spacing={0.5}>
                        {variant.dimensions.thickness && (
                          <Typography variant="caption">
                            Thickness: {formatThickness(variant.dimensions.thickness)}
                          </Typography>
                        )}
                        {variant.dimensions.length && (
                          <Typography variant="caption">
                            Length: {variant.dimensions.length}mm
                          </Typography>
                        )}
                        {variant.dimensions.width && (
                          <Typography variant="caption">
                            Width: {variant.dimensions.width}mm
                          </Typography>
                        )}
                        {variant.dimensions.schedule && (
                          <Typography variant="caption">{variant.dimensions.schedule}</Typography>
                        )}
                      </Stack>
                    </TableCell>
                  )}

                  {/* Weight */}
                  {!compact && (
                    <TableCell>
                      {variant.weightPerUnit ? (
                        <Typography variant="body2">
                          {formatWeight(variant.weightPerUnit, material.baseUnit)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  )}

                  {/* Availability */}
                  <TableCell>
                    <Chip label={availability.label} size="small" color={availability.color} />
                    {variant.discontinuedDate && (
                      <Tooltip title={`Discontinued on ${formatDate(variant.discontinuedDate)}`}>
                        <IconButton size="small" sx={{ ml: 0.5 }}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>

                  {/* Lead Time */}
                  <TableCell>
                    {variant.leadTimeDays !== undefined ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ShippingIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {formatLeadTime(variant.leadTimeDays)}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        TBD
                      </Typography>
                    )}
                  </TableCell>

                  {/* Price */}
                  {showPricing && (
                    <TableCell align="right">
                      {variant.currentPrice ? (
                        <Box>
                          <Typography variant="body2" fontWeight="medium" color="primary">
                            {formatPrice(
                              variant.currentPrice.pricePerUnit,
                              variant.currentPrice.currency
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            per {material.baseUnit}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Quote Required
                        </Typography>
                      )}
                    </TableCell>
                  )}

                  {/* Stock */}
                  {showStock && (
                    <TableCell align="center">
                      {variant.currentStock !== undefined ? (
                        <Chip
                          icon={<InventoryIcon />}
                          label={variant.currentStock}
                          size="small"
                          color={variant.currentStock > 0 ? 'success' : 'default'}
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Variant Summary Stats */}
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Chip
          label={`${variants.filter((v) => v.isAvailable).length} Available`}
          color="success"
          size="small"
        />
        {variants.some((v) => v.currentStock && v.currentStock > 0) && (
          <Chip
            label={`${variants.filter((v) => v.currentStock && v.currentStock > 0).length} In Stock`}
            color="info"
            size="small"
          />
        )}
        {variants.some((v) => v.discontinuedDate) && (
          <Chip
            label={`${variants.filter((v) => v.discontinuedDate).length} Discontinued`}
            color="default"
            size="small"
          />
        )}
      </Stack>
    </Box>
  );
}

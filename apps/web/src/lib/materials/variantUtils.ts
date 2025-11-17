/**
 * Material Variant Utilities
 *
 * Utilities for working with material variants including code generation,
 * formatting, and display helpers.
 */

import type { Material, MaterialVariant, Money } from '@vapour/types';

/**
 * Generate full variant specification code
 *
 * Format: {BASE_CODE}-{THICKNESS}thk-{FINISH}
 * Example: PL-SS-304-4thk-2B
 *
 * @param materialCode - Base material code (e.g., "PL-SS-304")
 * @param variant - Material variant with dimensions and specifications
 * @returns Full specification code
 */
export function generateVariantCode(materialCode: string, variant: MaterialVariant): string {
  const parts: string[] = [materialCode];

  // Add thickness if present
  if (variant.dimensions.thickness) {
    parts.push(`${variant.dimensions.thickness}thk`);
  }

  // Add finish from specification (if available in parent material)
  // For now, we'll use the variantCode which should contain finish info
  if (variant.variantCode && !variant.variantCode.match(/^\d+MM$/i)) {
    // If variantCode is not just a dimension (like "3MM"), include it
    parts.push(variant.variantCode);
  }

  return parts.join('-');
}

/**
 * Format thickness for display
 * @param thickness - Thickness in mm
 * @returns Formatted thickness string
 */
export function formatThickness(thickness: number): string {
  return `${thickness}mm`;
}

/**
 * Format weight per unit for display
 * @param weight - Weight per unit
 * @param unit - Unit (e.g., "kg/m²", "kg/m")
 * @returns Formatted weight string
 */
export function formatWeight(weight: number, unit: string = 'kg/m²'): string {
  return `${weight.toFixed(2)} ${unit}`;
}

/**
 * Format price for display
 * @param price - Price value as number or Money object
 * @param currency - Currency code (optional, used only if price is number)
 * @returns Formatted price string
 */
export function formatPrice(price: number | Money, currency: string = 'INR'): string {
  const amount = typeof price === 'number' ? price : price.amount;
  const curr = typeof price === 'number' ? currency : price.currency;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format lead time for display
 * @param days - Lead time in days
 * @returns Formatted lead time string
 */
export function formatLeadTime(days: number): string {
  if (days === 0) return 'Stock Available';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.ceil(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.ceil(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

/**
 * Get variant availability status
 * @param variant - Material variant
 * @returns Status object with label and color
 */
export function getVariantAvailability(variant: MaterialVariant): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
} {
  if (!variant.isAvailable) {
    return { label: 'Unavailable', color: 'error' };
  }

  if (variant.currentStock && variant.currentStock > 0) {
    return { label: 'In Stock', color: 'success' };
  }

  if (variant.leadTimeDays !== undefined) {
    if (variant.leadTimeDays <= 7) {
      return { label: 'Quick Delivery', color: 'success' };
    }
    if (variant.leadTimeDays <= 30) {
      return { label: 'Standard Lead Time', color: 'warning' };
    }
    return { label: 'Extended Lead Time', color: 'warning' };
  }

  return { label: 'Available', color: 'default' };
}

/**
 * Sort variants by thickness (ascending)
 * @param variants - Array of material variants
 * @returns Sorted array
 */
export function sortVariantsByThickness(variants: MaterialVariant[]): MaterialVariant[] {
  return [...variants].sort((a, b) => {
    const thicknessA = a.dimensions.thickness || 0;
    const thicknessB = b.dimensions.thickness || 0;
    return thicknessA - thicknessB;
  });
}

/**
 * Group variants by a property
 * @param variants - Array of material variants
 * @param groupBy - Property to group by
 * @returns Grouped variants
 */
export function groupVariants<K extends keyof MaterialVariant['dimensions']>(
  variants: MaterialVariant[],
  groupBy: K
): Map<string, MaterialVariant[]> {
  const grouped = new Map<string, MaterialVariant[]>();

  variants.forEach((variant) => {
    const key = String(variant.dimensions[groupBy] || 'other');
    const existing = grouped.get(key) || [];
    grouped.set(key, [...existing, variant]);
  });

  return grouped;
}

/**
 * Filter available variants
 * @param variants - Array of material variants
 * @returns Only available variants
 */
export function filterAvailableVariants(variants: MaterialVariant[]): MaterialVariant[] {
  return variants.filter((v) => v.isAvailable && !v.discontinuedDate);
}

/**
 * Get variant display name
 * Combines thickness and finish for display
 * @param variant - Material variant
 * @returns Display name
 */
export function getVariantDisplayName(variant: MaterialVariant): string {
  const parts: string[] = [];

  if (variant.dimensions.thickness) {
    parts.push(`${variant.dimensions.thickness}mm`);
  }

  if (variant.dimensions.schedule) {
    parts.push(variant.dimensions.schedule);
  }

  if (variant.displayName) {
    // If displayName already includes thickness, use it as is
    if (!variant.displayName.includes('mm') && parts.length > 0) {
      return `${parts.join(' ')} - ${variant.displayName}`;
    }
    return variant.displayName;
  }

  return parts.join(' ') || variant.variantCode;
}

/**
 * Check if material has variants
 * @param material - Material to check
 * @returns True if material has variants
 */
export function hasVariants(material: Material): boolean {
  return material.hasVariants && !!material.variants && material.variants.length > 0;
}

/**
 * Get cheapest variant
 * @param variants - Array of material variants
 * @returns Cheapest variant or undefined
 */
export function getCheapestVariant(variants: MaterialVariant[]): MaterialVariant | undefined {
  return variants
    .filter((v) => v.isAvailable && v.currentPrice?.pricePerUnit)
    .sort((a, b) => {
      const priceA = typeof a.currentPrice?.pricePerUnit === 'number'
        ? a.currentPrice.pricePerUnit
        : a.currentPrice?.pricePerUnit?.amount || Infinity;
      const priceB = typeof b.currentPrice?.pricePerUnit === 'number'
        ? b.currentPrice.pricePerUnit
        : b.currentPrice?.pricePerUnit?.amount || Infinity;
      return priceA - priceB;
    })[0];
}

/**
 * Get fastest delivery variant
 * @param variants - Array of material variants
 * @returns Variant with shortest lead time or undefined
 */
export function getFastestDeliveryVariant(
  variants: MaterialVariant[]
): MaterialVariant | undefined {
  return variants
    .filter((v) => v.isAvailable && v.leadTimeDays !== undefined)
    .sort((a, b) => {
      const leadA = a.leadTimeDays || Infinity;
      const leadB = b.leadTimeDays || Infinity;
      return leadA - leadB;
    })[0];
}

/**
 * Offer Helper Functions
 *
 * Utility functions for offer display, formatting, validation, and comparisons
 */

import type { Offer, OfferStatus, OfferItem } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Check if offer can be edited
 */
export function canEditOffer(offer: Offer): boolean {
  return offer.status === 'UPLOADED' || offer.status === 'UNDER_REVIEW';
}

/**
 * Check if offer can be evaluated
 */
export function canEvaluateOffer(offer: Offer): boolean {
  return offer.status === 'UPLOADED' || offer.status === 'UNDER_REVIEW';
}

/**
 * Check if offer can be selected
 */
export function canSelectOffer(offer: Offer): boolean {
  return offer.status === 'EVALUATED' || offer.isRecommended;
}

/**
 * Check if offer can be rejected
 */
export function canRejectOffer(offer: Offer): boolean {
  return offer.status !== 'SELECTED' && offer.status !== 'WITHDRAWN';
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get status display text
 */
export function getOfferStatusText(status: OfferStatus): string {
  const statusMap: Record<OfferStatus, string> = {
    UPLOADED: 'Uploaded',
    UNDER_REVIEW: 'Under Review',
    EVALUATED: 'Evaluated',
    SELECTED: 'Selected',
    REJECTED: 'Rejected',
    WITHDRAWN: 'Withdrawn',
  };

  return statusMap[status];
}

/**
 * Get status color for chips/badges
 */
export function getOfferStatusColor(
  status: OfferStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  const colorMap: Record<
    OfferStatus,
    'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
  > = {
    UPLOADED: 'info',
    UNDER_REVIEW: 'warning',
    EVALUATED: 'primary',
    SELECTED: 'success',
    REJECTED: 'error',
    WITHDRAWN: 'default',
  };

  return colorMap[status];
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate offer before evaluation
 */
export function validateOfferForEvaluation(offer: Offer): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!offer.itemsParsed) {
    errors.push('Offer items have not been parsed/entered');
  }

  if (offer.subtotal <= 0) {
    errors.push('Subtotal must be greater than zero');
  }

  if (offer.totalAmount <= 0) {
    errors.push('Total amount must be greater than zero');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if offer is expired
 */
export function isOfferExpired(offer: Offer): boolean {
  if (!offer.validityDate) return false;

  const now = new Date();
  const validityDate = offer.validityDate.toDate();
  return validityDate < now;
}

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

/**
 * Calculate price competitiveness score (0-100)
 * Lower price = higher score
 */
export function calculatePriceScore(offerPrice: number, lowestPrice: number): number {
  if (lowestPrice === 0) return 0;
  if (offerPrice === lowestPrice) return 100;

  const priceDiff = ((offerPrice - lowestPrice) / lowestPrice) * 100;

  // Score decreases as price increases
  // 0% diff = 100 score
  // 10% diff = 90 score
  // 20% diff = 80 score, etc.
  const score = Math.max(0, 100 - priceDiff);

  return Math.round(score);
}

/**
 * Compare two offers and return comparison result
 */
export function compareOffers(
  offer1: Offer,
  offer2: Offer
): {
  cheaper: string;
  priceDiff: number;
  percentDiff: number;
} {
  const cheaper = offer1.totalAmount < offer2.totalAmount ? offer1.id : offer2.id;
  const priceDiff = Math.abs(offer1.totalAmount - offer2.totalAmount);
  const higherPrice = Math.max(offer1.totalAmount, offer2.totalAmount);
  const percentDiff = higherPrice > 0 ? (priceDiff / higherPrice) * 100 : 0;

  return {
    cheaper,
    priceDiff,
    percentDiff,
  };
}

/**
 * Rank offers by total amount (ascending)
 */
export function rankOffersByPrice(offers: Offer[]): Array<{ offer: Offer; rank: number }> {
  const sorted = [...offers].sort((a, b) => a.totalAmount - b.totalAmount);

  return sorted.map((offer, index) => ({
    offer,
    rank: index + 1,
  }));
}

/**
 * Find best offer (recommended or lowest price)
 */
export function findBestOffer(offers: Offer[]): Offer | null {
  if (offers.length === 0) return null;

  // First, check if any offer is recommended
  const recommended = offers.find((o) => o.isRecommended);
  if (recommended) return recommended;

  // Otherwise, return lowest priced offer
  const sorted = offers
    .filter((o) => o.status !== 'WITHDRAWN' && o.status !== 'REJECTED')
    .sort((a, b) => a.totalAmount - b.totalAmount);

  return sorted[0] || null;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date
 */
export function formatOfferDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return 'N/A';

  const date = timestamp.toDate();
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format evaluation score with color
 */
export function formatEvaluationScore(score: number | undefined): {
  text: string;
  color: string;
} {
  if (score === undefined) {
    return { text: 'Not evaluated', color: 'text.secondary' };
  }

  let color = 'success.main';
  if (score < 50) color = 'error.main';
  else if (score < 75) color = 'warning.main';

  return {
    text: `${score}/100`,
    color,
  };
}

// ============================================================================
// SEARCH AND FILTER HELPERS
// ============================================================================

/**
 * Filter offers based on search query
 */
export function filterOffersBySearch(offers: Offer[], searchQuery: string): Offer[] {
  if (!searchQuery || searchQuery.trim() === '') return offers;

  const query = searchQuery.toLowerCase().trim();

  return offers.filter((offer) => {
    return (
      offer.number.toLowerCase().includes(query) ||
      offer.vendorName.toLowerCase().includes(query) ||
      offer.vendorOfferNumber?.toLowerCase().includes(query) ||
      offer.rfqNumber.toLowerCase().includes(query)
    );
  });
}

/**
 * Sort offers by field
 */
export function sortOffers(
  offers: Offer[],
  sortBy: 'number' | 'createdAt' | 'totalAmount' | 'evaluationScore' | 'status',
  sortOrder: 'asc' | 'desc' = 'desc'
): Offer[] {
  const sorted = [...offers];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'number':
        comparison = a.number.localeCompare(b.number);
        break;
      case 'createdAt':
        comparison = a.createdAt.toMillis() - b.createdAt.toMillis();
        break;
      case 'totalAmount':
        comparison = a.totalAmount - b.totalAmount;
        break;
      case 'evaluationScore':
        const scoreA = a.evaluationScore || 0;
        const scoreB = b.evaluationScore || 0;
        comparison = scoreA - scoreB;
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

// ============================================================================
// STATISTICS HELPERS
// ============================================================================

/**
 * Calculate offer statistics
 */
export function calculateOfferStats(offers: Offer[]) {
  const stats = {
    total: offers.length,
    uploaded: 0,
    underReview: 0,
    evaluated: 0,
    selected: 0,
    rejected: 0,
    withdrawn: 0,
    recommended: 0,
    expired: 0,
    lowestPrice: 0,
    highestPrice: 0,
    averagePrice: 0,
    priceRange: 0,
  };

  if (offers.length === 0) return stats;

  const prices: number[] = [];

  offers.forEach((offer) => {
    // Status counts
    switch (offer.status) {
      case 'UPLOADED':
        stats.uploaded++;
        break;
      case 'UNDER_REVIEW':
        stats.underReview++;
        break;
      case 'EVALUATED':
        stats.evaluated++;
        break;
      case 'SELECTED':
        stats.selected++;
        break;
      case 'REJECTED':
        stats.rejected++;
        break;
      case 'WITHDRAWN':
        stats.withdrawn++;
        break;
    }

    // Recommended count
    if (offer.isRecommended) {
      stats.recommended++;
    }

    // Expired count
    if (isOfferExpired(offer)) {
      stats.expired++;
    }

    // Price tracking
    if (offer.status !== 'WITHDRAWN' && offer.status !== 'REJECTED') {
      prices.push(offer.totalAmount);
    }
  });

  // Calculate price stats
  if (prices.length > 0) {
    stats.lowestPrice = Math.min(...prices);
    stats.highestPrice = Math.max(...prices);
    stats.averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    stats.priceRange = stats.highestPrice - stats.lowestPrice;
  }

  return stats;
}

// ============================================================================
// ITEM HELPERS
// ============================================================================

/**
 * Calculate total amount for offer items
 */
export function calculateTotalAmount(items: OfferItem[]): {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let taxAmount = 0;

  items.forEach((item) => {
    subtotal += item.amount;
    taxAmount += item.gstAmount || 0;
  });

  return {
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
  };
}

/**
 * Check if all items meet specifications
 */
export function checkAllItemsMeetSpec(items: OfferItem[]): boolean {
  return items.every((item) => item.meetsSpec);
}

/**
 * Get items with deviations
 */
export function getItemsWithDeviations(items: OfferItem[]): OfferItem[] {
  return items.filter((item) => !item.meetsSpec || item.deviations);
}

/**
 * Compare offer item with RFQ requirements
 */
export function compareItemWithRequirement(
  offerItem: OfferItem,
  requiredQuantity: number
): {
  quantityMatch: boolean;
  quantityDiff: number;
  percentDiff: number;
} {
  const quantityMatch = offerItem.quotedQuantity === requiredQuantity;
  const quantityDiff = offerItem.quotedQuantity - requiredQuantity;
  const percentDiff = requiredQuantity > 0 ? (quantityDiff / requiredQuantity) * 100 : 0;

  return {
    quantityMatch,
    quantityDiff,
    percentDiff,
  };
}

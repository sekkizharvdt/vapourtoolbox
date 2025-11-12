// Enhanced Indian Tax ID Validation
// Includes checksum validation and cross-validation

import { PAN_REGEX, GST_REGEX } from './regex';

/**
 * PAN Entity Type Codes
 * 4th character of PAN indicates entity type
 */
export const PAN_ENTITY_TYPES = {
  C: 'Company',
  P: 'Person',
  H: 'HUF (Hindu Undivided Family)',
  F: 'Firm',
  A: 'Association of Persons',
  T: 'Trust',
  B: 'Body of Individuals',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government',
} as const;

/**
 * Validate PAN format and extract entity type
 */
export function validatePAN(pan: string): {
  valid: boolean;
  error?: string;
  entityType?: string;
} {
  if (!pan || typeof pan !== 'string') {
    return { valid: false, error: 'PAN is required' };
  }

  const normalizedPAN = pan.trim().toUpperCase();

  if (!PAN_REGEX.test(normalizedPAN)) {
    return {
      valid: false,
      error: 'Invalid PAN format. Expected format: AAAAA9999A',
    };
  }

  // Extract entity type from 4th character
  const entityTypeCode = normalizedPAN[3] as keyof typeof PAN_ENTITY_TYPES;
  const entityType = PAN_ENTITY_TYPES[entityTypeCode];

  if (!entityType) {
    return {
      valid: false,
      error: `Invalid PAN entity type code: ${entityTypeCode}`,
    };
  }

  return {
    valid: true,
    entityType,
  };
}

/**
 * Calculate GSTIN checksum digit
 * Based on Luhn algorithm variant used by GST
 */
function calculateGSTINChecksum(gstinWithoutChecksum: string): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let factor = 2;
  let sum = 0;

  for (let i = gstinWithoutChecksum.length - 1; i >= 0; i--) {
    const char = gstinWithoutChecksum.charAt(i);
    const codePoint = chars.indexOf(char);
    let addend = factor * codePoint;

    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }

  const remainder = sum % 36;
  const checkCodePoint = (36 - remainder) % 36;

  return chars.charAt(checkCodePoint);
}

/**
 * Validate GSTIN format, checksum, and cross-validate with PAN
 */
export function validateGSTIN(
  gstin: string,
  pan?: string
): {
  valid: boolean;
  error?: string;
  stateCode?: string;
  pan?: string;
  entityCode?: string;
} {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, error: 'GSTIN is required' };
  }

  const normalizedGSTIN = gstin.trim().toUpperCase();

  if (!GST_REGEX.test(normalizedGSTIN)) {
    return {
      valid: false,
      error: 'Invalid GSTIN format. Expected format: 22AAAAA0000A1Z5',
    };
  }

  // Extract components
  const stateCode = normalizedGSTIN.substring(0, 2);
  const extractedPAN = normalizedGSTIN.substring(2, 12);
  const entityCode = normalizedGSTIN.substring(12, 13);
  const checksumDigit = normalizedGSTIN.substring(14, 15);

  // Validate state code (01-37 are valid Indian state codes)
  const stateCodeNum = parseInt(stateCode, 10);
  if (stateCodeNum < 1 || stateCodeNum > 37) {
    return {
      valid: false,
      error: `Invalid state code: ${stateCode}. Must be between 01 and 37`,
    };
  }

  // Validate the 13th character must be 'Z'
  if (normalizedGSTIN[13] !== 'Z') {
    return {
      valid: false,
      error: '13th character must be Z',
    };
  }

  // Validate checksum
  const calculatedChecksum = calculateGSTINChecksum(normalizedGSTIN.substring(0, 14));
  if (calculatedChecksum !== checksumDigit) {
    return {
      valid: false,
      error: `Invalid GSTIN checksum. Expected ${calculatedChecksum}, got ${checksumDigit}`,
    };
  }

  // Cross-validate PAN if provided
  if (pan) {
    const normalizedPAN = pan.trim().toUpperCase();
    if (extractedPAN !== normalizedPAN) {
      return {
        valid: false,
        error: `GSTIN contains different PAN (${extractedPAN}) than provided (${normalizedPAN})`,
      };
    }
  }

  // Validate embedded PAN
  const panValidation = validatePAN(extractedPAN);
  if (!panValidation.valid) {
    return {
      valid: false,
      error: `Invalid PAN embedded in GSTIN: ${panValidation.error}`,
    };
  }

  return {
    valid: true,
    stateCode,
    pan: extractedPAN,
    entityCode,
  };
}

/**
 * Cross-validate PAN and GSTIN together
 */
export function validateTaxIdentifiers(
  pan?: string,
  gstin?: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // PAN validation
  if (pan) {
    const panValidation = validatePAN(pan);
    if (!panValidation.valid) {
      errors.push(`PAN: ${panValidation.error}`);
    }
  }

  // GSTIN validation
  if (gstin) {
    const gstinValidation = validateGSTIN(gstin, pan);
    if (!gstinValidation.valid) {
      errors.push(`GSTIN: ${gstinValidation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract PAN from GSTIN
 */
export function extractPANFromGSTIN(gstin: string): string | null {
  if (!gstin || typeof gstin !== 'string') {
    return null;
  }

  const normalizedGSTIN = gstin.trim().toUpperCase();
  if (!GST_REGEX.test(normalizedGSTIN)) {
    return null;
  }

  return normalizedGSTIN.substring(2, 12);
}

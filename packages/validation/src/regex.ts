// Validation regex patterns (identical across all apps)

/**
 * Email validation
 */
export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * Phone number validation (India)
 * Supports: +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
 */
export const PHONE_REGEX = /^(\+91|91)?[6-9]\d{9}$/;

/**
 * GST validation (India)
 * Format: 22AAAAA0000A1Z5
 */
export const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;

/**
 * PAN validation (India)
 * Format: AAAAA9999A
 */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * Postal code validation (India)
 * Format: 6 digits
 */
export const PINCODE_REGEX = /^[1-9]\d{5}$/;

/**
 * Aadhar validation (India)
 * Format: 12 digits
 */
export const AADHAR_REGEX = /^\d{12}$/;

/**
 * IFSC code validation (India)
 * Format: AAAA0BBBBBB
 */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Amount/Currency validation
 * Supports: 100, 100.50, 1,00,000, 1,00,000.50
 */
export const AMOUNT_REGEX = /^[0-9,]+(\.\d{1,2})?$/;

/**
 * Alphanumeric with spaces
 */
export const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9\s]+$/;

/**
 * Alphanumeric with special characters (for descriptions)
 */
export const TEXT_REGEX = /^[a-zA-Z0-9\s.,;:'"!?@#$%&*()_+\-=\[\]{}<>\/\\|`~]+$/;

/**
 * URL validation
 */
export const URL_REGEX =
  /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

/**
 * Validation helper functions
 */
export const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email);
export const isValidPhone = (phone: string): boolean => PHONE_REGEX.test(phone);
export const isValidGST = (gst: string): boolean => GST_REGEX.test(gst);
export const isValidPAN = (pan: string): boolean => PAN_REGEX.test(pan);
export const isValidPincode = (pincode: string): boolean => PINCODE_REGEX.test(pincode);
export const isValidIFSC = (ifsc: string): boolean => IFSC_REGEX.test(ifsc);
export const isValidAmount = (amount: string): boolean => AMOUNT_REGEX.test(amount);

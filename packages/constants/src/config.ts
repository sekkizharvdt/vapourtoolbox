// Application Configuration Constants

/**
 * React Query Configuration
 */
export const REACT_QUERY_CONFIG = {
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
};

/**
 * Pagination Configuration
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100,
};

/**
 * Date/Time Configuration
 */
export const DATE_TIME = {
  DEFAULT_DATE_FORMAT: 'DD/MM/YYYY',
  DEFAULT_TIME_FORMAT: 'HH:mm',
  DEFAULT_DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
};

/**
 * File Upload Configuration
 */
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

/**
 * Time Tracking Configuration
 */
export const TIME_TRACKING = {
  DAILY_HOURS: 8,
  WEEKLY_HOURS: 40,
  MIN_TIME_ENTRY_MINUTES: 15,
  MAX_TIME_ENTRY_HOURS: 24,
};

/**
 * Accounting Configuration
 */
export const ACCOUNTING = {
  GST_RATES: [0, 5, 12, 18, 28],
  TDS_RATES: [1, 2, 5, 10, 20],
  DECIMAL_PLACES: 2,
};

/**
 * Application Metadata
 */
export const APP_META = {
  NAME: 'Vapour Toolbox',
  COMPANY: 'Vapour Desal Technologies',
  VERSION: '0.1.0',
  DESCRIPTION: 'Unified Business Management Platform',
};

/**
 * Contact Information
 */
export const CONTACT = {
  EMAIL: 'info@vapourdesal.com',
  PHONE: '+91-XXXXXXXXXX', // Replace with actual
  WEBSITE: 'https://vapourdesal.com',
};

/**
 * API Configuration
 */
export const API = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
};

/**
 * Navigation Configuration
 */
export const NAVIGATION = {
  SIDEBAR_WIDTH: 240,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  HEADER_HEIGHT: 64,
};

/**
 * Toast/Notification Configuration
 */
export const NOTIFICATIONS = {
  AUTO_HIDE_DURATION: 6000, // 6 seconds
  MAX_SNACK: 3,
};

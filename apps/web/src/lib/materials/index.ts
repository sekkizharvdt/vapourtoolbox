/**
 * Materials Module
 *
 * Handles material database management including ASME/ASTM standards compliance.
 *
 * Submodules:
 * - crud - Create, read, update, delete operations
 * - queries - Querying and search functions
 * - pricing - Price management
 * - vendors - Preferred vendor management
 * - stock - Inventory and stock tracking
 */

// CRUD Operations
export * from './crud';

// Querying & Search
export * from './queries';

// Price Management
export * from './pricing';

// Vendor Management
export * from './vendors';

// Stock Management
export * from './stock';

// Variant Utilities
export * from './variantUtils';

// Legacy re-export (for backward compatibility)
// New code should import directly from submodules above

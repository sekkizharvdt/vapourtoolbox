/**
 * Material Database Service
 *
 * This file re-exports from submodules for backward compatibility.
 * New code should import directly from submodules:
 * - ./crud - createMaterial, updateMaterial, getMaterialById, deleteMaterial
 * - ./queries - queryMaterials, searchMaterials, getMaterialsByVendor
 * - ./pricing - addMaterialPrice, getMaterialPriceHistory, getCurrentPrice
 * - ./vendors - addPreferredVendor, removePreferredVendor
 * - ./stock - updateMaterialStock, getStockMovementHistory
 */

// Re-export all from submodules for backward compatibility
export * from './crud';
export * from './queries';
export * from './pricing';
export * from './vendors';
export * from './stock';

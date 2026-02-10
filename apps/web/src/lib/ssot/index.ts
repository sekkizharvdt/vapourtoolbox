/**
 * SSOT (Single Source of Truth) Services
 *
 * Process data management for thermal desalination projects.
 */

// Auth
export { type SSOTAccessCheck } from './ssotAuth';

// Services
export * from './streamService';
export * from './equipmentService';
export * from './lineService';
export * from './instrumentService';
export * from './valveService';
export {
  listPipeSizes,
  getPipeSize,
  subscribeToPipeSizes,
  findPipeSizeForID,
  calculateInnerDiameter as calculatePipeInnerDiameter,
  createPipeSize,
  updatePipeSize,
  deletePipeSize,
  DEFAULT_PIPE_TABLE,
  seedDefaultPipeTable,
} from './pipeTableService';

// Calculations
export * from './streamCalculations';
export {
  DEFAULT_DESIGN_VELOCITY,
  calculateInnerDiameter,
  calculateVelocity,
  enrichLineInput,
} from './lineCalculations';

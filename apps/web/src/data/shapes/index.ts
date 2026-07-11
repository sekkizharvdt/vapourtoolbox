/**
 * Shape Data Export
 * Centralized export of all shape definitions
 */

import type { Shape } from '@vapour/types';
import { plateShapes } from './plates';
import { tubeShapes } from './tubes';
import { pressureVesselShapes } from './pressureVesselComponents';
import { pressureVesselHeadShapes } from './pressureVesselHeads';
import { heatExchangerShapes } from './heatExchangerComponents';
import { nozzleAssemblyShapes } from './nozzleAssemblies';

/**
 * A shape definition as authored in the data files: a full Shape minus the
 * audit-metadata fields, which are stamped at read time by lib/shapes/shapeData.
 * `id` and `shapeCode` are hand-written and PERMANENT — BOM items persist them.
 */
export type ShapeDefinition = Omit<Shape, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

// Phase 1 Shapes (11 total)
export const phase1Shapes = [
  ...plateShapes, // 3 shapes
  ...tubeShapes, // 1 shape
  ...pressureVesselShapes, // 3 shapes (cylindrical shell, conical shell, hemispherical head)
  ...pressureVesselHeadShapes, // 4 shapes (ellipsoidal, torispherical, flat, conical heads)
];

// Phase 2 Shapes (4 total)
export const phase2Shapes = [
  ...heatExchangerShapes, // 4 shapes (tube bundle, tube sheet, baffle, tube support)
];

// Phase 3 Shapes (5 total)
export const phase3Shapes = [
  ...nozzleAssemblyShapes, // 5 shapes (standard nozzle, custom circular, custom rectangular, manway, reinforcement pad)
];

// All shapes (20 total through Phase 3)
export const allShapes = [...phase1Shapes, ...phase2Shapes, ...phase3Shapes];

// Export by category
export { plateShapes } from './plates';
export { tubeShapes } from './tubes';
export { pressureVesselShapes } from './pressureVesselComponents';
export { pressureVesselHeadShapes } from './pressureVesselHeads';
export { heatExchangerShapes } from './heatExchangerComponents';
export { nozzleAssemblyShapes } from './nozzleAssemblies';

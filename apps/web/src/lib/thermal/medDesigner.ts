/**
 * MED Plant Designer — Re-export Shim
 *
 * This file was previously a 3,002-line monolithic calculator. It has been
 * decomposed into focused modules in the ./med/ directory:
 *
 *   Core Engine:        med/medEngine.ts, med/effectModel.ts
 *   Equipment Sizing:   med/equipmentSizing.ts
 *   Shell Geometry:     med/shellGeometry.ts
 *   Auxiliary Equipment: med/auxiliaryEquipment.ts
 *   GOR Analysis:       med/gorAnalysis.ts
 *   Geometry Comparison: med/geometryComparison.ts
 *   Turndown Analysis:  med/turndownAnalysis.ts
 *   Weight Estimation:  med/weightEstimation.ts
 *   Input/Result Adapters: med/inputAdapter.ts, med/resultAdapter.ts
 *   Pipeline Orchestrator: med/designPipeline.ts
 *   Type Definitions:   med/designerTypes.ts
 *
 * The designMED() and generateDesignOptions() functions now delegate to the
 * unified pipeline which uses the core solver for the H&M balance.
 */

import { designMEDPlant, generateDesignOptionsPipeline } from './med/designPipeline';
import type { MEDDesignerInput, MEDDesignOption, MEDDesignerResult } from './med/designerTypes';

// ============================================================================
// Type Re-exports
// ============================================================================

export type {
  MEDDesignerInput,
  MEDDesignerEffect,
  MEDDesignerCondenser,
  MEDDesignerPreheater,
  PassOption,
  MEDDemisterResult,
  MEDSprayNozzleResult,
  MEDSiphonResult,
  MEDLineSizing,
  MEDPumpResult,
  MEDShellNozzle,
  MEDNozzleSchedule,
  MEDDosingResult,
  MEDVacuumResult,
  MEDCostItem,
  MEDCostEstimate,
  MEDTurndownPoint,
  MEDTurndownAnalysis,
  GeometryComparisonEffect,
  GeometryComparisonOption,
  PreheaterContribution,
  MEDAuxiliaryEquipment,
  ShellWeight,
  MEDWeightEstimate,
  MEDDesignOption,
  MEDScenarioRow,
  GORConfigRow,
  MEDDesignerResult,
  // Backward-compatible aliases
  MEDEffectResult,
  MEDCondenserResult,
  MEDPreheaterResult,
} from './med/designerTypes';

export { MATERIAL_COST_RATES } from './med/weightEstimation';

// ============================================================================
// Public API — Thin wrappers around the pipeline
// ============================================================================

/**
 * Design a complete MED plant.
 * Delegates to the unified pipeline which uses the core solver for H&M balance.
 */
export function designMED(input: MEDDesignerInput): MEDDesignerResult {
  return designMEDPlant(input);
}

/**
 * Generate multiple design options for comparison (3-10 effects).
 * Delegates to the pipeline-based generator.
 */
export function generateDesignOptions(input: MEDDesignerInput): MEDDesignOption[] {
  return generateDesignOptionsPipeline(input);
}

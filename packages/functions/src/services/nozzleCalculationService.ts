/**
 * Nozzle Calculation Service
 * ASME Section VIII Division 1 UG-37 reinforcement calculations
 * and bolt removal clearance checks
 */

import type {
  ReinforcementCalculation,
  BoltClearanceCheck,
  NozzleOrientation,
} from '@vapour/types';

/**
 * ASME UG-37 Nozzle Reinforcement Calculation
 * Determines if reinforcement pad is required for nozzle opening
 */
export interface ReinforcementInput {
  // Shell properties
  shellID: number; // mm
  shellThickness: number; // mm
  shellMaterialAllowableStress: number; // MPa
  shellCorrosionAllowance?: number; // mm

  // Nozzle properties
  nozzleOD: number; // mm
  nozzleThickness: number; // mm
  nozzleProjection: number; // mm (outside shell)
  nozzleMaterialAllowableStress?: number; // MPa
  nozzleCorrosionAllowance?: number; // mm

  // Operating conditions
  designPressure: number; // MPa
  designTemperature?: number; // °C

  // Geometry
  nozzleOrientation?: NozzleOrientation;
  offset?: number; // mm (for offset nozzles)
}

/**
 * Calculate required reinforcement area per ASME UG-37
 */
export function calculateReinforcementArea(input: ReinforcementInput): ReinforcementCalculation {
  try {
    const {
      shellID,
      shellThickness,
      shellMaterialAllowableStress,
      shellCorrosionAllowance = 3,
      nozzleOD,
      nozzleThickness,
      nozzleProjection,
      nozzleMaterialAllowableStress,
      nozzleCorrosionAllowance = 3,
      designPressure,
      nozzleOrientation = 'RADIAL',
    } = input;

    // Calculate effective thicknesses (nominal - corrosion allowance)
    const te = shellThickness - shellCorrosionAllowance; // effective shell thickness
    const tn = nozzleThickness - nozzleCorrosionAllowance; // effective nozzle thickness

    // Calculate nozzle inside diameter
    const nozzleID = nozzleOD - 2 * nozzleThickness;

    // Determine diameter for reinforcement calculation
    // For radial nozzles on cylindrical shells: use nozzle ID
    const d = nozzleID;

    // Calculate required shell thickness (tr) per UG-27
    const R = shellID / 2; // shell inside radius
    const E = 1.0; // joint efficiency (assume full RT for conservative estimate)
    const tr = (designPressure * R) / (shellMaterialAllowableStress * E - 0.6 * designPressure);

    // Area required (A) per UG-37
    // A = d * tr * F
    // where F = correction factor (1.0 for radial nozzles on cylindrical shells)
    let F = 1.0;
    if (nozzleOrientation === 'HILLSIDE') {
      // Hillside nozzles require additional reinforcement
      F = 1.5; // Simplified - actual calculation more complex
    }

    const A_required = d * tr * F;

    // Area available in excess shell thickness
    // A1 = larger of (d*E1*(te-tr) or 2*(te+tn)*(te-tr)*E1)
    const E1 = Math.min(1.0, shellMaterialAllowableStress / shellMaterialAllowableStress); // strength ratio
    const A1_option1 = d * E1 * (te - tr);
    const A1_option2 = 2 * (te + tn) * (te - tr) * E1;
    const A1 = Math.max(0, Math.max(A1_option1, A1_option2));

    // Area available in excess nozzle thickness
    // A2 = 2 * tn * (available height) * E2
    const E2 = nozzleMaterialAllowableStress
      ? Math.min(1.0, nozzleMaterialAllowableStress / shellMaterialAllowableStress)
      : 1.0;

    // Available height = lesser of (nozzle projection or 2.5*tn)
    const availableHeight = Math.min(nozzleProjection, 2.5 * tn);
    const A2 = 2 * tn * availableHeight * E2;

    // Total area available (simplified - actual UG-37 has more terms)
    const A_available = A1 + A2;

    // Check if reinforcement is required
    const isReinforcementRequired = A_available < A_required;

    // If reinforcement is required, calculate pad dimensions
    let padDiameter: number | undefined;
    let padThickness: number | undefined;

    if (isReinforcementRequired) {
      // Calculate reinforcement pad area needed
      const A_pad_required = A_required - A_available;

      // Standard pad thickness (typically 6-12mm or half shell thickness)
      padThickness = Math.max(6, shellThickness / 2);

      // Calculate pad diameter
      // A_pad = pi * ((D_pad/2)^2 - (nozzleOD/2)^2)
      // Solving for D_pad
      const minPadOD = nozzleOD + 100; // Minimum 50mm extension each side
      const calculatedPadOD = Math.sqrt(
        (4 * A_pad_required) / (Math.PI * padThickness) + nozzleOD ** 2
      );
      padDiameter = Math.max(minPadOD, calculatedPadOD);

      // Round up to nearest 10mm
      padDiameter = Math.ceil(padDiameter / 10) * 10;
    }

    // Generate calculation summary
    const calculation = [
      `ASME Section VIII Div 1 UG-37 Reinforcement Calculation`,
      ``,
      `Shell: ID=${shellID}mm, t=${shellThickness}mm, te=${te.toFixed(1)}mm`,
      `Nozzle: OD=${nozzleOD}mm, ID=${nozzleID.toFixed(1)}mm, t=${nozzleThickness}mm`,
      `Design Pressure: ${designPressure} MPa`,
      `Allowable Stress: ${shellMaterialAllowableStress} MPa`,
      ``,
      `Required Shell Thickness (tr): ${tr.toFixed(2)} mm`,
      `Correction Factor (F): ${F}`,
      ``,
      `Area Required (A): ${A_required.toFixed(0)} mm²`,
      `Area Available (A1 + A2): ${A_available.toFixed(0)} mm²`,
      `  - A1 (excess shell): ${A1.toFixed(0)} mm²`,
      `  - A2 (excess nozzle): ${A2.toFixed(0)} mm²`,
      ``,
    ];

    if (isReinforcementRequired) {
      calculation.push(
        `REINFORCEMENT REQUIRED: ${(A_required - A_available).toFixed(0)} mm² deficit`,
        ``,
        `Reinforcement Pad:`,
        `  - Diameter: ${padDiameter} mm`,
        `  - Thickness: ${padThickness} mm`,
        `  - Extension: ${((padDiameter! - nozzleOD) / 2).toFixed(0)} mm beyond nozzle`
      );
    } else {
      calculation.push(
        `NO REINFORCEMENT REQUIRED`,
        `Available area exceeds required by ${(A_available - A_required).toFixed(0)} mm²`
      );
    }

    return {
      isReinforcementRequired,
      areaRequired: A_required,
      areaAvailable: A_available,
      padDiameter,
      padThickness,
      calculation: calculation.join('\n'),
    };
  } catch (error) {
    throw new Error(
      `Reinforcement calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Bolt Removal Clearance Check
 * Ensures adequate nozzle projection for bolt removal
 */
export interface BoltClearanceInput {
  // Nozzle flange properties
  flangeThickness: number; // mm
  flangeRating: string; // e.g., "150#", "PN16"
  flangeBoltSize?: string; // e.g., "M16", "5/8""

  // Gasket
  gasketThickness: number; // mm

  // Bolt/Nut dimensions
  boltDiameter?: number; // mm (calculated from bolt size if not provided)
  nutHeight?: number; // mm (calculated from bolt size if not provided)
  washerThickness?: number; // mm

  // Actual nozzle projection
  nozzleProjection: number; // mm

  // Clearance requirements
  minimumClearance?: number; // mm (default 25-75mm for wrench access)
}

/**
 * Calculate bolt removal clearance
 */
export function calculateBoltClearance(input: BoltClearanceInput): BoltClearanceCheck {
  try {
    const {
      flangeThickness,
      gasketThickness,
      boltDiameter,
      nutHeight,
      washerThickness = 3,
      nozzleProjection,
      minimumClearance = 50,
    } = input;

    // Estimate bolt diameter and nut height if not provided
    let effectiveBoltDiameter = boltDiameter || 16; // default M16
    let effectiveNutHeight = nutHeight || effectiveBoltDiameter * 0.8; // typical nut height

    // If bolt size string is provided, parse it
    if (input.flangeBoltSize) {
      const match = input.flangeBoltSize.match(/M?(\d+)/);
      if (match) {
        effectiveBoltDiameter = parseInt(match[1]);
        effectiveNutHeight = effectiveBoltDiameter * 0.8;
      }
    }

    // Calculate minimum projection required
    // Minimum projection = Flange thickness + Gasket + Nut height + Washer + Clearance for wrench
    const minimumProjection =
      flangeThickness + gasketThickness + effectiveNutHeight + washerThickness + minimumClearance;

    // Check if actual projection is adequate
    const isAdequate = nozzleProjection >= minimumProjection;
    const shortage = isAdequate ? 0 : minimumProjection - nozzleProjection;

    // Generate recommendation
    let recommendation: string;
    if (isAdequate) {
      const excess = nozzleProjection - minimumProjection;
      recommendation = `Adequate clearance. Projection exceeds minimum by ${excess.toFixed(0)}mm.`;
    } else {
      recommendation = [
        `INSUFFICIENT CLEARANCE for bolt removal.`,
        `Options:`,
        `1. Increase nozzle projection by ${shortage.toFixed(0)}mm`,
        `2. Use stud bolts instead of through bolts`,
        `3. Use thinner gasket if possible`,
        `4. Review flange design for reduced thickness`,
      ].join('\n');
    }

    return {
      isAdequate,
      minimumProjection,
      actualProjection: nozzleProjection,
      shortage: shortage > 0 ? shortage : undefined,
      recommendation,
    };
  } catch (error) {
    throw new Error(
      `Bolt clearance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Combined nozzle analysis
 * Performs both reinforcement and bolt clearance checks
 */
export interface NozzleAnalysisInput
  extends ReinforcementInput,
    Omit<BoltClearanceInput, 'nozzleProjection'> {}

export interface NozzleAnalysisResult {
  reinforcement: ReinforcementCalculation;
  boltClearance: BoltClearanceCheck;
  overallStatus: 'OK' | 'REINFORCEMENT_REQUIRED' | 'CLEARANCE_ISSUE' | 'BOTH_ISSUES';
  summary: string;
}

export function analyzeNozzle(input: NozzleAnalysisInput): NozzleAnalysisResult {
  // Perform reinforcement calculation
  const reinforcement = calculateReinforcementArea(input);

  // Perform bolt clearance check
  const boltClearance = calculateBoltClearance({
    ...input,
    nozzleProjection: input.nozzleProjection,
  });

  // Determine overall status
  let overallStatus: NozzleAnalysisResult['overallStatus'] = 'OK';
  if (reinforcement.isReinforcementRequired && !boltClearance.isAdequate) {
    overallStatus = 'BOTH_ISSUES';
  } else if (reinforcement.isReinforcementRequired) {
    overallStatus = 'REINFORCEMENT_REQUIRED';
  } else if (!boltClearance.isAdequate) {
    overallStatus = 'CLEARANCE_ISSUE';
  }

  // Generate summary
  const summaryLines = [
    `Nozzle Analysis Summary`,
    `======================`,
    ``,
    `Reinforcement: ${reinforcement.isReinforcementRequired ? '❌ REQUIRED' : '✅ NOT REQUIRED'}`,
    `Bolt Clearance: ${boltClearance.isAdequate ? '✅ ADEQUATE' : '❌ INSUFFICIENT'}`,
    ``,
  ];

  if (reinforcement.isReinforcementRequired) {
    summaryLines.push(
      `Reinforcement Pad: ${reinforcement.padDiameter}mm dia. × ${reinforcement.padThickness}mm thick`
    );
  }

  if (!boltClearance.isAdequate) {
    summaryLines.push(
      `Required nozzle projection: ${boltClearance.minimumProjection.toFixed(0)}mm`
    );
    summaryLines.push(`Current projection: ${boltClearance.actualProjection.toFixed(0)}mm`);
    summaryLines.push(`Shortage: ${boltClearance.shortage?.toFixed(0)}mm`);
  }

  return {
    reinforcement,
    boltClearance,
    overallStatus,
    summary: summaryLines.join('\n'),
  };
}

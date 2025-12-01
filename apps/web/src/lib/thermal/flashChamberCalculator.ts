/**
 * Flash Chamber Calculator
 *
 * Performs complete flash chamber design calculations including:
 * - Heat and mass balance
 * - Chamber sizing (diameter and height)
 * - Nozzle sizing
 * - NPSHa calculation
 *
 * Based on thermal desalination design principles for flash evaporation.
 */

import {
  getSaturationTemperature,
  getSaturationPressure,
  getEnthalpyVapor,
  getDensityVapor,
  kgCm2GaugeToBar,
  barToWaterHead,
  getSeawaterDensity,
  getSeawaterEnthalpy,
  getBoilingPointElevation,
  getBrineSalinity,
} from '@vapour/constants';

import {
  selectPipeByVelocity,
  calculateRequiredArea,
  SCHEDULE_40_PIPES,
  type PipeVariant,
} from './pipeService';

import type {
  FlashChamberInput,
  FlashChamberResult,
  HeatMassBalance,
  HeatMassBalanceRow,
  ChamberSizing,
  NozzleSizing,
  NPSHaCalculation,
} from '@vapour/types';

// ============================================================================
// Constants
// ============================================================================

/** Cross-section loading factor: ton/hr per m² of cross-section */
const CROSS_SECTION_LOADING = 2.0; // ton/hr/m²

/** Atmospheric pressure head in meters of water */
const ATM_PRESSURE_HEAD = 10.33; // m

/** Standard friction loss estimate for suction piping */
const ESTIMATED_FRICTION_LOSS = 0.5; // m

/** Minimum NPSHa margin recommended */
const MIN_NPSH_MARGIN = 1.5; // m

/** Calculator version for tracking */
const CALCULATOR_VERSION = '1.0.0';

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate flash chamber inputs
 *
 * @param input - Flash chamber input parameters
 * @returns Validation result with errors and warnings
 */
export function validateFlashChamberInput(input: FlashChamberInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Import limits from types
  const limits = {
    operatingPressure: { min: 0.5, max: 3.0 },
    waterFlowRate: { min: 1, max: 10000 },
    vaporQuantity: { min: 0.1, max: 1000 },
    inletTemperature: { min: 40, max: 120 },
    seawaterSalinity: { min: 1000, max: 70000 },
    retentionTime: { min: 1, max: 5 },
    flashingZoneHeight: { min: 300, max: 1000 },
    sprayAngle: { min: 30, max: 90 },
    inletWaterVelocity: { min: 1.5, max: 4.0 },
    outletWaterVelocity: { min: 0.5, max: 2.5 },
    vaporVelocity: { min: 5, max: 40 },
  };

  // Check operating pressure
  if (
    input.operatingPressure < limits.operatingPressure.min ||
    input.operatingPressure > limits.operatingPressure.max
  ) {
    errors.push(
      `Operating pressure must be between ${limits.operatingPressure.min} and ${limits.operatingPressure.max} kg/cm²(g)`
    );
  }

  // Check mode-specific inputs
  if (input.mode === 'WATER_FLOW') {
    if (!input.waterFlowRate || input.waterFlowRate <= 0) {
      errors.push('Water flow rate is required when mode is WATER_FLOW');
    } else if (
      input.waterFlowRate < limits.waterFlowRate.min ||
      input.waterFlowRate > limits.waterFlowRate.max
    ) {
      errors.push(
        `Water flow rate must be between ${limits.waterFlowRate.min} and ${limits.waterFlowRate.max} ton/hr`
      );
    }
  } else {
    if (!input.vaporQuantity || input.vaporQuantity <= 0) {
      errors.push('Vapor quantity is required when mode is VAPOR_QUANTITY');
    } else if (
      input.vaporQuantity < limits.vaporQuantity.min ||
      input.vaporQuantity > limits.vaporQuantity.max
    ) {
      errors.push(
        `Vapor quantity must be between ${limits.vaporQuantity.min} and ${limits.vaporQuantity.max} ton/hr`
      );
    }
  }

  // Check inlet temperature vs saturation temperature
  const opPressureBar = kgCm2GaugeToBar(input.operatingPressure);
  const satTemp = getSaturationTemperature(opPressureBar);
  const bpe = getBoilingPointElevation(input.seawaterSalinity, satTemp);
  const effectiveSatTemp = satTemp + bpe;

  if (input.inletTemperature <= effectiveSatTemp) {
    errors.push(
      `Inlet temperature (${input.inletTemperature}°C) must be greater than saturation temperature (${effectiveSatTemp.toFixed(1)}°C including BPE) for flash evaporation`
    );
  }

  // Warning if temperature difference is small
  const deltaT = input.inletTemperature - effectiveSatTemp;
  if (deltaT < 5) {
    warnings.push(
      `Small temperature approach (${deltaT.toFixed(1)}°C) may result in low vapor production`
    );
  }

  // Check velocities
  if (
    input.inletWaterVelocity < limits.inletWaterVelocity.min ||
    input.inletWaterVelocity > limits.inletWaterVelocity.max
  ) {
    warnings.push(
      `Inlet velocity ${input.inletWaterVelocity} m/s is outside typical range (${limits.inletWaterVelocity.min}-${limits.inletWaterVelocity.max} m/s)`
    );
  }

  if (
    input.outletWaterVelocity < limits.outletWaterVelocity.min ||
    input.outletWaterVelocity > limits.outletWaterVelocity.max
  ) {
    warnings.push(
      `Outlet velocity ${input.outletWaterVelocity} m/s is outside typical range (${limits.outletWaterVelocity.min}-${limits.outletWaterVelocity.max} m/s)`
    );
  }

  if (
    input.vaporVelocity < limits.vaporVelocity.min ||
    input.vaporVelocity > limits.vaporVelocity.max
  ) {
    warnings.push(
      `Vapor velocity ${input.vaporVelocity} m/s is outside typical range (${limits.vaporVelocity.min}-${limits.vaporVelocity.max} m/s)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate complete flash chamber design
 *
 * @param input - Flash chamber input parameters
 * @param pipes - Optional pipe variants (uses static data if not provided)
 * @returns Complete calculation result
 */
export function calculateFlashChamber(
  input: FlashChamberInput,
  pipes?: PipeVariant[]
): FlashChamberResult {
  const warnings: string[] = [];

  // Validate inputs
  const validation = validateFlashChamberInput(input);
  if (!validation.isValid) {
    throw new Error(`Invalid input: ${validation.errors.join('; ')}`);
  }
  warnings.push(...validation.warnings);

  // Use provided pipes or fallback to static data
  const availablePipes = pipes || SCHEDULE_40_PIPES;

  // Step 1: Determine operating conditions
  const opPressureBar = kgCm2GaugeToBar(input.operatingPressure);
  const opPressureAbs = input.operatingPressure + 1.033; // kg/cm²(a)
  const satTempPure = getSaturationTemperature(opPressureBar);
  const bpe = getBoilingPointElevation(input.seawaterSalinity, satTempPure);
  const satTemp = satTempPure + bpe; // Effective saturation temperature with BPE

  // Step 2: Calculate mass flows based on mode
  let waterFlow: number;
  let vaporFlow: number;
  let brineFlow: number;

  if (input.mode === 'WATER_FLOW') {
    waterFlow = input.waterFlowRate!;

    // Calculate vapor from heat balance
    // Q_in = m_water * h_inlet
    // Q_out = m_vapor * h_vapor + m_brine * h_brine
    // m_water = m_vapor + m_brine

    const inletEnthalpy = getSeawaterEnthalpy(input.seawaterSalinity, input.inletTemperature);
    const brineEnthalpy = getSeawaterEnthalpy(input.seawaterSalinity, satTemp);
    const vaporEnthalpy = getEnthalpyVapor(satTempPure);

    // Energy balance: m_water * h_inlet = m_vapor * h_vapor + (m_water - m_vapor) * h_brine
    // Solving for m_vapor:
    // m_vapor = m_water * (h_inlet - h_brine) / (h_vapor - h_brine)
    vaporFlow = (waterFlow * (inletEnthalpy - brineEnthalpy)) / (vaporEnthalpy - brineEnthalpy);

    brineFlow = waterFlow - vaporFlow;
  } else {
    // VAPOR_QUANTITY mode - back-calculate water flow
    vaporFlow = input.vaporQuantity!;

    const inletEnthalpy = getSeawaterEnthalpy(input.seawaterSalinity, input.inletTemperature);
    const brineEnthalpy = getSeawaterEnthalpy(input.seawaterSalinity, satTemp);
    const vaporEnthalpy = getEnthalpyVapor(satTempPure);

    // From energy balance:
    // m_water = m_vapor * (h_vapor - h_brine) / (h_inlet - h_brine)
    waterFlow = (vaporFlow * (vaporEnthalpy - brineEnthalpy)) / (inletEnthalpy - brineEnthalpy);

    brineFlow = waterFlow - vaporFlow;
  }

  // Calculate brine salinity
  const brineSalinity = getBrineSalinity(input.seawaterSalinity, waterFlow, vaporFlow);

  // Check for excessive concentration
  if (brineSalinity > 70000) {
    warnings.push(
      `Brine salinity (${(brineSalinity / 1000).toFixed(1)} g/kg) is very high. Consider scaling prevention.`
    );
  }

  // Step 3: Build heat and mass balance
  const heatMassBalance = calculateHeatMassBalance(
    waterFlow,
    vaporFlow,
    brineFlow,
    input.inletTemperature,
    satTemp,
    satTempPure,
    opPressureAbs,
    input.seawaterSalinity,
    brineSalinity
  );

  // Step 4: Size chamber
  const chamberSizing = calculateChamberSize(waterFlow, input);

  // Step 5: Size nozzles
  const nozzles = calculateNozzleSizes(
    waterFlow,
    brineFlow,
    vaporFlow,
    input,
    satTemp,
    satTempPure,
    brineSalinity,
    availablePipes
  );

  // Check for velocity warnings
  nozzles.forEach((nozzle) => {
    if (nozzle.velocityStatus === 'HIGH') {
      warnings.push(
        `${nozzle.name} velocity (${nozzle.actualVelocity.toFixed(2)} m/s) exceeds recommended maximum`
      );
    } else if (nozzle.velocityStatus === 'LOW') {
      warnings.push(
        `${nozzle.name} velocity (${nozzle.actualVelocity.toFixed(2)} m/s) is below recommended minimum`
      );
    }
  });

  // Step 6: Calculate NPSHa
  const npsha = calculateNPSHa(chamberSizing, satTempPure);

  return {
    inputs: input,
    heatMassBalance,
    chamberSizing,
    nozzles,
    npsha,
    calculatedAt: new Date(),
    warnings,
    metadata: {
      steamTableSource: 'IAPWS-IF97',
      seawaterSource: 'MIT',
      calculatorVersion: CALCULATOR_VERSION,
    },
  };
}

// ============================================================================
// Heat and Mass Balance
// ============================================================================

/**
 * Calculate heat and mass balance
 */
function calculateHeatMassBalance(
  waterFlow: number,
  vaporFlow: number,
  brineFlow: number,
  inletTemp: number,
  satTemp: number,
  satTempPure: number,
  opPressureAbs: number,
  inletSalinity: number,
  brineSalinity: number
): HeatMassBalance {
  // Get enthalpies
  const inletEnthalpy = getSeawaterEnthalpy(inletSalinity, inletTemp);
  const brineEnthalpy = getSeawaterEnthalpy(brineSalinity, satTemp);
  const vaporEnthalpy = getEnthalpyVapor(satTempPure);

  // Calculate heat duties (kW)
  // Q = m * h (where m is in ton/hr, h is in kJ/kg)
  // Convert: ton/hr * kJ/kg = ton/hr * kJ/kg * (1000 kg/ton) / (3600 s/hr) = kW
  const inletHeatDuty = (waterFlow * 1000 * inletEnthalpy) / 3600;
  const vaporHeatDuty = (vaporFlow * 1000 * vaporEnthalpy) / 3600;
  const brineHeatDuty = (brineFlow * 1000 * brineEnthalpy) / 3600;

  // Create balance rows
  const inlet: HeatMassBalanceRow = {
    stream: 'Seawater Inlet',
    flowRate: waterFlow,
    temperature: inletTemp,
    pressure: opPressureAbs + 0.5, // Assume some pressure drop
    enthalpy: inletEnthalpy,
    heatDuty: inletHeatDuty,
  };

  const vapor: HeatMassBalanceRow = {
    stream: 'Vapor Out',
    flowRate: vaporFlow,
    temperature: satTempPure, // Pure water saturation temp (vapor has no salt)
    pressure: opPressureAbs,
    enthalpy: vaporEnthalpy,
    heatDuty: vaporHeatDuty,
  };

  const brine: HeatMassBalanceRow = {
    stream: 'Brine Out',
    flowRate: brineFlow,
    temperature: satTemp, // Includes BPE
    pressure: opPressureAbs,
    enthalpy: brineEnthalpy,
    heatDuty: brineHeatDuty,
  };

  // Calculate balance
  const heatInput = inletHeatDuty;
  const heatOutput = vaporHeatDuty + brineHeatDuty;
  const balanceError = Math.abs((heatInput - heatOutput) / heatInput) * 100;
  const isBalanced = balanceError < 1; // Less than 1% error

  return {
    inlet,
    vapor,
    brine,
    heatInput,
    heatOutput,
    balanceError,
    isBalanced,
  };
}

// ============================================================================
// Chamber Sizing
// ============================================================================

/**
 * Calculate chamber dimensions
 */
function calculateChamberSize(waterFlow: number, input: FlashChamberInput): ChamberSizing {
  // Diameter: Based on cross-section loading (2 ton/hr/m²)
  const crossSectionArea = waterFlow / CROSS_SECTION_LOADING; // m²
  const diameterM = Math.sqrt((4 * crossSectionArea) / Math.PI); // m
  const diameterMM = diameterM * 1000; // mm

  // Round up to nearest 100mm for practical fabrication
  const roundedDiameter = Math.ceil(diameterMM / 100) * 100;

  // Recalculate cross-section with rounded diameter
  const actualCrossSectionArea = (Math.PI * Math.pow(roundedDiameter / 1000, 2)) / 4;

  // Retention zone height
  // Volume = flow rate * retention time
  // V = Q * t (where Q is in m³/min, t is in minutes)
  const inletDensity = getSeawaterDensity(input.seawaterSalinity, input.inletTemperature);
  const volumetricFlowM3Min = (waterFlow * 1000) / (inletDensity * 60); // m³/min
  const retentionVolume = volumetricFlowM3Min * input.retentionTime; // m³
  const retentionHeightM = retentionVolume / actualCrossSectionArea; // m
  const retentionHeightMM = retentionHeightM * 1000; // mm

  // Spray zone height (triangle calculation)
  // Height = radius × tan(angle/2) for a cone spray pattern
  const radiusMM = roundedDiameter / 2;
  const sprayAngleRad = (input.sprayAngle / 2) * (Math.PI / 180);
  const sprayZoneHeight = radiusMM * Math.tan(sprayAngleRad);

  // Total height
  const totalHeight = retentionHeightMM + input.flashingZoneHeight + sprayZoneHeight;

  // Total volume
  const totalVolume = actualCrossSectionArea * (totalHeight / 1000);

  return {
    diameter: roundedDiameter,
    crossSectionArea: actualCrossSectionArea,
    retentionZoneHeight: Math.round(retentionHeightMM),
    flashingZoneHeight: input.flashingZoneHeight,
    sprayZoneHeight: Math.round(sprayZoneHeight),
    totalHeight: Math.round(totalHeight),
    totalVolume,
    liquidHoldupVolume: retentionVolume,
  };
}

// ============================================================================
// Nozzle Sizing
// ============================================================================

/**
 * Calculate nozzle sizes for inlet, outlet, and vapor
 */
function calculateNozzleSizes(
  waterFlow: number,
  brineFlow: number,
  vaporFlow: number,
  input: FlashChamberInput,
  satTemp: number,
  satTempPure: number,
  brineSalinity: number,
  availablePipes: PipeVariant[]
): NozzleSizing[] {
  const nozzles: NozzleSizing[] = [];

  // 1. Inlet Nozzle
  const inletDensity = getSeawaterDensity(input.seawaterSalinity, input.inletTemperature);
  const inletVolumetricFlow = (waterFlow * 1000) / (inletDensity * 3600); // m³/s
  const inletRequiredArea = calculateRequiredArea(
    waterFlow,
    inletDensity,
    input.inletWaterVelocity
  );

  const inletPipe = selectPipeByVelocity(
    inletVolumetricFlow,
    input.inletWaterVelocity,
    { min: 1.5, max: 4.0 },
    availablePipes
  );

  nozzles.push({
    type: 'inlet',
    name: 'Seawater Inlet',
    requiredArea: inletRequiredArea,
    calculatedDiameter: Math.sqrt((4 * inletRequiredArea) / Math.PI),
    selectedPipeSize: inletPipe.displayName,
    nps: inletPipe.nps,
    actualID: inletPipe.id_mm,
    actualVelocity: inletPipe.actualVelocity,
    velocityStatus: inletPipe.velocityStatus,
    velocityLimits: { min: 1.5, max: 4.0 },
  });

  // 2. Outlet (Brine) Nozzle
  const brineDensity = getSeawaterDensity(brineSalinity, satTemp);
  const brineVolumetricFlow = (brineFlow * 1000) / (brineDensity * 3600); // m³/s
  const brineRequiredArea = calculateRequiredArea(
    brineFlow,
    brineDensity,
    input.outletWaterVelocity
  );

  const brinePipe = selectPipeByVelocity(
    brineVolumetricFlow,
    input.outletWaterVelocity,
    { min: 0.5, max: 2.5 },
    availablePipes
  );

  nozzles.push({
    type: 'outlet',
    name: 'Brine Outlet',
    requiredArea: brineRequiredArea,
    calculatedDiameter: Math.sqrt((4 * brineRequiredArea) / Math.PI),
    selectedPipeSize: brinePipe.displayName,
    nps: brinePipe.nps,
    actualID: brinePipe.id_mm,
    actualVelocity: brinePipe.actualVelocity,
    velocityStatus: brinePipe.velocityStatus,
    velocityLimits: { min: 0.5, max: 2.5 },
  });

  // 3. Vapor Outlet Nozzle
  const vaporDensity = getDensityVapor(satTempPure);
  const vaporVolumetricFlow = (vaporFlow * 1000) / (vaporDensity * 3600); // m³/s
  const vaporRequiredArea = calculateRequiredArea(vaporFlow, vaporDensity, input.vaporVelocity);

  const vaporPipe = selectPipeByVelocity(
    vaporVolumetricFlow,
    input.vaporVelocity,
    { min: 5, max: 40 },
    availablePipes
  );

  nozzles.push({
    type: 'vapor',
    name: 'Vapor Outlet',
    requiredArea: vaporRequiredArea,
    calculatedDiameter: Math.sqrt((4 * vaporRequiredArea) / Math.PI),
    selectedPipeSize: vaporPipe.displayName,
    nps: vaporPipe.nps,
    actualID: vaporPipe.id_mm,
    actualVelocity: vaporPipe.actualVelocity,
    velocityStatus: vaporPipe.velocityStatus,
    velocityLimits: { min: 5, max: 40 },
  });

  return nozzles;
}

// ============================================================================
// NPSHa Calculation
// ============================================================================

/**
 * Calculate Net Positive Suction Head Available
 */
function calculateNPSHa(chamberSizing: ChamberSizing, satTempPure: number): NPSHaCalculation {
  // Static head: Liquid level above pump
  // Assume pump is at bottom of chamber, liquid level = retention zone
  const staticHead = chamberSizing.retentionZoneHeight / 1000; // Convert mm to m

  // Atmospheric pressure head (at sea level)
  const atmosphericPressure = ATM_PRESSURE_HEAD;

  // Vapor pressure at operating temperature (converted to head)
  const vaporPressureBar = getSaturationPressure(satTempPure);
  const vaporPressure = barToWaterHead(vaporPressureBar);

  // Estimated friction loss
  const frictionLoss = ESTIMATED_FRICTION_LOSS;

  // NPSHa = Static head + Atmospheric pressure - Vapor pressure - Friction loss
  const npshAvailable = staticHead + atmosphericPressure - vaporPressure - frictionLoss;

  // Generate recommendation
  let recommendation: string;
  if (npshAvailable >= 5) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(1)}m is excellent. Standard pumps suitable.`;
  } else if (npshAvailable >= 3) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(1)}m is adequate. Ensure pump NPSHr < ${(npshAvailable - MIN_NPSH_MARGIN).toFixed(1)}m.`;
  } else if (npshAvailable >= 1.5) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(1)}m is marginal. Consider low-NPSH pump or increase static head.`;
  } else {
    recommendation = `NPSHa of ${npshAvailable.toFixed(1)}m is insufficient. Requires submersible pump or significant elevation increase.`;
  }

  return {
    staticHead,
    atmosphericPressure,
    vaporPressure,
    frictionLoss,
    npshAvailable,
    recommendedNpshMargin: MIN_NPSH_MARGIN,
    recommendation,
  };
}

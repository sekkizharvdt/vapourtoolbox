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
  mbarAbsToBar,
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
  NPSHaAtLevel,
  FlashChamberElevations,
  FlowRateUnit,
} from '@vapour/types';
import { FLOW_RATE_CONVERSIONS } from '@vapour/types';

// ============================================================================
// Constants
// ============================================================================

/** Cross-section loading factor: ton/hr per m² of cross-section */
const CROSS_SECTION_LOADING = 2.0; // ton/hr/m²

/** Standard friction loss estimate for suction piping */
const ESTIMATED_FRICTION_LOSS = 0.5; // m

/** Minimum NPSHa margin recommended */
const MIN_NPSH_MARGIN = 1.5; // m

/** Calculator version for tracking */
const CALCULATOR_VERSION = '2.0.0';

// ============================================================================
// Flow Rate Conversion
// ============================================================================

/**
 * Convert flow rate from user-selected unit to ton/hr (internal calculation unit)
 *
 * @param value - Flow rate in user-selected unit
 * @param unit - User-selected flow rate unit
 * @returns Flow rate in ton/hr
 */
function convertToTonHr(value: number, unit: FlowRateUnit): number {
  switch (unit) {
    case 'KG_SEC':
      return value * FLOW_RATE_CONVERSIONS.KG_SEC_TO_TON_HR;
    case 'KG_HR':
      return value * FLOW_RATE_CONVERSIONS.KG_HR_TO_TON_HR;
    case 'TON_HR':
    default:
      return value;
  }
}

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

  // Limits for validation (pressure in mbar abs, flow rates in ton/hr after conversion)
  const limits = {
    operatingPressure: { min: 50, max: 500 }, // mbar abs
    waterFlowRate: { min: 1, max: 10000 }, // ton/hr (after conversion)
    vaporQuantity: { min: 0.1, max: 1000 }, // ton/hr (after conversion)
    inletTemperature: { min: 40, max: 120 },
    salinity: { min: 0, max: 70000 }, // 0 for DM water
    retentionTime: { min: 1, max: 5 },
    flashingZoneHeight: { min: 300, max: 1000 },
    sprayAngle: { min: 70, max: 100 }, // Wider angle = shorter spray zone
    inletWaterVelocity: { min: 1.5, max: 4.0 },
    outletWaterVelocity: { min: 0.01, max: 0.1 }, // Very low to minimize vortexing
    vaporVelocity: { min: 5, max: 40 },
    pumpCenterlineAboveFFL: { min: 0.3, max: 2.0 },
    operatingLevelAbovePump: { min: 2.0, max: 15.0 },
    operatingLevelRatio: { min: 0.2, max: 0.8 },
    btlGapBelowLGL: { min: 0.05, max: 0.5 },
  };

  // Check operating pressure (mbar abs)
  if (
    input.operatingPressure < limits.operatingPressure.min ||
    input.operatingPressure > limits.operatingPressure.max
  ) {
    errors.push(
      `Operating pressure must be between ${limits.operatingPressure.min} and ${limits.operatingPressure.max} mbar abs`
    );
  }

  // Convert flow rates to ton/hr for validation
  const waterFlowTonHr = input.waterFlowRate
    ? convertToTonHr(input.waterFlowRate, input.flowRateUnit)
    : 0;
  const vaporFlowTonHr = input.vaporQuantity
    ? convertToTonHr(input.vaporQuantity, input.flowRateUnit)
    : 0;

  // Check mode-specific inputs
  if (input.mode === 'WATER_FLOW') {
    if (!input.waterFlowRate || input.waterFlowRate <= 0) {
      errors.push('Water flow rate is required when mode is WATER_FLOW');
    } else if (
      waterFlowTonHr < limits.waterFlowRate.min ||
      waterFlowTonHr > limits.waterFlowRate.max
    ) {
      errors.push(
        `Water flow rate must be between ${limits.waterFlowRate.min} and ${limits.waterFlowRate.max} ton/hr (converted value: ${waterFlowTonHr.toFixed(2)} ton/hr)`
      );
    }
  } else {
    if (!input.vaporQuantity || input.vaporQuantity <= 0) {
      errors.push('Vapor quantity is required when mode is VAPOR_QUANTITY');
    } else if (
      vaporFlowTonHr < limits.vaporQuantity.min ||
      vaporFlowTonHr > limits.vaporQuantity.max
    ) {
      errors.push(
        `Vapor quantity must be between ${limits.vaporQuantity.min} and ${limits.vaporQuantity.max} ton/hr (converted value: ${vaporFlowTonHr.toFixed(2)} ton/hr)`
      );
    }
  }

  // Check salinity based on water type
  if (input.waterType === 'SEAWATER' && input.salinity < 1000) {
    warnings.push('Seawater salinity is unusually low (< 1000 ppm). Consider using DM Water type.');
  }
  if (input.waterType === 'DM_WATER' && input.salinity > 0) {
    warnings.push('DM water should have zero salinity. Salinity will be treated as 0.');
  }

  // Use effective salinity (0 for DM water)
  const effectiveSalinity = input.waterType === 'DM_WATER' ? 0 : input.salinity;

  // Check inlet temperature vs saturation temperature
  // Convert mbar abs to bar for steam table lookup
  const opPressureBar = mbarAbsToBar(input.operatingPressure);
  const satTemp = getSaturationTemperature(opPressureBar);
  const bpe = getBoilingPointElevation(effectiveSalinity, satTemp);
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
// Elevation Calculation
// ============================================================================

/**
 * Calculate elevation data for engineering diagram
 * All elevations are relative to FFL (Finished Floor Level) = 0.000
 *
 * New calculation logic:
 * 1. FFL = 0.000 m (reference datum)
 * 2. Pump Centerline = pumpCenterlineAboveFFL (above FFL)
 * 3. Operating Level = Pump + operatingLevelAbovePump
 * 4. Retention zone is centered around Operating Level based on ratio
 * 5. BTL = LG-L - btlGapBelowLGL
 *
 * @param chamberSizing - Chamber dimension results
 * @param input - Flash chamber input parameters
 * @returns Elevation data for diagram
 */
function calculateElevations(
  chamberSizing: ChamberSizing,
  input: FlashChamberInput
): FlashChamberElevations {
  // Reference point: FFL = 0.000 m
  const ffl = 0;

  // Pump centerline is above FFL
  const pumpCenterline = input.pumpCenterlineAboveFFL;

  // Operating level is above pump
  const operatingLevel = pumpCenterline + input.operatingLevelAbovePump;

  // Convert zone heights from mm to m
  const retentionZoneHeightM = chamberSizing.retentionZoneHeight / 1000;
  const flashingZoneHeightM = chamberSizing.flashingZoneHeight / 1000;
  const sprayZoneHeightM = chamberSizing.sprayZoneHeight / 1000;

  // Calculate LG-L and LG-H based on operating level ratio
  // ratio = (Operating - LG-L) / (LG-H - LG-L)
  // Therefore:
  // LG-L = Operating - (retentionHeight * ratio)
  // LG-H = Operating + (retentionHeight * (1 - ratio))
  const ratio = input.operatingLevelRatio;
  const lgLow = operatingLevel - retentionZoneHeightM * ratio;
  const lgHigh = operatingLevel + retentionZoneHeightM * (1 - ratio);

  // BTL is below LG-L by the specified gap
  const btl = lgLow - input.btlGapBelowLGL;

  // Flashing zone starts at LG-H (top of retention zone)
  const flashingZoneBottom = lgHigh;
  const flashingZoneTop = flashingZoneBottom + flashingZoneHeightM;

  // TTL = Flashing zone top + spray zone
  const ttl = flashingZoneTop + sprayZoneHeightM;

  // Nozzle elevations
  const nozzleElevations = {
    // Inlet nozzle (N1): In spray zone, roughly 50% up
    inlet: flashingZoneTop + sprayZoneHeightM * 0.5,
    // Vapor outlet (N2): At top of chamber
    vaporOutlet: ttl,
    // Brine outlet (N3): At BTL level
    brineOutlet: btl,
  };

  return {
    ffl,
    pumpCenterline,
    btl,
    lgLow,
    operatingLevel,
    lgHigh,
    flashingZoneBottom,
    flashingZoneTop,
    ttl,
    nozzleElevations,
    retentionZoneHeightM,
    flashingZoneHeightM,
    sprayZoneHeightM,
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

  // Determine effective salinity (0 for DM water)
  const effectiveSalinity = input.waterType === 'DM_WATER' ? 0 : input.salinity;

  // Step 1: Determine operating conditions
  // Input is in mbar abs, convert to bar for steam table lookup
  const opPressureBar = mbarAbsToBar(input.operatingPressure);
  const opPressureMbar = input.operatingPressure; // Already in mbar abs
  const satTempPure = getSaturationTemperature(opPressureBar);
  const bpe = getBoilingPointElevation(effectiveSalinity, satTempPure);
  const satTemp = satTempPure + bpe; // Effective saturation temperature with BPE

  // Step 2: Calculate mass flows based on mode (convert to ton/hr for calculations)
  let waterFlow: number; // ton/hr
  let vaporFlow: number; // ton/hr
  let brineFlow: number; // ton/hr

  if (input.mode === 'WATER_FLOW') {
    // Convert user input to ton/hr
    waterFlow = convertToTonHr(input.waterFlowRate!, input.flowRateUnit);

    // Calculate vapor from heat balance
    // Q_in = m_water * h_inlet
    // Q_out = m_vapor * h_vapor + m_brine * h_brine
    // m_water = m_vapor + m_brine

    const inletEnthalpy = getSeawaterEnthalpy(effectiveSalinity, input.inletTemperature);
    const brineEnthalpy = getSeawaterEnthalpy(effectiveSalinity, satTemp);
    const vaporEnthalpy = getEnthalpyVapor(satTempPure);

    // Energy balance: m_water * h_inlet = m_vapor * h_vapor + (m_water - m_vapor) * h_brine
    // Solving for m_vapor:
    // m_vapor = m_water * (h_inlet - h_brine) / (h_vapor - h_brine)
    vaporFlow = (waterFlow * (inletEnthalpy - brineEnthalpy)) / (vaporEnthalpy - brineEnthalpy);

    brineFlow = waterFlow - vaporFlow;
  } else {
    // VAPOR_QUANTITY mode - back-calculate water flow
    // Convert user input to ton/hr
    vaporFlow = convertToTonHr(input.vaporQuantity!, input.flowRateUnit);

    const inletEnthalpy = getSeawaterEnthalpy(effectiveSalinity, input.inletTemperature);
    const brineEnthalpy = getSeawaterEnthalpy(effectiveSalinity, satTemp);
    const vaporEnthalpy = getEnthalpyVapor(satTempPure);

    // From energy balance:
    // m_water = m_vapor * (h_vapor - h_brine) / (h_inlet - h_brine)
    waterFlow = (vaporFlow * (vaporEnthalpy - brineEnthalpy)) / (inletEnthalpy - brineEnthalpy);

    brineFlow = waterFlow - vaporFlow;
  }

  // Calculate brine salinity (only relevant for seawater)
  const brineSalinity =
    input.waterType === 'DM_WATER' ? 0 : getBrineSalinity(effectiveSalinity, waterFlow, vaporFlow);

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
    opPressureMbar,
    effectiveSalinity,
    brineSalinity,
    input.waterType
  );

  // Step 4: Size chamber
  const chamberSizing = calculateChamberSize(
    waterFlow,
    vaporFlow,
    satTempPure,
    input,
    effectiveSalinity
  );

  // Add warning if vapor velocity is high
  if (chamberSizing.vaporVelocityStatus === 'HIGH') {
    warnings.push(
      `Vapor velocity (${chamberSizing.vaporVelocity.toFixed(2)} m/s) is elevated. Consider a larger diameter or mist eliminator.`
    );
  } else if (chamberSizing.vaporVelocityStatus === 'VERY_HIGH') {
    warnings.push(
      `Vapor velocity (${chamberSizing.vaporVelocity.toFixed(2)} m/s) is too high - risk of liquid entrainment. Increase chamber diameter.`
    );
  }

  // Step 5: Size nozzles
  const nozzles = calculateNozzleSizes(
    waterFlow,
    brineFlow,
    vaporFlow,
    input,
    satTemp,
    satTempPure,
    effectiveSalinity,
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

  // Step 6: Calculate elevations for engineering diagram (needs to be before NPSHa)
  const elevations = calculateElevations(chamberSizing, input);

  // Step 7: Calculate NPSHa at three levels
  const npsha = calculateNPSHa(elevations, opPressureBar, satTempPure);

  return {
    inputs: input,
    heatMassBalance,
    chamberSizing,
    nozzles,
    npsha,
    elevations,
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
 * @param opPressureMbar - Operating pressure in mbar absolute
 * @param waterType - Type of water (seawater or DM water)
 */
function calculateHeatMassBalance(
  waterFlow: number,
  vaporFlow: number,
  brineFlow: number,
  inletTemp: number,
  satTemp: number,
  satTempPure: number,
  opPressureMbar: number,
  inletSalinity: number,
  brineSalinity: number,
  waterType: 'SEAWATER' | 'DM_WATER'
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

  // Use appropriate stream names based on water type
  const inletStreamName = waterType === 'SEAWATER' ? 'Seawater Inlet' : 'DM Water Inlet';
  const outletStreamName = waterType === 'SEAWATER' ? 'Brine Out' : 'Water Out';

  // Create balance rows (pressure in mbar abs)
  const inlet: HeatMassBalanceRow = {
    stream: inletStreamName,
    flowRate: waterFlow,
    temperature: inletTemp,
    pressure: opPressureMbar + 50, // Assume ~50 mbar pressure drop at inlet
    enthalpy: inletEnthalpy,
    heatDuty: inletHeatDuty,
  };

  const vapor: HeatMassBalanceRow = {
    stream: 'Vapor Out',
    flowRate: vaporFlow,
    temperature: satTempPure, // Pure water saturation temp (vapor has no salt)
    pressure: opPressureMbar,
    enthalpy: vaporEnthalpy,
    heatDuty: vaporHeatDuty,
  };

  const brine: HeatMassBalanceRow = {
    stream: outletStreamName,
    flowRate: brineFlow,
    temperature: satTemp, // Includes BPE (0 for DM water)
    pressure: opPressureMbar,
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
 * @param waterFlow - Water flow rate in ton/hr
 * @param vaporFlow - Vapor flow rate in ton/hr
 * @param satTempPure - Saturation temperature of pure water at operating pressure in °C
 * @param input - Flash chamber input parameters
 * @param effectiveSalinity - Effective salinity (0 for DM water)
 */
function calculateChamberSize(
  waterFlow: number,
  vaporFlow: number,
  satTempPure: number,
  input: FlashChamberInput,
  effectiveSalinity: number
): ChamberSizing {
  let roundedDiameter: number;

  if (input.autoCalculateDiameter !== false && !input.userDiameter) {
    // Diameter: Based on cross-section loading (2 ton/hr/m²)
    const crossSectionArea = waterFlow / CROSS_SECTION_LOADING; // m²
    const diameterM = Math.sqrt((4 * crossSectionArea) / Math.PI); // m
    const diameterMM = diameterM * 1000; // mm

    // Round up to nearest 100mm for practical fabrication
    roundedDiameter = Math.ceil(diameterMM / 100) * 100;
  } else if (input.autoCalculateDiameter === false && input.userDiameter) {
    // Use user-specified diameter
    roundedDiameter = input.userDiameter;
  } else {
    // Auto-calculate as fallback
    const crossSectionArea = waterFlow / CROSS_SECTION_LOADING; // m²
    const diameterM = Math.sqrt((4 * crossSectionArea) / Math.PI); // m
    const diameterMM = diameterM * 1000; // mm
    roundedDiameter = Math.ceil(diameterMM / 100) * 100;
  }

  // Recalculate cross-section with rounded diameter
  const actualCrossSectionArea = (Math.PI * Math.pow(roundedDiameter / 1000, 2)) / 4;

  // Retention zone height
  // Volume = flow rate * retention time
  // V = Q * t (where Q is in m³/min, t is in minutes)
  const inletDensity = getSeawaterDensity(effectiveSalinity, input.inletTemperature);
  const volumetricFlowM3Min = (waterFlow * 1000) / (inletDensity * 60); // m³/min
  const retentionVolume = volumetricFlowM3Min * input.retentionTime; // m³
  const retentionHeightM = retentionVolume / actualCrossSectionArea; // m
  const retentionHeightMM = retentionHeightM * 1000; // mm

  // Spray zone height (triangle calculation)
  // Height = radius / tan(angle/2) for a cone spray pattern
  // A wider spray angle means the spray reaches the wall sooner (shorter vertical travel)
  const radiusMM = roundedDiameter / 2;
  const sprayAngleRad = (input.sprayAngle / 2) * (Math.PI / 180);
  const sprayZoneHeight = radiusMM / Math.tan(sprayAngleRad);

  // Total height
  const totalHeight = retentionHeightMM + input.flashingZoneHeight + sprayZoneHeight;

  // Total volume
  const totalVolume = actualCrossSectionArea * (totalHeight / 1000);

  // Calculate vapor velocity through chamber cross-section
  // This is critical for proper liquid-vapor separation
  // Velocity = volumetric flow / cross-section area
  const vaporDensity = getDensityVapor(satTempPure); // kg/m³
  const vaporVolumetricFlow = (vaporFlow * 1000) / (vaporDensity * 3600); // m³/s
  const vaporVelocity = vaporVolumetricFlow / actualCrossSectionArea; // m/s

  // Determine vapor velocity status
  // Industry guidelines for flash chambers:
  // < 0.5 m/s: Good - minimal liquid entrainment
  // 0.5 - 1.0 m/s: High - may cause some entrainment, consider mist eliminator
  // > 1.0 m/s: Very high - significant entrainment risk
  let vaporVelocityStatus: 'OK' | 'HIGH' | 'VERY_HIGH';
  if (vaporVelocity <= 0.5) {
    vaporVelocityStatus = 'OK';
  } else if (vaporVelocity <= 1.0) {
    vaporVelocityStatus = 'HIGH';
  } else {
    vaporVelocityStatus = 'VERY_HIGH';
  }

  // Calculate vapor loading (ton/hr/m²)
  // This is the vapor flow rate per unit cross-section area
  // Comparable to CROSS_SECTION_LOADING (2.0) used for water flow
  const vaporLoading = vaporFlow / actualCrossSectionArea; // ton/hr/m²

  return {
    diameter: roundedDiameter,
    crossSectionArea: actualCrossSectionArea,
    retentionZoneHeight: Math.round(retentionHeightMM),
    flashingZoneHeight: input.flashingZoneHeight,
    sprayZoneHeight: Math.round(sprayZoneHeight),
    totalHeight: Math.round(totalHeight),
    totalVolume,
    liquidHoldupVolume: retentionVolume,
    vaporVelocity,
    vaporVelocityStatus,
    vaporLoading,
  };
}

// ============================================================================
// Nozzle Sizing
// ============================================================================

/**
 * Calculate nozzle sizes for inlet, outlet, and vapor
 * @param effectiveSalinity - Effective inlet salinity (0 for DM water)
 */
function calculateNozzleSizes(
  waterFlow: number,
  brineFlow: number,
  vaporFlow: number,
  input: FlashChamberInput,
  satTemp: number,
  satTempPure: number,
  effectiveSalinity: number,
  brineSalinity: number,
  availablePipes: PipeVariant[]
): NozzleSizing[] {
  const nozzles: NozzleSizing[] = [];

  // Use appropriate nozzle names based on water type
  const inletNozzleName = input.waterType === 'SEAWATER' ? 'Seawater Inlet' : 'DM Water Inlet';
  const outletNozzleName = input.waterType === 'SEAWATER' ? 'Brine Outlet' : 'Water Outlet';

  // 1. Inlet Nozzle
  const inletDensity = getSeawaterDensity(effectiveSalinity, input.inletTemperature);
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
    name: inletNozzleName,
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
    { min: 0.01, max: 0.1 }, // Very low to minimize vortexing
    availablePipes
  );

  nozzles.push({
    type: 'outlet',
    name: outletNozzleName,
    requiredArea: brineRequiredArea,
    calculatedDiameter: Math.sqrt((4 * brineRequiredArea) / Math.PI),
    selectedPipeSize: brinePipe.displayName,
    nps: brinePipe.nps,
    actualID: brinePipe.id_mm,
    actualVelocity: brinePipe.actualVelocity,
    velocityStatus: brinePipe.velocityStatus,
    velocityLimits: { min: 0.01, max: 0.1 }, // Very low to minimize vortexing
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
 * Calculate Net Positive Suction Head Available at three levels for vacuum flash chamber
 *
 * For a closed vacuum vessel, NPSHa is calculated as:
 * NPSHa = Static Head + Chamber Pressure Head - Vapor Pressure Head - Friction Loss
 *
 * Note: Atmospheric pressure does NOT act on the liquid in a closed vacuum system.
 * The driving pressure is the chamber operating pressure.
 *
 * @param elevations - Calculated elevation data
 * @param chamberPressureBar - Operating pressure of chamber in bar (absolute)
 * @param satTempPure - Saturation temperature of pure water at operating pressure in °C
 */
function calculateNPSHa(
  elevations: FlashChamberElevations,
  chamberPressureBar: number,
  satTempPure: number
): NPSHaCalculation {
  // Chamber pressure converted to head (this is the pressure acting on liquid surface)
  const chamberPressureHead = barToWaterHead(chamberPressureBar);

  // Vapor pressure at operating temperature (converted to head)
  // At saturation, vapor pressure = chamber pressure, so this will be nearly equal
  const vaporPressureBar = getSaturationPressure(satTempPure);
  const vaporPressureHead = barToWaterHead(vaporPressureBar);

  // Estimated friction loss in suction piping
  const frictionLoss = ESTIMATED_FRICTION_LOSS;

  // Helper function to calculate NPSHa at a given level
  const calculateAtLevel = (levelName: string, levelElevation: number): NPSHaAtLevel => {
    // Static head = level elevation - pump centerline
    const staticHead = levelElevation - elevations.pumpCenterline;
    // NPSHa = Static head + Chamber Pressure - Vapor Pressure - Friction loss
    const npshAvailable = staticHead + chamberPressureHead - vaporPressureHead - frictionLoss;

    return {
      levelName,
      elevation: levelElevation,
      staticHead,
      npshAvailable,
    };
  };

  // Calculate at three levels
  const atLGL = calculateAtLevel('LG-L (Low Level)', elevations.lgLow);
  const atOperating = calculateAtLevel('Operating Level', elevations.operatingLevel);
  const atLGH = calculateAtLevel('LG-H (High Level)', elevations.lgHigh);

  // Generate recommendation based on worst case (LG-L)
  const worstCaseNPSHa = atLGL.npshAvailable;

  let recommendation: string;
  if (worstCaseNPSHa < 0) {
    recommendation = `NPSHa at LG-L (${worstCaseNPSHa.toFixed(2)}m) is NEGATIVE. Pump cannot operate at minimum level. Submersible pump or barometric leg required.`;
  } else if (worstCaseNPSHa < 0.5) {
    recommendation = `NPSHa at LG-L (${worstCaseNPSHa.toFixed(2)}m) is critically low. Submersible pump strongly recommended.`;
  } else if (worstCaseNPSHa < 1.5) {
    recommendation = `NPSHa at LG-L (${worstCaseNPSHa.toFixed(2)}m) is marginal for vacuum service. Low-NPSH pump recommended.`;
  } else if (worstCaseNPSHa < 3) {
    recommendation = `NPSHa at LG-L (${worstCaseNPSHa.toFixed(2)}m) is adequate. Select pump with NPSHr < ${(worstCaseNPSHa - MIN_NPSH_MARGIN).toFixed(1)}m. Operating level provides ${atOperating.npshAvailable.toFixed(2)}m.`;
  } else {
    recommendation = `NPSHa at LG-L (${worstCaseNPSHa.toFixed(2)}m) is good for vacuum service. Operating level provides ${atOperating.npshAvailable.toFixed(2)}m.`;
  }

  return {
    atLGL,
    atOperating,
    atLGH,
    chamberPressureHead,
    vaporPressureHead,
    frictionLoss,
    recommendedNpshMargin: MIN_NPSH_MARGIN,
    recommendation,
  };
}

// TODO: Flash chamber calculator to be redesigned with full suction system integration

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
  getDensityLiquid,
  mbarAbsToBar,
  getSeawaterDensity,
  getSeawaterEnthalpy,
  getBoilingPointElevation,
  getBrineSalinity,
} from '@vapour/constants';

import {
  selectPipeByVelocity,
  calculateRequiredPipeArea,
  SCHEDULE_40_PIPES,
  type PipeVariant,
} from './pipeService';
import { tonHrToKgS, tonHrToM3S, barToHead } from './thermalUtils';

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

/** Vapour cross-section loading criterion: ton/hr of vapour per m² of cross-section area */
const CROSS_SECTION_LOADING = 2.0; // ton/hr/m² (vapour)

/**
 * Souders-Brown K factors by demister type (m/s).
 * The allowable vapour velocity is: u_SB = K × √((ρL − ρV) / ρV)
 * Source: Perry's Chemical Engineers' Handbook; El-Dessouky & Ettouney (2002)
 */
const SB_K_FACTOR: Record<string, number> = {
  NONE: 0.05, // No demister — conservative
  WIRE_MESH: 0.09, // Wire-mesh pad — common default
  VANE: 0.15, // Vane-type — high-capacity
};

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
    const vaporEnthalpy = getEnthalpyVapor(satTempPure);

    // First pass: use inlet salinity as approximation for brine enthalpy
    const brineEnthalpyApprox = getSeawaterEnthalpy(effectiveSalinity, satTemp);
    vaporFlow =
      (waterFlow * (inletEnthalpy - brineEnthalpyApprox)) / (vaporEnthalpy - brineEnthalpyApprox);
    brineFlow = waterFlow - vaporFlow;

    // One refinement: recalculate brine enthalpy with concentrated brine salinity
    // This closes the circularity: brine salinity depends on vapor flow which depends on brine enthalpy
    const brineSalinityEst = getBrineSalinity(effectiveSalinity, waterFlow, vaporFlow);
    const brineEnthalpyFinal = getSeawaterEnthalpy(brineSalinityEst, satTemp);
    vaporFlow =
      (waterFlow * (inletEnthalpy - brineEnthalpyFinal)) / (vaporEnthalpy - brineEnthalpyFinal);
    brineFlow = waterFlow - vaporFlow;
  } else {
    // VAPOR_QUANTITY mode - back-calculate water flow
    // Convert user input to ton/hr
    vaporFlow = convertToTonHr(input.vaporQuantity!, input.flowRateUnit);

    const inletEnthalpy = getSeawaterEnthalpy(effectiveSalinity, input.inletTemperature);
    const vaporEnthalpy = getEnthalpyVapor(satTempPure);

    // First pass: use inlet salinity as approximation for brine enthalpy
    const brineEnthalpyApprox = getSeawaterEnthalpy(effectiveSalinity, satTemp);
    waterFlow =
      (vaporFlow * (vaporEnthalpy - brineEnthalpyApprox)) / (inletEnthalpy - brineEnthalpyApprox);
    brineFlow = waterFlow - vaporFlow;

    // One refinement: recalculate brine enthalpy with concentrated brine salinity
    const brineSalinityEst = getBrineSalinity(effectiveSalinity, waterFlow, vaporFlow);
    const brineEnthalpyFinal = getSeawaterEnthalpy(brineSalinityEst, satTemp);
    waterFlow =
      (vaporFlow * (vaporEnthalpy - brineEnthalpyFinal)) / (inletEnthalpy - brineEnthalpyFinal);
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

  // Add warning if vapor velocity approaches or exceeds the Souders-Brown limit
  if (chamberSizing.vaporVelocityStatus === 'HIGH') {
    warnings.push(
      `Vapor velocity (${chamberSizing.vaporVelocity.toFixed(3)} m/s) approaching SB limit (${chamberSizing.sbMaxVelocity.toFixed(3)} m/s). Consider larger diameter.`
    );
  } else if (chamberSizing.vaporVelocityStatus === 'VERY_HIGH') {
    warnings.push(
      `Vapor velocity (${chamberSizing.vaporVelocity.toFixed(3)} m/s) exceeds SB limit (${chamberSizing.sbMaxVelocity.toFixed(3)} m/s) — liquid entrainment risk. Increase diameter.`
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
  // Q = m_kgS * h_kJkg = kW
  const inletHeatDuty = tonHrToKgS(waterFlow) * inletEnthalpy;
  const vaporHeatDuty = tonHrToKgS(vaporFlow) * vaporEnthalpy;
  const brineHeatDuty = tonHrToKgS(brineFlow) * brineEnthalpy;

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
  // -------------------------------------------------------------------
  // Step A: Fluid properties at operating conditions
  // -------------------------------------------------------------------
  const liquidDensity = getDensityLiquid(satTempPure); // kg/m³ (pure water at sat. temp)
  const vaporDensity = getDensityVapor(satTempPure); // kg/m³
  const vaporVolumetricFlow = tonHrToM3S(vaporFlow, vaporDensity); // m³/s

  // -------------------------------------------------------------------
  // Step B: Vapour-loading criterion diameter (D_VL)
  // 2.0 ton/hr/m² is the allowable vapour loading through the chamber
  // cross-section — i.e. vapour flow / cross-section area.
  // (NOT water/liquid flow — liquid falls by gravity; only vapour rises.)
  // -------------------------------------------------------------------
  const areaVL = vaporFlow / CROSS_SECTION_LOADING; // m²
  const dVL_m = Math.sqrt((4 * areaVL) / Math.PI); // m
  const vaporLoadingDiameter = Math.ceil((dVL_m * 1000) / 100) * 100; // mm, rounded up to 100mm

  // -------------------------------------------------------------------
  // Step C: Souders-Brown vapour-velocity criterion diameter (D_SB)
  // u_SB = K × √((ρL − ρV) / ρV)   [Perry's; El-Dessouky & Ettouney]
  // K factors: NONE=0.05, WIRE_MESH=0.09, VANE=0.15  (m/s)
  // At 200–300 mbar(a) these give u_SB ≈ 3.6–13 m/s actual velocity.
  // -------------------------------------------------------------------
  const kFactor = SB_K_FACTOR[input.demisterType ?? 'WIRE_MESH'] ?? 0.09; // fallback = WIRE_MESH
  const sbMaxVelocity = kFactor * Math.sqrt((liquidDensity - vaporDensity) / vaporDensity);
  const aSB = vaporVolumetricFlow / sbMaxVelocity; // m²
  const dSB_m = Math.sqrt((4 * aSB) / Math.PI); // m
  const vaporVelocityDiameter = Math.ceil((dSB_m * 1000) / 100) * 100; // mm, rounded up to 100mm

  // -------------------------------------------------------------------
  // Step D: Design diameter
  // Auto: average of D_VL and D_SB, rounded up to next 100mm.
  // Manual: user-specified.
  // -------------------------------------------------------------------
  let roundedDiameter: number;
  if (input.autoCalculateDiameter === false && input.userDiameter) {
    roundedDiameter = input.userDiameter;
  } else {
    const avgDiam = (vaporLoadingDiameter + vaporVelocityDiameter) / 2;
    roundedDiameter = Math.ceil(avgDiam / 100) * 100;
  }

  // -------------------------------------------------------------------
  // Step E: Derived dimensions
  // -------------------------------------------------------------------
  const actualCrossSectionArea = (Math.PI * Math.pow(roundedDiameter / 1000, 2)) / 4; // m²

  // Actual vapour cross-section loading at the design diameter (ton/hr/m² of vapour)
  const crossSectionLoading = vaporFlow / actualCrossSectionArea; // ton/hr/m²

  // Retention zone height
  const inletDensity = getSeawaterDensity(effectiveSalinity, input.inletTemperature);
  const volumetricFlowM3Min = tonHrToM3S(waterFlow, inletDensity) * 60; // m³/min
  const retentionVolume = volumetricFlowM3Min * input.retentionTime; // m³
  const retentionHeightM = retentionVolume / actualCrossSectionArea; // m
  const retentionHeightMM = retentionHeightM * 1000; // mm

  // Spray zone height: radius / tan(half-angle)
  const radiusMM = roundedDiameter / 2;
  const sprayAngleRad = (input.sprayAngle / 2) * (Math.PI / 180);
  const sprayZoneHeight = radiusMM / Math.tan(sprayAngleRad);

  const totalHeight = retentionHeightMM + input.flashingZoneHeight + sprayZoneHeight;
  const totalVolume = actualCrossSectionArea * (totalHeight / 1000);

  // Actual vapour velocity through the design cross-section
  const vaporVelocity = vaporVolumetricFlow / actualCrossSectionArea; // m/s

  // Vapour velocity status relative to the SB limit
  // OK: < 80% of u_SB  |  HIGH: 80–100%  |  VERY_HIGH: > 100% (entrainment risk)
  let vaporVelocityStatus: 'OK' | 'HIGH' | 'VERY_HIGH';
  if (vaporVelocity <= sbMaxVelocity * 0.8) {
    vaporVelocityStatus = 'OK';
  } else if (vaporVelocity <= sbMaxVelocity) {
    vaporVelocityStatus = 'HIGH';
  } else {
    vaporVelocityStatus = 'VERY_HIGH';
  }

  // Vapour loading (ton/hr/m²) — for display only
  const vaporLoading = vaporFlow / actualCrossSectionArea;

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
    vaporLoadingDiameter,
    crossSectionLoading,
    sbMaxVelocity,
    vaporVelocityDiameter,
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
  const inletVolumetricFlow = tonHrToM3S(waterFlow, inletDensity); // m³/s
  const inletRequiredArea = calculateRequiredPipeArea(
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
  const brineVolumetricFlow = tonHrToM3S(brineFlow, brineDensity); // m³/s
  const brineRequiredArea = calculateRequiredPipeArea(
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
  const vaporVolumetricFlow = tonHrToM3S(vaporFlow, vaporDensity); // m³/s
  const vaporRequiredArea = calculateRequiredPipeArea(vaporFlow, vaporDensity, input.vaporVelocity);

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
 * Calculate Net Positive Suction Head Available at three levels for vacuum flash chamber.
 *
 * Inlines the NPSHa formula: NPSHa = Hs + Hp - Hvp - Hf
 * This was previously delegated to the standalone npshaCalculator, which has been
 * replaced by the MED Suction System Designer for full suction system design.
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
  const frictionLoss = ESTIMATED_FRICTION_LOSS;

  // Pure water density at saturation temperature
  const density = getDensityLiquid(satTempPure);

  // Pressure head: vessel pressure converted to head of liquid
  const pressureHead = barToHead(chamberPressureBar, density);

  // Vapor pressure head: at saturation temperature, vapor pressure ≈ chamber pressure
  // (pure water in a flash chamber is at saturation)
  const vaporPressure = getSaturationPressure(satTempPure);
  const vaporPressureHead = barToHead(vaporPressure, density);

  // Helper: compute NPSHa at a given level
  const calculateAtLevel = (levelName: string, levelElevation: number): NPSHaAtLevel => {
    const staticHead = levelElevation - elevations.pumpCenterline;
    const npshAvailable = staticHead + pressureHead - vaporPressureHead - frictionLoss;

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
    chamberPressureHead: pressureHead,
    vaporPressureHead,
    frictionLoss,
    recommendedNpshMargin: MIN_NPSH_MARGIN,
    recommendation,
  };
}

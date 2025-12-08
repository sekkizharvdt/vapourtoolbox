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

/** Default pump centerline offset below BTL (Bottom Tangent Line) - now user configurable via btlAbovePumpInlet */
const DEFAULT_PUMP_OFFSET_BELOW_BTL = 1.0; // m (fallback if not specified)

/** Level gauge low tapping margin above pump centerline */
const LG_LOW_MARGIN_ABOVE_PUMP = 1.5; // m (NPSHa margin)

/** Calculator version for tracking */
const CALCULATOR_VERSION = '1.2.0';

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
    outletWaterVelocity: { min: 0.5, max: 2.5 },
    vaporVelocity: { min: 5, max: 40 },
    btlAbovePumpInlet: { min: 0.5, max: 10 },
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
 * All elevations are relative to BTL (Bottom Tangent Line) = 0.000
 *
 * @param chamberSizing - Chamber dimension results
 * @param npsha - NPSHa calculation results
 * @param btlAbovePumpInlet - BTL elevation above pump inlet centerline in meters
 * @returns Elevation data for diagram
 */
function calculateElevations(
  chamberSizing: ChamberSizing,
  npsha: NPSHaCalculation,
  btlAbovePumpInlet: number
): FlashChamberElevations {
  // Reference point: BTL = 0.000 m
  const btl = 0;

  // Pump centerline is below BTL by user-specified distance
  const pumpCenterline = -btlAbovePumpInlet;

  // Level gauge low tapping: NPSHa + margin above pump centerline
  // This ensures adequate NPSH for pump operation
  // LG-L = pumpCenterline + NPSHa + margin
  // Since pumpCenterline is negative and we want positive elevation from BTL:
  // LG-L = NPSHa + margin - btlAbovePumpInlet (relative to BTL)
  const lgLow = Math.max(npsha.npshAvailable + LG_LOW_MARGIN_ABOVE_PUMP - btlAbovePumpInlet, 0.3);

  // Convert zone heights from mm to m
  const retentionZoneHeightM = chamberSizing.retentionZoneHeight / 1000;
  const flashingZoneHeightM = chamberSizing.flashingZoneHeight / 1000;
  const sprayZoneHeightM = chamberSizing.sprayZoneHeight / 1000;

  // Level gauge high tapping: LG-L + retention zone height
  // The retention volume is measured between LG-L and LG-H
  const lgHigh = lgLow + retentionZoneHeightM;

  // Flashing zone starts at LG-H (top of retention zone)
  const flashingZoneBottom = lgHigh;
  const flashingZoneTop = flashingZoneBottom + flashingZoneHeightM;

  // Top tangent line (TTL) = total height
  const ttl = chamberSizing.totalHeight / 1000;

  // Nozzle elevations
  const nozzleElevations = {
    // Inlet nozzle (N1): In spray zone, roughly 2/3 up from flashing zone top
    inlet: flashingZoneTop + sprayZoneHeightM * 0.5,
    // Vapor outlet (N2): At top of chamber
    vaporOutlet: ttl,
    // Brine outlet (N3): At bottom, below LG-L (at BTL level)
    brineOutlet: btl,
  };

  return {
    btl,
    lgLow,
    lgHigh,
    flashingZoneBottom,
    flashingZoneTop,
    ttl,
    nozzleElevations,
    pumpCenterline,
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
  const chamberSizing = calculateChamberSize(waterFlow, input, effectiveSalinity);

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

  // Get BTL above pump inlet (use default if not specified for backwards compatibility)
  const btlAbovePumpInlet = input.btlAbovePumpInlet ?? DEFAULT_PUMP_OFFSET_BELOW_BTL;

  // Step 6: Calculate NPSHa
  const npsha = calculateNPSHa(chamberSizing, opPressureBar, satTempPure, btlAbovePumpInlet);

  // Step 7: Calculate elevations for engineering diagram
  const elevations = calculateElevations(chamberSizing, npsha, btlAbovePumpInlet);

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
 * @param input - Flash chamber input parameters
 * @param effectiveSalinity - Effective salinity (0 for DM water)
 */
function calculateChamberSize(
  waterFlow: number,
  input: FlashChamberInput,
  effectiveSalinity: number
): ChamberSizing {
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
    { min: 0.5, max: 2.5 },
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
 * Calculate Net Positive Suction Head Available for vacuum flash chamber
 *
 * For a closed vacuum vessel, NPSHa is calculated as:
 * NPSHa = Static Head + Chamber Pressure Head - Vapor Pressure Head - Friction Loss
 *
 * Note: Atmospheric pressure does NOT act on the liquid in a closed vacuum system.
 * The driving pressure is the chamber operating pressure.
 *
 * @param chamberSizing - Chamber dimensions
 * @param chamberPressureBar - Operating pressure of chamber in bar (absolute)
 * @param satTempPure - Saturation temperature of pure water at operating pressure in °C
 * @param btlAbovePumpInlet - BTL elevation above pump inlet centerline in meters
 */
function calculateNPSHa(
  chamberSizing: ChamberSizing,
  chamberPressureBar: number,
  satTempPure: number,
  btlAbovePumpInlet: number
): NPSHaCalculation {
  // Static head: Liquid level above pump inlet
  // Static head = BTL above pump + retention zone height (liquid level from BTL)
  const retentionHeightM = chamberSizing.retentionZoneHeight / 1000; // Convert mm to m
  const staticHead = btlAbovePumpInlet + retentionHeightM;

  // Chamber pressure converted to head (this is the pressure acting on liquid surface)
  const chamberPressureHead = barToWaterHead(chamberPressureBar);

  // Vapor pressure at operating temperature (converted to head)
  // At saturation, vapor pressure = chamber pressure, so this will be nearly equal
  const vaporPressureBar = getSaturationPressure(satTempPure);
  const vaporPressureHead = barToWaterHead(vaporPressureBar);

  // Estimated friction loss in suction piping
  const frictionLoss = ESTIMATED_FRICTION_LOSS;

  // NPSHa = Static head + Chamber Pressure - Vapor Pressure - Friction loss
  // Since chamber is at saturation, chamber pressure ≈ vapor pressure
  // So NPSHa ≈ Static head - Friction loss (typically very low in vacuum systems)
  const npshAvailable = staticHead + chamberPressureHead - vaporPressureHead - frictionLoss;

  // Generate recommendation for vacuum systems
  let recommendation: string;
  if (npshAvailable < 0) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(2)}m is NEGATIVE. Pump cannot operate. Submersible pump inside chamber or barometric leg required.`;
  } else if (npshAvailable < 0.5) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(2)}m is critically low. Submersible pump strongly recommended.`;
  } else if (npshAvailable < 1.5) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(2)}m is marginal for vacuum service. Low-NPSH pump or submersible pump recommended.`;
  } else if (npshAvailable < 3) {
    recommendation = `NPSHa of ${npshAvailable.toFixed(2)}m is adequate. Select pump with NPSHr < ${(npshAvailable - MIN_NPSH_MARGIN).toFixed(1)}m.`;
  } else {
    recommendation = `NPSHa of ${npshAvailable.toFixed(2)}m is good for vacuum service.`;
  }

  return {
    staticHead,
    chamberPressureHead,
    vaporPressureHead,
    frictionLoss,
    npshAvailable,
    recommendedNpshMargin: MIN_NPSH_MARGIN,
    recommendation,
  };
}

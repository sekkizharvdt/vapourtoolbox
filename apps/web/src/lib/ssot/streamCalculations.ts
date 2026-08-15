/**
 * Stream Calculations for SSOT
 *
 * Auto-calculates thermodynamic properties based on fluid type:
 * - SEA WATER / BRINE WATER: Uses seawater correlations (requires TDS)
 * - DISTILLATE WATER / FEED WATER: Uses pure water properties
 * - STEAM: Uses IAPWS-IF97 steam tables (pressure-aware)
 * - NCG: Uses ideal gas approximations
 */

import {
  // Seawater properties
  getSeawaterDensity,
  getSeawaterEnthalpy,
  getSeawaterSpecificHeat,
  getSeawaterViscosity,
  getSeawaterThermalConductivity,
  getBoilingPointElevation,
  // Steam saturation properties
  getDensityVapor,
  getEnthalpyVapor,
  // Pressure-aware steam properties
  getRegion,
  getDensityAtPT,
  getEnthalpy,
  getSteamProperties,
  // Region-specific steam properties
  getSpecificHeatSubcooled,
  getSpecificHeatSuperheated,
  getEntropySubcooled,
  getEntropySuperheated,
} from '@vapour/constants';
import { createLogger } from '@vapour/logger';
import { LINE_TAG_FLUID_MAP } from '@vapour/types';
import type {
  FluidType,
  FlowUnit,
  GasComposition,
  ProcessStreamInput,
  PropertyBasis,
  SteamRegion,
  StreamPropertyBasis,
} from '@vapour/types';
import {
  calculateGasMixtureProperties,
  resolveBiogasComposition,
  type GasMixtureProperties,
  type ResolvedComposition,
} from '@/lib/thermal/gasMixture';

const logger = createLogger({ context: 'streamCalculations' });

// ============================================================================
// Types
// ============================================================================

export interface StreamCalculationResult {
  /**
   * Density in kg/m³, or `undefined` when the fluid has no correlation in this
   * repo and its properties must be supplied.
   *
   * Optional rather than required because not every fluid is one we can model:
   * biogas needs a gas composition, which is a separate piece of work. Making
   * this required would force a fabricated number into the one place a reader
   * cannot tell a computed value from an invented one.
   */
  density?: number; // kg/m³
  /** Enthalpy in kJ/kg, or `undefined` — see `density`. */
  enthalpy?: number; // kJ/kg
  flowRateKgHr: number; // kg/hr (calculated from kg/s)
  pressureBar: number; // bar (calculated from mbar)
  // Extended properties
  specificHeat?: number; // kJ/(kg·K) - Cp
  viscosity?: number; // Pa·s - dynamic viscosity
  thermalConductivity?: number; // W/(m·K) - for seawater
  entropy?: number; // kJ/(kg·K) - for steam
  boilingPointElevation?: number; // °C - for seawater/brine
  steamRegion?: SteamRegion; // For steam: saturation, subcooled, or superheated
}

export interface StreamCalculationInput {
  fluidType: FluidType;
  /** Gas analysis — required for a fluid with no correlation, ignored otherwise */
  composition?: GasComposition;
  temperature: number; // °C
  pressureMbar: number; // mbar(a)
  flowRateKgS: number; // kg/s
  tds?: number; // ppm (required for seawater/brine)
}

// ============================================================================
// Fluid Type Detection
// ============================================================================

/**
 * Infer fluid type from a line tag prefix, or `null` when the tag matches no
 * known prefix.
 *
 * Prefixes come from `LINE_TAG_FLUID_MAP` — this function does not carry its
 * own copy of the list, so adding a fluid there is enough to teach it.
 *
 * ── Two properties this function must have ───────────────────────────────
 * **Longest prefix wins.** `BG1` matches both `B` (brine) and `BG` (biogas).
 * The previous implementation tested prefixes in a fixed order and returned the
 * first hit, so a biogas stream would have been classified as brine and given
 * seawater correlations — a gas sized and costed as a salt solution, with
 * nothing in the UI to show it had happened.
 *
 * **No silent default.** The previous implementation returned `SEA WATER` for
 * anything it did not recognise. That is how the MED generator's own feed
 * streams (`F1`, `FH`, `FSH`) were classified as sea water: only `FW` was
 * tested, so every one of them fell through to the default. A guess that looks
 * like an answer is worse than no answer, so an unrecognised tag now returns
 * `null` and the caller asks the engineer.
 */
export function inferFluidType(lineTag: string): FluidType | null {
  const tag = lineTag.toUpperCase().trim();
  if (!tag) return null;

  let bestPrefix = '';
  let bestFluid: FluidType | null = null;

  for (const [prefix, fluid] of Object.entries(LINE_TAG_FLUID_MAP)) {
    if (tag.startsWith(prefix) && prefix.length > bestPrefix.length) {
      bestPrefix = prefix;
      bestFluid = fluid;
    }
  }

  return bestFluid;
}

// ============================================================================
// Steam Region Detection
// ============================================================================

/**
 * Determine steam region from pressure and temperature
 * Returns the region as a SteamRegion type for the data model
 */
function getSteamRegionType(pressureBar: number, tempC: number): SteamRegion {
  try {
    const region = getRegion(pressureBar, tempC);
    switch (region) {
      case 1:
        return 'subcooled';
      case 2:
        return 'superheated';
      case 4:
      default:
        return 'saturation';
    }
  } catch {
    // Default to saturation if out of range
    return 'saturation';
  }
}

// ============================================================================
// Property Calculations
// ============================================================================

/**
 * Whether this repo can derive a fluid's properties from temperature and
 * pressure **alone**.
 *
 * Sea water and its family have Sharqawy correlations, steam has IAPWS-IF97,
 * and NCG is modelled as dry air. Biogas has none of that — its properties
 * follow from a **composition**. So this stays false for biogas even now that
 * the mixture model exists: without an analysis there is still nothing to
 * compute from, and the caller must either be given one or leave the
 * properties to be supplied.
 */
export function hasPropertyCorrelations(fluidType: FluidType): boolean {
  return fluidType !== 'BIOGAS';
}

/**
 * Whether a fluid's properties can be derived once a composition is supplied.
 *
 * The pairing with `hasPropertyCorrelations` is the whole point: biogas is
 * `false` there and `true` here, which is exactly the distinction between
 * "we cannot know this" and "we can, once you tell us what the gas is".
 */
export function requiresComposition(fluidType: FluidType): boolean {
  return fluidType === 'BIOGAS';
}

/**
 * Properties of a gas stream derived from its analysis.
 *
 * Separate from `calculateStreamProperties` because the inputs are different in
 * kind: a composition rather than a temperature. The extra outputs — heating
 * value, isentropic exponent, H₂S partial pressure — have no equivalent for a
 * liquid and are what a burner, a blower and a materials decision need.
 */
export function calculateCompositionProperties(
  composition: GasComposition,
  temperature: number,
  pressureMbar: number
): { resolved: ResolvedComposition; properties: GasMixtureProperties } {
  const resolved = resolveBiogasComposition(
    {
      methaneMolPercent: composition.methaneMolPercent,
      carbonDioxideMolPercent: composition.carbonDioxideMolPercent,
      hydrogenSulphide: composition.hydrogenSulphide,
      hydrogenSulphideUnit: composition.hydrogenSulphideUnit,
      basis: composition.basis,
      saturatedAtStreamTemperature: composition.saturatedAtStreamTemperature,
    },
    temperature,
    pressureMbar
  );

  return {
    resolved,
    properties: calculateGasMixtureProperties({
      moleFractions: resolved.moleFractions,
      temperatureC: temperature,
      pressureMbar,
    }),
  };
}

/**
 * Calculate density based on fluid type
 * Now pressure-aware for steam calculations
 */
export function calculateDensity(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number {
  const pressureBar = (pressureMbar || 1013.25) / 1000;

  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) {
        throw new Error(`TDS is required for ${fluidType} density calculation`);
      }
      return getSeawaterDensity(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterDensity(0, temperature);

    case 'STEAM': {
      // A stream typed STEAM is a VAPOUR stream. At saturation, getDensityAtPT
      // resolves to the compressed-liquid branch and returns ~970 kg/m³ instead
      // of ~0.2 — sizing a vapour duct on that is wrong by three orders of
      // magnitude. Take the vapour branch explicitly whenever the stream is
      // saturated; only genuinely superheated steam goes through P-T lookup.
      try {
        if (getSteamRegionType(pressureBar, temperature) === 'superheated') {
          return getDensityAtPT(pressureBar, temperature);
        }
        return getDensityVapor(temperature);
      } catch {
        // Fall back to saturation vapor density if out of range
        return getDensityVapor(temperature);
      }
    }

    case 'NCG': {
      // NCG (Non-Condensable Gas) - approximate as ideal gas
      // Assume mostly air: M ≈ 29 g/mol
      // ρ = P*M / (R*T) where R = 8.314 J/(mol·K)
      const pressurePa = pressureMbar! * 100; // mbar to Pa
      const tempK = temperature + 273.15;
      const M = 0.029; // kg/mol
      const R = 8.314; // J/(mol·K)
      return (pressurePa * M) / (R * tempK);
    }

    case 'BIOGAS':
      // Deliberately not modelled as air. Biogas is roughly 60/40 CH₄/CO₂ and
      // saturated with water at digester temperature, giving a molar mass near
      // 27 g/mol against air's 29 — close enough to look right and wrong enough
      // to matter. Density follows from the composition, which this function is
      // not given.
      throw new Error(
        'BIOGAS density requires a gas composition, which this calculation does not receive. ' +
          'Supply the density with the stream, or use the composition-based model when available.'
      );

    default:
      throw new Error(`Unknown fluid type: ${fluidType}`);
  }
}

/**
 * Calculate enthalpy based on fluid type
 * Now pressure-aware for steam calculations
 */
export function calculateEnthalpy(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number {
  const pressureBar = (pressureMbar || 1013.25) / 1000;

  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) {
        throw new Error(`TDS is required for ${fluidType} enthalpy calculation`);
      }
      return getSeawaterEnthalpy(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterEnthalpy(0, temperature);

    case 'STEAM': {
      // Same phase-selection issue as density above: at saturation the P-T
      // lookup returns liquid enthalpy, which drops the latent heat and makes
      // every vapour-side energy balance wrong. Take the vapour branch unless
      // the steam is genuinely superheated.
      try {
        if (getSteamRegionType(pressureBar, temperature) === 'superheated') {
          return getEnthalpy(pressureBar, temperature);
        }
        return getEnthalpyVapor(temperature);
      } catch {
        // Fall back to saturation vapor enthalpy if out of range
        return getEnthalpyVapor(temperature);
      }
    }

    case 'NCG':
      // NCG enthalpy - approximate as ideal gas with Cp ≈ 1.0 kJ/(kg·K)
      // Reference state: h = 0 at 0°C
      return 1.0 * temperature;

    case 'BIOGAS':
      // See calculateDensity — enthalpy needs a composition-weighted Cp, and
      // the water the gas carries out of the digester contributes latent heat
      // that an air-like Cp does not represent at all.
      throw new Error(
        'BIOGAS enthalpy requires a gas composition, which this calculation does not receive. ' +
          'Supply the enthalpy with the stream, or use the composition-based model when available.'
      );

    default:
      throw new Error(`Unknown fluid type: ${fluidType}`);
  }
}

/**
 * Calculate specific heat (Cp) based on fluid type
 */
export function calculateSpecificHeat(
  fluidType: FluidType,
  temperature: number,
  tds?: number,
  pressureMbar?: number
): number | undefined {
  const pressureBar = (pressureMbar || 1013.25) / 1000;

  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) return undefined;
      return getSeawaterSpecificHeat(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterSpecificHeat(0, temperature);

    case 'STEAM': {
      // Use pressure-aware steam specific heat
      try {
        const region = getRegion(pressureBar, temperature);
        if (region === 1) {
          return getSpecificHeatSubcooled(pressureBar, temperature);
        } else if (region === 2) {
          return getSpecificHeatSuperheated(pressureBar, temperature);
        }
        // For saturation, use approximate value
        const props = getSteamProperties(pressureBar, temperature);
        return props.specificHeat;
      } catch {
        return undefined;
      }
    }

    case 'NCG':
      // NCG Cp ≈ 1.0 kJ/(kg·K) for air-like gases
      return 1.0;

    default:
      return undefined;
  }
}

/**
 * Calculate dynamic viscosity based on fluid type
 */
export function calculateViscosity(
  fluidType: FluidType,
  temperature: number,
  tds?: number
): number | undefined {
  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) return undefined;
      return getSeawaterViscosity(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterViscosity(0, temperature);

    case 'STEAM':
      // Steam viscosity is complex and temperature/pressure dependent
      // For now, use approximate correlation for low-pressure steam
      // μ = μ₀ × (T/T₀)^0.5 where μ₀ ≈ 12.5e-6 Pa·s at 100°C
      return 12.5e-6 * Math.pow((temperature + 273.15) / 373.15, 0.5);

    case 'NCG':
      // Air viscosity approximation
      // μ = μ₀ × (T/T₀)^0.7 where μ₀ ≈ 18.2e-6 Pa·s at 20°C
      return 18.2e-6 * Math.pow((temperature + 273.15) / 293.15, 0.7);

    default:
      return undefined;
  }
}

/**
 * Calculate thermal conductivity based on fluid type
 * Only applicable to seawater and pure water
 */
export function calculateThermalConductivity(
  fluidType: FluidType,
  temperature: number,
  tds?: number
): number | undefined {
  switch (fluidType) {
    case 'SEA WATER':
    case 'BRINE WATER':
      if (tds === undefined) return undefined;
      return getSeawaterThermalConductivity(tds, temperature);

    case 'DISTILLATE WATER':
    case 'FEED WATER':
      // Use seawater correlation with 0 salinity (pure water)
      return getSeawaterThermalConductivity(0, temperature);

    case 'STEAM':
    case 'NCG':
      // Thermal conductivity for gases is less commonly needed
      // Return undefined for now
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Calculate entropy based on fluid type
 * Only applicable to steam
 */
export function calculateEntropy(
  fluidType: FluidType,
  temperature: number,
  pressureMbar?: number
): number | undefined {
  if (fluidType !== 'STEAM') {
    return undefined;
  }

  const pressureBar = (pressureMbar || 1013.25) / 1000;

  try {
    const region = getRegion(pressureBar, temperature);
    if (region === 1) {
      return getEntropySubcooled(pressureBar, temperature);
    } else if (region === 2) {
      return getEntropySuperheated(pressureBar, temperature);
    }
    // For saturation, use getSteamProperties
    const props = getSteamProperties(pressureBar, temperature);
    return props.entropy;
  } catch {
    return undefined;
  }
}

/**
 * Calculate boiling point elevation
 * Only applicable to seawater and brine
 */
export function calculateBoilingPointElevation(
  fluidType: FluidType,
  temperature: number,
  tds?: number
): number | undefined {
  if (fluidType !== 'SEA WATER' && fluidType !== 'BRINE WATER') {
    return undefined;
  }

  if (tds === undefined) {
    return undefined;
  }

  try {
    return getBoilingPointElevation(tds, temperature);
  } catch {
    return undefined;
  }
}

// ============================================================================
// Property basis
// ============================================================================

/** The stream properties that carry a basis */
const BASIS_TRACKED_PROPERTIES = [
  'density',
  'enthalpy',
  'specificHeat',
  'viscosity',
  'thermalConductivity',
  'entropy',
  'boilingPointElevation',
] as const;

type BasisTrackedProperty = (typeof BASIS_TRACKED_PROPERTIES)[number];

/**
 * Mark which properties this repo actually computed.
 *
 * Anything the calculation produced is `COMPUTED`. Anything left over — a value
 * present on the stream that the calculation did not generate — was put there
 * by a person, and this function will not guess whether that was a supplied
 * figure or an assumption. It leaves those keys absent so the caller has to
 * say, which is §2.3's requirement expressed in code rather than in a comment.
 *
 * `handEnteredBasis` is applied to exactly those left-over properties.
 */
export function deriveStreamPropertyBasis(
  calculated: StreamCalculationResult,
  saved: Pick<ProcessStreamInput, BasisTrackedProperty>,
  handEnteredBasis?: PropertyBasis,
  sourceReference?: string
): StreamPropertyBasis {
  const basis: StreamPropertyBasis = {};

  for (const key of BASIS_TRACKED_PROPERTIES) {
    const wasComputed = calculated[key] !== undefined;
    const hasValue = saved[key] !== undefined && saved[key] !== null;
    if (wasComputed) {
      basis[key] = 'COMPUTED';
    } else if (hasValue && handEnteredBasis) {
      basis[key] = handEnteredBasis;
    }
  }

  // Rule 12: never write an undefined into Firestore
  if (sourceReference) {
    basis.sourceReference = sourceReference;
  }
  return basis;
}

// ============================================================================
// Flow unit conversion
// ============================================================================

/** Normal conditions for an Nm³: 0 °C and 1013.25 mbar */
const NORMAL_TEMPERATURE_K = 273.15;
const NORMAL_PRESSURE_MBAR = 1013.25;

/**
 * Convert an entered flow rate to the kg/s the register stores.
 *
 * Returns `null` when the conversion needs a density that is not available
 * yet — a volumetric flow cannot become a mass flow without one, and guessing
 * is how a stream ends up with a mass flow nobody can trace.
 *
 * `NM3_HR` is handled by scaling the actual density back to normal conditions
 * rather than by looking up a molar mass:
 *
 *   ρₙ = ρ · (Pₙ/P) · (T/Tₙ)
 *
 * which follows from the ideal gas law and needs nothing the caller does not
 * already have. It is only valid for a gas — which is the only case where an
 * Nm³ means anything.
 */
export function convertFlowToKgS(
  value: number,
  unit: FlowUnit,
  context: { density?: number; temperatureC?: number; pressureMbar?: number }
): number | null {
  switch (unit) {
    case 'KG_S':
      return value;
    case 'KG_HR':
      return value / 3600;
    case 'M3_HR': {
      if (!context.density || context.density <= 0) return null;
      return (value * context.density) / 3600;
    }
    case 'NM3_HR': {
      const { density, temperatureC, pressureMbar } = context;
      if (!density || density <= 0) return null;
      if (temperatureC === undefined || !pressureMbar) return null;
      const normalDensity =
        density *
        (NORMAL_PRESSURE_MBAR / pressureMbar) *
        ((temperatureC + 273.15) / NORMAL_TEMPERATURE_K);
      return (value * normalDensity) / 3600;
    }
  }
}

/** Convert a stored kg/s back to the unit it was entered in, for display */
export function convertFlowFromKgS(
  flowRateKgS: number,
  unit: FlowUnit,
  context: { density?: number; temperatureC?: number; pressureMbar?: number }
): number | null {
  const perUnit = convertFlowToKgS(1, unit, context);
  if (perUnit === null || perUnit === 0) return null;
  return flowRateKgS / perUnit;
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate all stream properties from input data
 *
 * This function:
 * 1. Converts flow rate from kg/s to kg/hr
 * 2. Converts pressure from mbar to bar
 * 3. Calculates density based on fluid type (pressure-aware for steam)
 * 4. Calculates enthalpy based on fluid type (pressure-aware for steam)
 * 5. Calculates extended properties: Cp, viscosity, thermal conductivity, entropy, BPE
 */
export function calculateStreamProperties(input: StreamCalculationInput): StreamCalculationResult {
  const { fluidType, temperature, pressureMbar, flowRateKgS, tds } = input;

  // Unit conversions
  const flowRateKgHr = flowRateKgS * 3600;
  const pressureBar = pressureMbar / 1000;

  // A fluid with no correlation derives its properties from a composition when
  // one is supplied, and otherwise gets its unit conversions and nothing else.
  // The alternative — letting calculateDensity throw — would lose the flow and
  // pressure conversions too, which are pure arithmetic and always valid.
  if (!hasPropertyCorrelations(fluidType)) {
    if (!input.composition) {
      return { flowRateKgHr, pressureBar };
    }
    const { properties } = calculateCompositionProperties(
      input.composition,
      temperature,
      pressureMbar
    );
    return {
      flowRateKgHr,
      pressureBar,
      density: properties.density,
      enthalpy: properties.enthalpy,
      specificHeat: properties.specificHeat,
      viscosity: properties.viscosity,
      thermalConductivity: properties.thermalConductivity,
    };
  }

  // Calculate core properties
  const density = calculateDensity(fluidType, temperature, tds, pressureMbar);
  const enthalpy = calculateEnthalpy(fluidType, temperature, tds, pressureMbar);

  // Calculate extended properties
  const specificHeat = calculateSpecificHeat(fluidType, temperature, tds, pressureMbar);
  const viscosity = calculateViscosity(fluidType, temperature, tds);
  const thermalConductivity = calculateThermalConductivity(fluidType, temperature, tds);
  const entropy = calculateEntropy(fluidType, temperature, pressureMbar);
  const boilingPointElevation = calculateBoilingPointElevation(fluidType, temperature, tds);

  // Determine steam region if applicable
  const steamRegion =
    fluidType === 'STEAM' ? getSteamRegionType(pressureBar, temperature) : undefined;

  return {
    density,
    enthalpy,
    flowRateKgHr,
    pressureBar,
    specificHeat,
    viscosity,
    thermalConductivity,
    entropy,
    boilingPointElevation,
    steamRegion,
  };
}

/**
 * Auto-fill calculated fields for a stream input
 *
 * Use this when creating or updating streams to ensure
 * all calculated fields are properly set.
 */
export function enrichStreamInput(input: ProcessStreamInput): ProcessStreamInput {
  const { fluidType, temperature, pressureMbar, flowRateKgS, tds, composition } = input;

  // Skip calculation if required fields are missing
  if (temperature === undefined || pressureMbar === undefined || flowRateKgS === undefined) {
    return input;
  }

  try {
    const calculated = calculateStreamProperties({
      fluidType,
      temperature,
      pressureMbar,
      flowRateKgS,
      tds,
      composition,
    });

    // A property this repo cannot compute must not erase one the user supplied.
    // `calculated.density` is now undefined for fluids with no correlation, and
    // assigning it straight over the input would silently blank a figure the
    // engineer typed in from the client's basic design — the one kind of number
    // that cannot be recovered by recalculating.
    return {
      ...input,
      flowRateKgHr: calculated.flowRateKgHr,
      pressureBar: calculated.pressureBar,
      density: calculated.density ?? input.density,
      enthalpy: calculated.enthalpy ?? input.enthalpy,
      specificHeat: calculated.specificHeat ?? input.specificHeat,
      viscosity: calculated.viscosity ?? input.viscosity,
      thermalConductivity: calculated.thermalConductivity ?? input.thermalConductivity,
      entropy: calculated.entropy ?? input.entropy,
      boilingPointElevation: calculated.boilingPointElevation ?? input.boilingPointElevation,
      steamRegion: calculated.steamRegion ?? input.steamRegion,
    };
  } catch (error) {
    // If calculation fails (e.g., out of range), return input unchanged
    logger.warn('Stream calculation failed, returning input unchanged', {
      error,
      fluidType,
      temperature,
      pressureMbar,
    });
    return input;
  }
}

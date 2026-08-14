/**
 * Ideal Gas Mixture Properties
 *
 * Derives the thermophysical properties of a gas mixture from its composition,
 * temperature and pressure. Built for biogas — CH₄ / CO₂ / H₂S leaving a
 * digester saturated with water — but the component table and the mixing rules
 * are general.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Sea water has Sharqawy, steam has IAPWS-IF97, and NCG is modelled as dry air.
 * A gas mixture has none of that: its properties follow from **what it is made
 * of**, so the input is a composition rather than a temperature. Without this,
 * a biogas stream can only carry numbers somebody else supplied.
 *
 * ── Reused, not rebuilt ──────────────────────────────────────────────────
 * `ncgCalculator` already carried Wilke's viscosity rule and the
 * Wassiljewa–Mason–Saxena conductivity rule, written out for the one binary
 * mixture it needed (dry air + water vapour). Those are the same rules an
 * n-component mixture needs, so they live here in general form and the NCG
 * calculator delegates to them. The binary case is an exact special case: with
 * Φᵢᵢ = 1, the two-term expansion is identical (rule 32).
 *
 * ── Accuracy, stated rather than implied ────────────────────────────────
 * Component data is quoted at 25 °C with a linear temperature term, valid over
 * roughly 0–100 °C, which covers digester and biogas-handling conditions with
 * room to spare. Expected accuracy for a biogas mixture:
 *
 *   molar mass          exact (a weighted sum of atomic masses)
 *   density             <1% at near-atmospheric pressure — ideal gas
 *   Cp, Cv, k           ~1%
 *   viscosity           2–3%
 *   thermal conductivity ~5%
 *   heating value       exact to the tabulated values
 *
 * The ideal gas assumption is the load-bearing one, and it is sound here:
 * digester gas sits within a few hundred mbar of atmospheric, where the
 * compressibility factor is 0.99+. **It stops being sound if the gas is
 * compressed** — biogas upgrading or bottling runs at tens to hundreds of bar,
 * where a real equation of state is required and this module must not be used.
 */

import { getSaturationPressure, getEnthalpyVapor } from '@vapour/constants';

// ============================================================================
// Component data
// ============================================================================

/** Components this module knows. Biogas needs the first four. */
export type GasComponent = 'CH4' | 'CO2' | 'H2S' | 'H2O';

export interface GasComponentProperties {
  /** Display formula */
  formula: string;
  /** Molar mass, g/mol */
  molarMassGmol: number;
  /** Molar heat capacity at 25 °C, J/(mol·K) */
  cpMolar25C: number;
  /** Linear temperature coefficient of Cp, J/(mol·K) per K, fitted 0–100 °C */
  cpMolarSlope: number;
  /** Dynamic viscosity at 25 °C, Pa·s */
  viscosity25C: number;
  /** Sutherland constant, K */
  sutherlandS: number;
  /** Thermal conductivity at 25 °C, W/(m·K) */
  conductivity25C: number;
  /** Linear temperature coefficient of conductivity, W/(m·K) per K */
  conductivitySlope: number;
  /** Lower heating value, kJ/mol (0 for a non-combustible) */
  lhvMolar: number;
  /** Higher heating value, kJ/mol */
  hhvMolar: number;
}

/**
 * Component properties at 25 °C, from standard reference data.
 *
 * The viscosity model is Sutherland's law, the same form `ncgCalculator` uses
 * for air. The Sutherland constant for H₂S is the least well established of
 * the four — but over 0–60 °C, the range digester gas actually occupies, an
 * error of ±50 K in S moves the viscosity by under 1%, and viscosity enters
 * only the Reynolds number and pressure drop, never the sizing velocity. The
 * uncertainty is recorded because it exists, not because it changes an answer.
 */
export const GAS_COMPONENTS: Record<GasComponent, GasComponentProperties> = {
  CH4: {
    formula: 'CH₄',
    molarMassGmol: 16.043,
    cpMolar25C: 35.69,
    cpMolarSlope: 0.0655,
    viscosity25C: 11.1e-6,
    sutherlandS: 164,
    conductivity25C: 0.0343,
    conductivitySlope: 1.2e-4,
    lhvMolar: 802.3,
    hhvMolar: 890.8,
  },
  CO2: {
    formula: 'CO₂',
    molarMassGmol: 44.01,
    cpMolar25C: 37.13,
    cpMolarSlope: 0.045,
    viscosity25C: 14.9e-6,
    sutherlandS: 240,
    conductivity25C: 0.0166,
    conductivitySlope: 7.5e-5,
    lhvMolar: 0,
    hhvMolar: 0,
  },
  H2S: {
    formula: 'H₂S',
    molarMassGmol: 34.081,
    cpMolar25C: 34.19,
    cpMolarSlope: 0.019,
    viscosity25C: 12.4e-6,
    sutherlandS: 331,
    conductivity25C: 0.0136,
    conductivitySlope: 5.0e-5,
    lhvMolar: 518.0,
    hhvMolar: 562.0,
  },
  H2O: {
    formula: 'H₂O',
    molarMassGmol: 18.015,
    cpMolar25C: 33.6,
    cpMolarSlope: 0.0093,
    viscosity25C: 9.9e-6,
    sutherlandS: 861,
    conductivity25C: 0.0184,
    conductivitySlope: 9.7e-5,
    lhvMolar: 0,
    hhvMolar: 0,
  },
};

/** Universal gas constant, J/(mol·K) */
const R_UNIV = 8.314;

// ============================================================================
// Per-component properties at temperature
// ============================================================================

/** Molar heat capacity at a temperature, J/(mol·K) */
export function componentCpMolar(component: GasComponent, temperatureC: number): number {
  const c = GAS_COMPONENTS[component];
  return c.cpMolar25C + c.cpMolarSlope * (temperatureC - 25);
}

/**
 * Dynamic viscosity at a temperature, Pa·s, via Sutherland's law:
 *   μ = μ_ref · (T/T_ref)^1.5 · (T_ref + S) / (T + S)
 */
export function componentViscosity(component: GasComponent, temperatureC: number): number {
  const c = GAS_COMPONENTS[component];
  const T = temperatureC + 273.15;
  const Tref = 298.15;
  return c.viscosity25C * Math.pow(T / Tref, 1.5) * ((Tref + c.sutherlandS) / (T + c.sutherlandS));
}

/** Thermal conductivity at a temperature, W/(m·K) */
export function componentConductivity(component: GasComponent, temperatureC: number): number {
  const c = GAS_COMPONENTS[component];
  return c.conductivity25C + c.conductivitySlope * (temperatureC - 25);
}

// ============================================================================
// Mixing rules (n-component)
// ============================================================================

/**
 * Wilke interaction parameter Φᵢⱼ.
 *
 *   Φᵢⱼ = [1 + (μᵢ/μⱼ)^½ (Mⱼ/Mᵢ)^¼]² / [√8 (1 + Mᵢ/Mⱼ)^½]
 *
 * Note Φᵢᵢ = 1, which is what makes the general sum below collapse exactly to
 * the two-term binary form the NCG calculator was written with.
 */
function wilkePhi(muI: number, muJ: number, mI: number, mJ: number): number {
  return (
    Math.pow(1 + Math.sqrt(muI / muJ) * Math.pow(mJ / mI, 0.25), 2) /
    (Math.sqrt(8) * Math.sqrt(1 + mI / mJ))
  );
}

/**
 * One component of a mixture, with its properties already evaluated.
 *
 * The mixing rules take values rather than looking them up, so a caller with
 * its own correlations — `ncgCalculator` models air and low-pressure steam with
 * fits of its own — uses the same rule without adopting this module's component
 * table. The rule is shared; the data stays the caller's.
 */
export interface MixtureComponentState {
  moleFraction: number;
  molarMassGmol: number;
  /** Dynamic viscosity, Pa·s */
  viscosity: number;
  /** Thermal conductivity, W/(m·K) — only needed for the conductivity rule */
  conductivity?: number;
}

/**
 * Wilke / Wassiljewa summation, shared by both rules because they differ only
 * in which property is summed:
 *
 *   X_mix = Σᵢ yᵢXᵢ / (Σⱼ yⱼΦᵢⱼ)
 *
 * Components at a negligible mole fraction are dropped. They add nothing to a
 * numerator but still divide through every denominator, so a zero-fraction
 * component with a very different molar mass would otherwise move the result.
 */
function mixByWilkeSum(
  states: MixtureComponentState[],
  property: (s: MixtureComponentState) => number
): number {
  const present = states.filter((s) => s.moleFraction > 1e-9);
  if (present.length === 0) return 0;
  if (present.length === 1) return property(present[0] as MixtureComponentState);

  let total = 0;
  for (const i of present) {
    let denom = 0;
    for (const j of present) {
      const phi =
        i === j ? 1 : wilkePhi(i.viscosity, j.viscosity, i.molarMassGmol, j.molarMassGmol);
      denom += j.moleFraction * phi;
    }
    total += (i.moleFraction * property(i)) / denom;
  }
  return total;
}

/** Wilke's mixing rule for dynamic viscosity, Pa·s */
export function wilkeViscosityOfStates(states: MixtureComponentState[]): number {
  return mixByWilkeSum(states, (s) => s.viscosity);
}

/**
 * Wassiljewa–Mason–Saxena mixing rule for thermal conductivity, W/(m·K).
 * Uses the same Φ interaction parameters as the viscosity rule.
 */
export function wassiljewaConductivityOfStates(states: MixtureComponentState[]): number {
  return mixByWilkeSum(states, (s) => s.conductivity ?? 0);
}

/** Component states for this module's own table at a temperature */
function statesFor(
  moleFractions: Partial<Record<GasComponent, number>>,
  temperatureC: number
): MixtureComponentState[] {
  return (Object.keys(moleFractions) as GasComponent[]).map((k) => ({
    moleFraction: moleFractions[k] ?? 0,
    molarMassGmol: GAS_COMPONENTS[k].molarMassGmol,
    viscosity: componentViscosity(k, temperatureC),
    conductivity: componentConductivity(k, temperatureC),
  }));
}

/** Wilke viscosity for a mixture of this module's known components, Pa·s */
export function wilkeViscosityMixture(
  moleFractions: Partial<Record<GasComponent, number>>,
  temperatureC: number
): number {
  return wilkeViscosityOfStates(statesFor(moleFractions, temperatureC));
}

/** Wassiljewa conductivity for a mixture of this module's components, W/(m·K) */
export function wassiljewaConductivityMixture(
  moleFractions: Partial<Record<GasComponent, number>>,
  temperatureC: number
): number {
  return wassiljewaConductivityOfStates(statesFor(moleFractions, temperatureC));
}

// ============================================================================
// Mixture properties
// ============================================================================

export interface GasMixtureInput {
  /** Mole fractions, summing to 1. Absent components are treated as zero. */
  moleFractions: Partial<Record<GasComponent, number>>;
  temperatureC: number;
  pressureMbar: number;
}

export interface GasMixtureProperties {
  /** Mixture molar mass, g/mol */
  molarMassGmol: number;
  /** Density, kg/m³ (ideal gas) */
  density: number;
  /** Specific heat at constant pressure, kJ/(kg·K) */
  specificHeat: number;
  /** Specific heat at constant volume, kJ/(kg·K) */
  specificHeatConstantVolume: number;
  /** Isentropic exponent k = Cp/Cv — sets compressor discharge temperature */
  isentropicExponent: number;
  /** Dynamic viscosity, Pa·s */
  viscosity: number;
  /** Thermal conductivity, W/(m·K) */
  thermalConductivity: number;
  /**
   * Specific enthalpy, kJ/kg.
   *
   * Same reference state as `ncgCalculator`: dry components sensible from
   * 0 °C, water carried as vapour so its latent heat is included. Mixing the
   * two conventions across the two calculators would make any energy balance
   * that spans them silently wrong.
   */
  enthalpy: number;
  /** Lower heating value, MJ/kg (0 if nothing combustible) */
  lowerHeatingValueMJkg: number;
  /** Higher heating value, MJ/kg */
  higherHeatingValueMJkg: number;
  /** Lower heating value per normal cubic metre, MJ/Nm³ (0 °C, 1013.25 mbar) */
  lowerHeatingValueMJNm3: number;
  /** Wobbe index (lower), MJ/Nm³ */
  wobbeIndexMJNm3: number;
  /** Partial pressure of H₂S, mbar — the sour-service criterion */
  h2sPartialPressureMbar: number;
}

/** Density of an ideal gas at 0 °C and 1013.25 mbar, per g/mol of molar mass */
const NM3_MOLAR_VOLUME_M3 = (R_UNIV * 273.15) / 101325; // m³/mol

/**
 * Derive every property the register needs from a composition.
 *
 * Mole fractions are used as given — normalise before calling if the analysis
 * does not sum to 1, and show the normalised values, so nobody has to guess
 * what was actually used.
 */
export function calculateGasMixtureProperties(input: GasMixtureInput): GasMixtureProperties {
  const { moleFractions, temperatureC, pressureMbar } = input;
  const components = Object.keys(moleFractions) as GasComponent[];

  // Molar mass — a weighted sum, exact
  let molarMassGmol = 0;
  for (const c of components) {
    molarMassGmol += (moleFractions[c] ?? 0) * GAS_COMPONENTS[c].molarMassGmol;
  }

  // Density from the ideal gas law
  const tempK = temperatureC + 273.15;
  const pressurePa = pressureMbar * 100;
  const density = (pressurePa * (molarMassGmol / 1000)) / (R_UNIV * tempK);

  // Molar Cp, then per unit mass
  let cpMolar = 0;
  for (const c of components) {
    cpMolar += (moleFractions[c] ?? 0) * componentCpMolar(c, temperatureC);
  }
  // J/(mol·K) ÷ g/mol = J/(g·K), which is numerically kJ/(kg·K)
  const specificHeat = cpMolar / molarMassGmol;
  // Cv = Cp − R for an ideal gas
  const cvMolar = cpMolar - R_UNIV;
  const specificHeatConstantVolume = cvMolar / molarMassGmol;
  const isentropicExponent = cpMolar / cvMolar;

  const viscosity = wilkeViscosityMixture(moleFractions, temperatureC);
  const thermalConductivity = wassiljewaConductivityMixture(moleFractions, temperatureC);

  // Enthalpy — dry components sensible from 0 °C, water as vapour
  let enthalpyMolar = 0; // J/mol
  for (const c of components) {
    const y = moleFractions[c] ?? 0;
    if (y <= 0) continue;
    if (c === 'H2O') {
      // kJ/kg → J/mol via molar mass
      enthalpyMolar += y * getEnthalpyVapor(temperatureC) * GAS_COMPONENTS.H2O.molarMassGmol;
    } else {
      enthalpyMolar += y * componentCpMolar(c, temperatureC) * temperatureC;
    }
  }
  const enthalpy = enthalpyMolar / molarMassGmol; // kJ/kg

  // Heating values
  let lhvMolar = 0;
  let hhvMolar = 0;
  for (const c of components) {
    const y = moleFractions[c] ?? 0;
    lhvMolar += y * GAS_COMPONENTS[c].lhvMolar;
    hhvMolar += y * GAS_COMPONENTS[c].hhvMolar;
  }
  // kJ/mol ÷ g/mol = kJ/g, which is numerically MJ/kg
  const lowerHeatingValueMJkg = lhvMolar / molarMassGmol;
  const higherHeatingValueMJkg = hhvMolar / molarMassGmol;

  // Per normal cubic metre, and the Wobbe index against air.
  // kJ/mol ÷ m³/mol = kJ/m³, so the conversion to MJ is 1e-3 — not 1e-6, which
  // is the factor for J and which put this out by a thousand until a test
  // anchored to the published ~21.5 MJ/Nm³ for 60% biogas caught it.
  const lowerHeatingValueMJNm3 = (lhvMolar / NM3_MOLAR_VOLUME_M3) * 1e-3;
  const M_AIR = 28.97;
  const relativeDensity = molarMassGmol / M_AIR;
  const wobbeIndexMJNm3 = lowerHeatingValueMJNm3 / Math.sqrt(relativeDensity);

  const h2sPartialPressureMbar = (moleFractions.H2S ?? 0) * pressureMbar;

  return {
    molarMassGmol,
    density,
    specificHeat,
    specificHeatConstantVolume,
    isentropicExponent,
    viscosity,
    thermalConductivity,
    enthalpy,
    lowerHeatingValueMJkg,
    higherHeatingValueMJkg,
    lowerHeatingValueMJNm3,
    wobbeIndexMJNm3,
    h2sPartialPressureMbar,
  };
}

// ============================================================================
// Biogas composition → mole fractions
// ============================================================================

export interface ResolvedComposition {
  /** Mole fractions actually used, summing to 1 */
  moleFractions: Record<GasComponent, number>;
  /** True when the entered dry fractions did not sum to 100% and were scaled */
  wasNormalised: boolean;
  /** Sum of the entered dry fractions, percent — what the analysis reported */
  enteredDryTotalPercent: number;
  /** Water added by saturation, mol% of the wet gas (0 when not saturated) */
  waterMolPercent: number;
  /** Anything the caller should be told about the result */
  warnings: string[];
}

export interface BiogasCompositionInput {
  /** Methane, mol% of the reported analysis */
  methaneMolPercent: number;
  /** Carbon dioxide, mol% of the reported analysis */
  carbonDioxideMolPercent: number;
  /** Hydrogen sulphide, in the unit it was reported in */
  hydrogenSulphide: number;
  hydrogenSulphideUnit: 'PPMV' | 'MOL_PERCENT';
  /** Whether the analysis is on a dry or a wet basis */
  basis: 'DRY' | 'WET';
  /** DRY basis only: whether the real stream is saturated at its temperature */
  saturatedAtStreamTemperature?: boolean;
}

/**
 * Turn an entered analysis into the mole fractions of the actual stream.
 *
 * Two corrections happen here, and both change the answer:
 *
 * **Normalisation.** With N₂ and O₂ excluded from the register by decision,
 * a real analysis often will not sum to 100%. The three fractions are scaled
 * to 100% and `wasNormalised` says so, because a reading that quietly
 * disappears into a rounding is exactly the failure this module exists to
 * avoid.
 *
 * **Saturation.** Gas leaves a digester saturated, but a lab analysis is
 * almost always reported dry. At 38 °C, water is around 6.6 mol% of the real
 * gas; treating a dry analysis as the wet stream understates molar mass by
 * 2–3%, which lands in the density and then in the line size. When the caller
 * says the stream is saturated, the water is added here from the steam tables.
 */
export function resolveBiogasComposition(
  input: BiogasCompositionInput,
  temperatureC: number,
  pressureMbar: number
): ResolvedComposition {
  const warnings: string[] = [];

  const h2sPercent =
    input.hydrogenSulphideUnit === 'PPMV'
      ? input.hydrogenSulphide / 10000 // ppmv → mol%
      : input.hydrogenSulphide;

  const enteredDryTotalPercent =
    input.methaneMolPercent + input.carbonDioxideMolPercent + h2sPercent;

  if (enteredDryTotalPercent <= 0) {
    throw new Error('Composition is empty — enter the methane and carbon dioxide content');
  }

  const wasNormalised = Math.abs(enteredDryTotalPercent - 100) > 0.01;
  if (wasNormalised) {
    warnings.push(
      `Analysis sums to ${enteredDryTotalPercent.toFixed(2)}%, normalised to 100%. ` +
        'N₂ and O₂ are not carried by this register, so any balance is redistributed ' +
        'across CH₄, CO₂ and H₂S in proportion.'
    );
  }

  // Dry mole fractions, normalised
  const dry: Record<GasComponent, number> = {
    CH4: input.methaneMolPercent / enteredDryTotalPercent,
    CO2: input.carbonDioxideMolPercent / enteredDryTotalPercent,
    H2S: h2sPercent / enteredDryTotalPercent,
    H2O: 0,
  };

  // Wet analyses already include their water, so there is nothing to add.
  if (input.basis === 'WET' || !input.saturatedAtStreamTemperature) {
    return {
      moleFractions: dry,
      wasNormalised,
      enteredDryTotalPercent,
      waterMolPercent: 0,
      warnings,
    };
  }

  // Saturate: y_H2O = p_sat(T) / P, and the dry components share what is left
  const satPressureMbar = getSaturationPressure(temperatureC) * 1000; // bar → mbar
  let yWater = satPressureMbar / pressureMbar;

  if (yWater >= 1) {
    // Below the saturation temperature at this pressure the gas cannot exist as
    // a gas at all. Refuse rather than emit a fraction above 1.
    throw new Error(
      `Saturation pressure at ${temperatureC} °C (${satPressureMbar.toFixed(0)} mbar) exceeds ` +
        `the stream pressure (${pressureMbar} mbar) — check the temperature and pressure.`
    );
  }
  if (yWater > 0.25) {
    warnings.push(
      `Water is ${(yWater * 100).toFixed(1)} mol% of the saturated gas at ${temperatureC} °C — ` +
        'high enough to dominate the properties. Confirm the stream temperature.'
    );
  }
  yWater = Math.max(0, yWater);

  const dryShare = 1 - yWater;
  return {
    moleFractions: {
      CH4: dry.CH4 * dryShare,
      CO2: dry.CO2 * dryShare,
      H2S: dry.H2S * dryShare,
      H2O: yWater,
    },
    wasNormalised,
    enteredDryTotalPercent,
    waterMolPercent: yWater * 100,
    warnings,
  };
}

/**
 * MED wizard save/load persistence helpers.
 *
 * Single source of truth for WHICH wizard inputs are persisted (rule 22 round-trip):
 * every piece of state that feeds the designMED pipeline must appear in
 * MEDWizardDesignState, MED_WIZARD_DEFAULTS, the save payload, and the restore.
 *
 * Adding a new design input to the wizard:
 *   1. Add the field to MEDWizardDesignState (compiler then forces DEFAULTS + key map).
 *   2. Pass it from the client into buildMEDSavePayload and apply it from
 *      restoreMEDWizardState in the onLoad handler (compiler enforces both).
 * The colocated medWizardPersistence.test.ts diffs payload keys against this list,
 * so a field added here but dropped from the payload fails the test.
 */

export const VACUUM_CONFIGS = [
  'single_ejector',
  'two_stage_ejector',
  'lrvp_only',
  'hybrid',
] as const;
export type VacuumConfig = (typeof VACUUM_CONFIGS)[number];

export const GEO_MODES = ['fixed_length', 'fixed_tubes', 'uniform'] as const;
export type GeoMode = (typeof GEO_MODES)[number];

export const GEO_UNIFORM_FIXES = ['tubes', 'length'] as const;
export type GeoUniformFix = (typeof GEO_UNIFORM_FIXES)[number];

/** Every wizard input that feeds the designMED computation (the useMemo deps). */
export interface MEDWizardDesignState {
  // Step 1: primary inputs
  steamFlow: string;
  steamTemp: string;
  swTemp: string;
  swSalinity: string;
  maxBrineSalinity: string;
  numberOfEffects: string;
  condenserApproach: string;
  condenserOutletTemp: string;
  preheaterEffects: number[];
  preheaterTempRise: string;
  /** Per-effect preheater temperature rise overrides (effect number → value). */
  preheaterTempRiseMap: Record<number, string>;
  tvcEnabled: boolean;
  tvcMotivePressure: string;
  tvcSuperheat: string;
  tvcEntrainedEffect: string;
  // Step 1: advanced parameters
  tubeMaterial: string;
  // nea/demisterLoss/ductLoss removed: never read by the MED engine (it
  // computes its own per-effect losses); old saves carrying them are ignored.
  foulingResistance: string;
  bpeSafetyFactor: string;
  designMargin: string;
  includeBrineRecirculation: boolean;
  antiscalantDose: string;
  shellsPerEffect: string;
  vacuumConfig: VacuumConfig;
  sealWaterTemp: string;
  sealWaterClosedLoop: boolean;
  sealWaterChillerCOP: string;
  includeTurndown: boolean;
  // Step 2: geometry selection
  geoMode: GeoMode;
  geoValue: string;
  geoUniformFix: GeoUniformFix;
  uniformMargin: string;
}

/**
 * Fresh-wizard defaults. MUST match the useState initializers in
 * MEDWizardClient.tsx — the client initializes its state FROM this object,
 * so they cannot drift. Old saves missing a key restore to these values.
 */
export const MED_WIZARD_DEFAULTS: MEDWizardDesignState = {
  steamFlow: '0.79',
  steamTemp: '57',
  swTemp: '30',
  swSalinity: '35000',
  maxBrineSalinity: '65000',
  numberOfEffects: '6',
  condenserApproach: '4',
  condenserOutletTemp: '',
  preheaterEffects: [],
  preheaterTempRise: '4',
  preheaterTempRiseMap: {},
  tvcEnabled: false,
  tvcMotivePressure: '10',
  tvcSuperheat: '0',
  tvcEntrainedEffect: '',
  tubeMaterial: 'Al 5052',
  foulingResistance: '0.00015',
  bpeSafetyFactor: '1.1',
  designMargin: '15',
  includeBrineRecirculation: true,
  antiscalantDose: '2',
  shellsPerEffect: '1',
  vacuumConfig: 'two_stage_ejector',
  sealWaterTemp: '',
  sealWaterClosedLoop: false,
  sealWaterChillerCOP: '5',
  includeTurndown: false,
  geoMode: 'fixed_length',
  geoValue: '1.2',
  geoUniformFix: 'tubes',
  uniformMargin: '15',
};

// Record<keyof, true> so the compiler errors if a MEDWizardDesignState field is
// missing here (or an extra key is added) — the persisted key list can't drift
// from the design-state type.
const MED_WIZARD_SAVE_KEY_MAP: Record<keyof MEDWizardDesignState, true> = {
  steamFlow: true,
  steamTemp: true,
  swTemp: true,
  swSalinity: true,
  maxBrineSalinity: true,
  numberOfEffects: true,
  condenserApproach: true,
  condenserOutletTemp: true,
  preheaterEffects: true,
  preheaterTempRise: true,
  preheaterTempRiseMap: true,
  tvcEnabled: true,
  tvcMotivePressure: true,
  tvcSuperheat: true,
  tvcEntrainedEffect: true,
  tubeMaterial: true,
  foulingResistance: true,
  bpeSafetyFactor: true,
  designMargin: true,
  includeBrineRecirculation: true,
  antiscalantDose: true,
  shellsPerEffect: true,
  vacuumConfig: true,
  sealWaterTemp: true,
  sealWaterClosedLoop: true,
  sealWaterChillerCOP: true,
  includeTurndown: true,
  geoMode: true,
  geoValue: true,
  geoUniformFix: true,
  uniformMargin: true,
};

/** The authoritative list of persisted keys — shared by the client and the tests. */
export const MED_WIZARD_SAVE_KEYS = Object.keys(MED_WIZARD_SAVE_KEY_MAP) as ReadonlyArray<
  keyof MEDWizardDesignState
>;

/**
 * Build the Firestore save payload from wizard state.
 * All values are JSON/Firestore-friendly (strings, booleans, number[], plain
 * records keyed by stringified effect number). Undefined values are omitted
 * (rule 12 — Firestore rejects undefined), though a fully-initialized wizard
 * state never produces any.
 */
export function buildMEDSavePayload(state: MEDWizardDesignState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of MED_WIZARD_SAVE_KEYS) {
    const value = state[key];
    if (value === undefined) continue; // rule 12: Firestore rejects undefined
    if (key === 'preheaterEffects') {
      payload[key] = [...state.preheaterEffects];
    } else if (key === 'preheaterTempRiseMap') {
      // Record<number, string> serializes as a plain object with string keys.
      payload[key] = { ...state.preheaterTempRiseMap };
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

const asString = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const asBoolean = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;
const asEnum = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

function restorePreheaterEffects(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((e): e is number => typeof e === 'number' && !isNaN(e)) : [];
}

function restorePreheaterTempRiseMap(v: unknown): Record<number, string> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<number, string> = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    const effectNum = parseInt(key, 10);
    if (!isNaN(effectNum) && typeof value === 'string') out[effectNum] = value;
  }
  return out;
}

/**
 * Restore full wizard state from a saved payload. Every key missing from the
 * payload (old saves predating that input) or of the wrong type falls back to
 * the fresh-wizard default — identical to what a new session computes.
 */
export function restoreMEDWizardState(payload: Record<string, unknown>): MEDWizardDesignState {
  const d = MED_WIZARD_DEFAULTS;
  return {
    steamFlow: asString(payload.steamFlow, d.steamFlow),
    steamTemp: asString(payload.steamTemp, d.steamTemp),
    swTemp: asString(payload.swTemp, d.swTemp),
    swSalinity: asString(payload.swSalinity, d.swSalinity),
    maxBrineSalinity: asString(payload.maxBrineSalinity, d.maxBrineSalinity),
    numberOfEffects: asString(payload.numberOfEffects, d.numberOfEffects),
    condenserApproach: asString(payload.condenserApproach, d.condenserApproach),
    condenserOutletTemp: asString(payload.condenserOutletTemp, d.condenserOutletTemp),
    preheaterEffects: restorePreheaterEffects(payload.preheaterEffects),
    preheaterTempRise: asString(payload.preheaterTempRise, d.preheaterTempRise),
    preheaterTempRiseMap: restorePreheaterTempRiseMap(payload.preheaterTempRiseMap),
    tvcEnabled: asBoolean(payload.tvcEnabled, d.tvcEnabled),
    tvcMotivePressure: asString(payload.tvcMotivePressure, d.tvcMotivePressure),
    tvcSuperheat: asString(payload.tvcSuperheat, d.tvcSuperheat),
    tvcEntrainedEffect: asString(payload.tvcEntrainedEffect, d.tvcEntrainedEffect),
    tubeMaterial: asString(payload.tubeMaterial, d.tubeMaterial),
    foulingResistance: asString(payload.foulingResistance, d.foulingResistance),
    bpeSafetyFactor: asString(payload.bpeSafetyFactor, d.bpeSafetyFactor),
    designMargin: asString(payload.designMargin, d.designMargin),
    includeBrineRecirculation: asBoolean(
      payload.includeBrineRecirculation,
      d.includeBrineRecirculation
    ),
    antiscalantDose: asString(payload.antiscalantDose, d.antiscalantDose),
    shellsPerEffect: asString(payload.shellsPerEffect, d.shellsPerEffect),
    vacuumConfig: asEnum(payload.vacuumConfig, VACUUM_CONFIGS, d.vacuumConfig),
    sealWaterTemp: asString(payload.sealWaterTemp, d.sealWaterTemp),
    sealWaterClosedLoop: asBoolean(payload.sealWaterClosedLoop, d.sealWaterClosedLoop),
    sealWaterChillerCOP: asString(payload.sealWaterChillerCOP, d.sealWaterChillerCOP),
    includeTurndown: asBoolean(payload.includeTurndown, d.includeTurndown),
    geoMode: asEnum(payload.geoMode, GEO_MODES, d.geoMode),
    geoValue: asString(payload.geoValue, d.geoValue),
    geoUniformFix: asEnum(payload.geoUniformFix, GEO_UNIFORM_FIXES, d.geoUniformFix),
    uniformMargin: asString(payload.uniformMargin, d.uniformMargin),
  };
}

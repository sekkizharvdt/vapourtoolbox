/**
 * MED wizard save/load round-trip tests (bug H4, 2026-07-06 thermal review).
 *
 * The wizard previously dropped 8 design-affecting inputs from the save
 * payload (bpeSafetyFactor, preheaterTempRise, preheaterTempRiseMap,
 * includeBrineRecirculation, antiscalantDose, vacuumConfig, shellsPerEffect,
 * includeTurndown), so reloaded designs silently recomputed with defaults.
 * These tests diff the payload keys against the design-input state so that
 * class of bug fails CI instead of corrupting saved designs.
 */
import {
  MED_WIZARD_DEFAULTS,
  MED_WIZARD_SAVE_KEYS,
  buildMEDSavePayload,
  restoreMEDWizardState,
  type MEDWizardDesignState,
} from './medWizardPersistence';

/** Every field set to a NON-default value so round-trip losses are visible. */
const NON_DEFAULT_STATE: MEDWizardDesignState = {
  steamFlow: '1.5',
  steamTemp: '63',
  swTemp: '28',
  swSalinity: '42000',
  maxBrineSalinity: '70000',
  numberOfEffects: '8',
  condenserApproach: '3',
  condenserOutletTemp: '38',
  preheaterEffects: [2, 4],
  preheaterTempRise: '5',
  preheaterTempRiseMap: { 2: '5.5', 4: '3.5' },
  tvcEnabled: true,
  tvcMotivePressure: '12',
  tvcSuperheat: '5',
  tvcEntrainedEffect: '4',
  tubeMaterial: 'Ti Gr2',
  foulingResistance: '0.0002',
  bpeSafetyFactor: '1.2',
  designMargin: '20',
  includeBrineRecirculation: false,
  antiscalantDose: '3',
  shellsPerEffect: '2',
  vacuumConfig: 'hybrid',
  sealWaterTemp: '25',
  sealWaterClosedLoop: true,
  sealWaterChillerCOP: '6.5',
  includeTurndown: true,
  geoMode: 'uniform',
  geoValue: '900',
  geoUniformFix: 'length',
  uniformMargin: '20',
};

describe('MED wizard persistence (rule 22 round-trip)', () => {
  test('every design-input state key is persisted in the save payload', () => {
    const payloadKeys = Object.keys(buildMEDSavePayload(NON_DEFAULT_STATE)).sort();
    const stateKeys = Object.keys(NON_DEFAULT_STATE).sort();
    const sharedKeyList = [...MED_WIZARD_SAVE_KEYS].sort();

    // The payload must carry every design input — a key in state but not in
    // the payload is exactly the H4 data-loss bug.
    expect(payloadKeys).toEqual(stateKeys);
    // And the shared key list (imported by the client) must match both.
    expect(sharedKeyList).toEqual(stateKeys);
  });

  test('the 8 inputs dropped by bug H4 are all persisted', () => {
    const payload = buildMEDSavePayload(NON_DEFAULT_STATE);
    for (const key of [
      'bpeSafetyFactor',
      'preheaterTempRise',
      'preheaterTempRiseMap',
      'includeBrineRecirculation',
      'antiscalantDose',
      'vacuumConfig',
      'shellsPerEffect',
      'includeTurndown',
    ]) {
      expect(payload).toHaveProperty(key);
    }
  });

  test('round-trip: build → restore → build is lossless for a fully non-default state', () => {
    const payload = buildMEDSavePayload(NON_DEFAULT_STATE);
    const restored = restoreMEDWizardState(payload);
    expect(restored).toEqual(NON_DEFAULT_STATE);
    expect(buildMEDSavePayload(restored)).toEqual(payload);
  });

  test('round-trip survives JSON/Firestore serialization (string object keys)', () => {
    // Firestore/JSON stringifies numeric record keys; restore must revive them.
    const payload = JSON.parse(JSON.stringify(buildMEDSavePayload(NON_DEFAULT_STATE)));
    expect(restoreMEDWizardState(payload)).toEqual(NON_DEFAULT_STATE);
  });

  test('restoring an empty payload yields the fresh-wizard defaults', () => {
    expect(restoreMEDWizardState({})).toEqual(MED_WIZARD_DEFAULTS);
  });

  test('old saves (pre-H4 payload without the 8 keys) restore saved fields and default the rest', () => {
    // Exact shape the wizard wrote before this fix.
    const legacyPayload: Record<string, unknown> = {
      steamFlow: '2.1',
      steamTemp: '60',
      swTemp: '29',
      swSalinity: '36000',
      maxBrineSalinity: '68000',
      numberOfEffects: '7',
      condenserApproach: '5',
      condenserOutletTemp: '',
      preheaterEffects: [3],
      tvcEnabled: false,
      tvcMotivePressure: '10',
      tvcSuperheat: '0',
      tvcEntrainedEffect: '',
      geoMode: 'fixed_tubes',
      geoValue: '400',
      geoUniformFix: 'tubes',
      uniformMargin: '15',
      tubeMaterial: 'Al 5052',
      foulingResistance: '0.00015',
      designMargin: '18',
    };
    const restored = restoreMEDWizardState(legacyPayload);

    // Saved fields come back as saved.
    expect(restored.steamFlow).toBe('2.1');
    expect(restored.numberOfEffects).toBe('7');
    expect(restored.preheaterEffects).toEqual([3]);
    expect(restored.geoMode).toBe('fixed_tubes');
    expect(restored.designMargin).toBe('18');

    // Missing fields fall back to the same defaults a fresh wizard uses.
    expect(restored.bpeSafetyFactor).toBe(MED_WIZARD_DEFAULTS.bpeSafetyFactor);
    expect(restored.preheaterTempRise).toBe(MED_WIZARD_DEFAULTS.preheaterTempRise);
    expect(restored.preheaterTempRiseMap).toEqual(MED_WIZARD_DEFAULTS.preheaterTempRiseMap);
    expect(restored.includeBrineRecirculation).toBe(MED_WIZARD_DEFAULTS.includeBrineRecirculation);
    expect(restored.antiscalantDose).toBe(MED_WIZARD_DEFAULTS.antiscalantDose);
    expect(restored.vacuumConfig).toBe(MED_WIZARD_DEFAULTS.vacuumConfig);
    expect(restored.shellsPerEffect).toBe(MED_WIZARD_DEFAULTS.shellsPerEffect);
    expect(restored.includeTurndown).toBe(MED_WIZARD_DEFAULTS.includeTurndown);
  });

  test('malformed values fall back to defaults instead of crashing', () => {
    const restored = restoreMEDWizardState({
      steamFlow: 42, // wrong type (number, expects string)
      preheaterEffects: ['2', null, 3], // mixed array — keeps only numbers
      preheaterTempRiseMap: [1, 2], // array is not a valid record
      vacuumConfig: 'warp_drive', // unknown enum value
      geoMode: 'spherical', // unknown enum value
      includeTurndown: 'yes', // wrong type (string, expects boolean)
    });
    expect(restored.steamFlow).toBe(MED_WIZARD_DEFAULTS.steamFlow);
    expect(restored.preheaterEffects).toEqual([3]);
    expect(restored.preheaterTempRiseMap).toEqual({});
    expect(restored.vacuumConfig).toBe(MED_WIZARD_DEFAULTS.vacuumConfig);
    expect(restored.geoMode).toBe(MED_WIZARD_DEFAULTS.geoMode);
    expect(restored.includeTurndown).toBe(MED_WIZARD_DEFAULTS.includeTurndown);
  });

  test('payload never contains undefined values (rule 12 — Firestore rejects undefined)', () => {
    const stateWithUndefined = {
      ...NON_DEFAULT_STATE,
      condenserOutletTemp: undefined,
    } as unknown as MEDWizardDesignState;
    const payload = buildMEDSavePayload(stateWithUndefined);
    expect(Object.values(payload)).not.toContain(undefined);
    expect('condenserOutletTemp' in payload).toBe(false);
  });
});

/**
 * Bought-Out Spec Code Tests
 *
 * Pure-function tests for the deterministic spec-code generators used by
 * the AI quote parser AND manual entry. The contract every test below
 * defends: same spec → same code, every time, on both client and server.
 *
 * Vocabulary maps live in `specCode.ts` (client) and `boughtOutResolver.ts`
 * (server). The server-side mirror has its own test file in functions/;
 * if either gets out of sync the parsed lines stop matching manual
 * entries and the catalog silently fragments.
 */

import {
  buildValveSpecCode,
  buildPumpSpecCode,
  checkInstrumentSpecComplete,
  VALVE_END_SHORT,
  VALVE_OP_SHORT,
  PUMP_TYPE_SHORT,
  INSTRUMENT_VAR_SHORT,
  INSTRUMENT_TYPE_SHORT,
} from './specCode';
import type { ValveSpecs, PumpSpecs, InstrumentSpecs } from '@vapour/types';

describe('Bought-Out Spec Code', () => {
  // ──────────────────────────────────────────────────────────────────
  // Valves
  // ──────────────────────────────────────────────────────────────────

  describe('buildValveSpecCode', () => {
    const completeSpec: ValveSpecs = {
      valveType: 'GATE',
      bodyMaterial: 'SS316',
      size: 'DN50',
      pressureRating: '150#',
      endConnection: 'FLANGED_RF',
      operation: 'MANUAL',
    };

    it('builds a code from a complete spec', () => {
      const result = buildValveSpecCode(completeSpec);
      expect(result).toEqual({ ok: true, code: 'VLV-GATE-SS316-DN50-150#-FLG-MAN' });
    });

    it('uppercases body material', () => {
      const r = buildValveSpecCode({ ...completeSpec, bodyMaterial: 'ss316' });
      expect(r.ok && r.code).toBe('VLV-GATE-SS316-DN50-150#-FLG-MAN');
    });

    it('strips whitespace from material/size/rating', () => {
      const r = buildValveSpecCode({
        ...completeSpec,
        bodyMaterial: 'SS 316',
        size: 'DN 50',
        pressureRating: '150 #',
      });
      expect(r.ok && r.code).toBe('VLV-GATE-SS316-DN50-150#-FLG-MAN');
    });

    it.each<[NonNullable<ValveSpecs['valveType']>, string]>([
      ['GATE', 'VLV-GATE-SS316-DN50-150#-FLG-MAN'],
      ['GLOBE', 'VLV-GLOBE-SS316-DN50-150#-FLG-MAN'],
      ['BALL', 'VLV-BALL-SS316-DN50-150#-FLG-MAN'],
      ['BUTTERFLY', 'VLV-BUTTERFLY-SS316-DN50-150#-FLG-MAN'],
      ['CHECK_SWING', 'VLV-CHECK_SWING-SS316-DN50-150#-FLG-MAN'],
      ['CHECK_DUAL_PLATE', 'VLV-CHECK_DUAL_PLATE-SS316-DN50-150#-FLG-MAN'],
      ['CHECK_LIFT', 'VLV-CHECK_LIFT-SS316-DN50-150#-FLG-MAN'],
      ['PLUG', 'VLV-PLUG-SS316-DN50-150#-FLG-MAN'],
      ['NEEDLE', 'VLV-NEEDLE-SS316-DN50-150#-FLG-MAN'],
      ['DIAPHRAGM', 'VLV-DIAPHRAGM-SS316-DN50-150#-FLG-MAN'],
      ['CONTROL', 'VLV-CONTROL-SS316-DN50-150#-FLG-MAN'],
    ])('handles valveType %s', (valveType, expected) => {
      const r = buildValveSpecCode({ ...completeSpec, valveType });
      expect(r.ok && r.code).toBe(expected);
    });

    it.each<[NonNullable<ValveSpecs['endConnection']>, string]>([
      ['FLANGED_RF', 'FLG'],
      ['FLANGED_FF', 'FLG-FF'],
      ['BUTT_WELD', 'BW'],
      ['SOCKET_WELD', 'SW'],
      ['THREADED', 'THD'],
      ['WAFER', 'WAF'],
      ['LUG', 'LUG'],
    ])('maps endConnection %s → %s', (endConnection, short) => {
      expect(VALVE_END_SHORT[endConnection]).toBe(short);
      const r = buildValveSpecCode({ ...completeSpec, endConnection });
      expect(r.ok && r.code).toBe(`VLV-GATE-SS316-DN50-150#-${short}-MAN`);
    });

    it.each<[NonNullable<ValveSpecs['operation']>, string]>([
      ['MANUAL', 'MAN'],
      ['GEAR', 'GR'],
      ['PNEUMATIC', 'PNE'],
      ['ELECTRIC', 'ELE'],
      ['HYDRAULIC', 'HYD'],
      ['SELF_ACTUATED', 'SA'],
    ])('maps operation %s → %s', (operation, short) => {
      expect(VALVE_OP_SHORT[operation]).toBe(short);
      const r = buildValveSpecCode({ ...completeSpec, operation });
      expect(r.ok && r.code).toBe(`VLV-GATE-SS316-DN50-150#-FLG-${short}`);
    });

    it.each<[Partial<ValveSpecs>, string]>([
      [{ valveType: undefined }, 'type'],
      [{ bodyMaterial: '' }, 'body material'],
      [{ size: '' }, 'size'],
      [{ pressureRating: '' }, 'rating'],
      [{ endConnection: undefined }, 'end connection'],
      [{ operation: undefined }, 'operation'],
    ])('reports missing field — %j', (override, missing) => {
      const r = buildValveSpecCode({ ...completeSpec, ...override });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(missing);
    });

    it('lists every missing field when several are absent', () => {
      const r = buildValveSpecCode({});
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toContain('type');
        expect(r.reason).toContain('body material');
        expect(r.reason).toContain('size');
        expect(r.reason).toContain('rating');
        expect(r.reason).toContain('end connection');
        expect(r.reason).toContain('operation');
      }
    });

    it('is idempotent — same spec produces the same code twice', () => {
      const a = buildValveSpecCode(completeSpec);
      const b = buildValveSpecCode(completeSpec);
      expect(a).toEqual(b);
    });

    it('treats whitespace-only strings as missing', () => {
      const r = buildValveSpecCode({ ...completeSpec, bodyMaterial: '   ' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('body material');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Pumps
  // ──────────────────────────────────────────────────────────────────

  describe('buildPumpSpecCode', () => {
    const completeSpec: PumpSpecs = {
      pumpType: 'CENTRIFUGAL',
      flowRate: 50,
      head: 30,
    };

    it('builds a code from a complete spec', () => {
      const r = buildPumpSpecCode(completeSpec);
      expect(r).toEqual({ ok: true, code: 'PUMP-CF-50M3H-30M' });
    });

    it.each<[NonNullable<PumpSpecs['pumpType']>, string]>([
      ['CENTRIFUGAL', 'CF'],
      ['GEAR', 'GR'],
      ['DIAPHRAGM', 'DPH'],
      ['SCREW', 'SCR'],
      ['RECIPROCATING', 'REC'],
      ['DOSING', 'DOS'],
    ])('maps pumpType %s → %s', (pumpType, short) => {
      expect(PUMP_TYPE_SHORT[pumpType]).toBe(short);
      const r = buildPumpSpecCode({ ...completeSpec, pumpType });
      expect(r.ok && r.code).toBe(`PUMP-${short}-50M3H-30M`);
    });

    it('rounds flow / head to 1 decimal', () => {
      const r = buildPumpSpecCode({ pumpType: 'CENTRIFUGAL', flowRate: 50.45, head: 30.555 });
      // 50.45 → 50.5; 30.555 → 30.6 (toFixed banker-rounding aside, .5 → .5/.6)
      expect(r.ok && r.code).toMatch(/^PUMP-CF-50\.5M3H-30\.6M$/);
    });

    it('strips trailing .0 so 50.0 → 50', () => {
      const r = buildPumpSpecCode({ pumpType: 'CENTRIFUGAL', flowRate: 50.0, head: 30.0 });
      expect(r.ok && r.code).toBe('PUMP-CF-50M3H-30M');
    });

    it('handles fractional flow without rounding artifacts', () => {
      const r = buildPumpSpecCode({ pumpType: 'CENTRIFUGAL', flowRate: 0.5, head: 5 });
      expect(r.ok && r.code).toBe('PUMP-CF-0.5M3H-5M');
    });

    it.each<[Partial<PumpSpecs>, string]>([
      [{ pumpType: undefined }, 'type'],
      [{ flowRate: undefined }, 'flow rate'],
      [{ head: undefined }, 'head'],
      [{ flowRate: NaN }, 'flow rate'],
      [{ head: Infinity }, 'head'],
    ])('reports missing or non-finite — %j', (override, missing) => {
      const r = buildPumpSpecCode({ ...completeSpec, ...override });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(missing);
    });

    it('is idempotent', () => {
      expect(buildPumpSpecCode(completeSpec)).toEqual(buildPumpSpecCode(completeSpec));
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Instruments (sequence-based — only the prefix is built synchronously)
  // ──────────────────────────────────────────────────────────────────

  describe('checkInstrumentSpecComplete', () => {
    const completeSpec: InstrumentSpecs = {
      variable: 'PRESSURE',
      instrumentType: 'TRANSMITTER',
    };

    it('builds the live-preview prefix from a complete spec', () => {
      const r = checkInstrumentSpecComplete(completeSpec);
      expect(r).toEqual({ ok: true, code: 'INST-PT-XXXX' });
    });

    it.each<[NonNullable<InstrumentSpecs['variable']>, string]>([
      ['PRESSURE', 'P'],
      ['TEMPERATURE', 'T'],
      ['FLOW', 'F'],
      ['LEVEL', 'L'],
      ['CONDUCTIVITY', 'COND'],
      ['PH', 'PH'],
      ['TURBIDITY', 'TURB'],
      ['DISSOLVED_O2', 'DO2'],
    ])('maps variable %s → %s', (variable, short) => {
      expect(INSTRUMENT_VAR_SHORT[variable]).toBe(short);
      const r = checkInstrumentSpecComplete({ ...completeSpec, variable });
      expect(r.ok && r.code).toBe(`INST-${short}T-XXXX`);
    });

    it.each<[NonNullable<InstrumentSpecs['instrumentType']>, string]>([
      ['TRANSMITTER', 'T'],
      ['SWITCH', 'S'],
      ['ANALYSER', 'A'],
      ['INDICATOR', 'I'],
      ['RECORDER', 'R'],
      ['CONTROLLER', 'C'],
    ])('maps instrumentType %s → %s', (instrumentType, short) => {
      expect(INSTRUMENT_TYPE_SHORT[instrumentType]).toBe(short);
      const r = checkInstrumentSpecComplete({ ...completeSpec, instrumentType });
      expect(r.ok && r.code).toBe(`INST-P${short}-XXXX`);
    });

    it.each<[Partial<InstrumentSpecs>, string]>([
      [{ variable: undefined }, 'variable'],
      [{ instrumentType: undefined }, 'instrument type'],
    ])('reports missing field — %j', (override, missing) => {
      const r = checkInstrumentSpecComplete({ ...completeSpec, ...override });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(missing);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Vocabulary completeness — guards against silent map drift
  // ──────────────────────────────────────────────────────────────────

  describe('vocabulary maps', () => {
    it('VALVE_END_SHORT covers every endConnection value', () => {
      const expected = [
        'FLANGED_RF',
        'FLANGED_FF',
        'BUTT_WELD',
        'SOCKET_WELD',
        'THREADED',
        'WAFER',
        'LUG',
      ];
      expect(Object.keys(VALVE_END_SHORT).sort()).toEqual(expected.sort());
    });

    it('VALVE_OP_SHORT covers every operation value', () => {
      const expected = ['MANUAL', 'GEAR', 'PNEUMATIC', 'ELECTRIC', 'HYDRAULIC', 'SELF_ACTUATED'];
      expect(Object.keys(VALVE_OP_SHORT).sort()).toEqual(expected.sort());
    });

    it('PUMP_TYPE_SHORT covers every pumpType value', () => {
      const expected = ['CENTRIFUGAL', 'GEAR', 'DIAPHRAGM', 'SCREW', 'RECIPROCATING', 'DOSING'];
      expect(Object.keys(PUMP_TYPE_SHORT).sort()).toEqual(expected.sort());
    });

    it('produces unique short codes across operations (no collisions)', () => {
      const values = Object.values(VALVE_OP_SHORT);
      expect(new Set(values).size).toBe(values.length);
    });

    it('produces unique short codes across pump types', () => {
      const values = Object.values(PUMP_TYPE_SHORT);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Client / server parity — pinned canonical samples
  //
  // The server-side resolver (functions/src/offerParsing/boughtOutResolver.ts)
  // duplicates these vocabulary maps. We can't import from `functions/` into
  // the web jest environment (it pulls firebase-admin), so this block pins
  // a set of (spec, expected-code) samples that the AI parser MUST produce
  // identically. If a server map ever drifts, the parsed-line linkup will
  // silently stop matching manual entries — these samples are the early-
  // warning canary.
  //
  // To regenerate after a deliberate vocabulary change: run this file, copy
  // any new actual values into the server resolver, and update both sides.
  // ──────────────────────────────────────────────────────────────────

  describe('client/server parity samples', () => {
    it.each<[ValveSpecs, string]>([
      [
        {
          valveType: 'GATE',
          bodyMaterial: 'SS316',
          size: 'DN50',
          pressureRating: '150#',
          endConnection: 'FLANGED_RF',
          operation: 'MANUAL',
        },
        'VLV-GATE-SS316-DN50-150#-FLG-MAN',
      ],
      [
        {
          valveType: 'BUTTERFLY',
          bodyMaterial: 'CS',
          size: '4"',
          pressureRating: '300#',
          endConnection: 'WAFER',
          operation: 'GEAR',
        },
        'VLV-BUTTERFLY-CS-4"-300#-WAF-GR',
      ],
      [
        {
          valveType: 'CHECK_DUAL_PLATE',
          bodyMaterial: 'DI',
          size: 'DN100',
          pressureRating: 'PN16',
          endConnection: 'WAFER',
          operation: 'SELF_ACTUATED',
        },
        'VLV-CHECK_DUAL_PLATE-DI-DN100-PN16-WAF-SA',
      ],
    ])('valve canon — %j', (spec, expected) => {
      const r = buildValveSpecCode(spec);
      expect(r.ok && r.code).toBe(expected);
    });

    it.each<[PumpSpecs, string]>([
      [{ pumpType: 'CENTRIFUGAL', flowRate: 50, head: 30 }, 'PUMP-CF-50M3H-30M'],
      [{ pumpType: 'DIAPHRAGM', flowRate: 5.5, head: 12 }, 'PUMP-DPH-5.5M3H-12M'],
      [{ pumpType: 'DOSING', flowRate: 0.1, head: 20 }, 'PUMP-DOS-0.1M3H-20M'],
    ])('pump canon — %j', (spec, expected) => {
      const r = buildPumpSpecCode(spec);
      expect(r.ok && r.code).toBe(expected);
    });
  });
});

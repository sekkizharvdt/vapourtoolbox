/**
 * The committed vacuum-system artifact must be exactly what its generator
 * produces — same contract as the flash-chamber fixtures, and for the same
 * reason: it is a numerical gate for external work, so a committed file that
 * drifts from its generator means that team is gating against something nobody
 * can reproduce, and a change here stops propagating to them silently.
 *
 * See flashChamberFixtures.reproducible.test.ts for the failure this prevents:
 * lint-staged formats docs JSON, which desynced that artifact from its
 * generator until it was added to .prettierignore.
 */

import { readFileSync } from 'node:fs';

import {
  buildVacuumFixturePayload,
  serialiseVacuumFixturePayload,
  VACUUM_FIXTURE_OUTPUT_PATH,
} from './vacuumSystemFixtures.gen';

describe('committed vacuum-system fixtures are reproducible', () => {
  it('match the generator byte for byte', () => {
    const committed = readFileSync(VACUUM_FIXTURE_OUTPUT_PATH, 'utf8');
    const regenerated = serialiseVacuumFixturePayload(buildVacuumFixturePayload());

    expect(JSON.parse(regenerated)).toEqual(JSON.parse(committed));
    expect(regenerated).toBe(committed);
  });

  it('declare every schemaVersion in schemaChanges', () => {
    const payload = buildVacuumFixturePayload();
    for (let v = 1; v <= payload.schemaVersion; v++) {
      expect(Object.keys(payload.schemaChanges)).toContain(`v${v}`);
    }
  });

  it('every capacity curve reaches exactly zero at blank-off', () => {
    // The feature that makes this curve usable for a pull-down integration, and
    // the one the ejector model lacks. Asserted here rather than trusted,
    // because a curve that never reaches zero lets a model reach any vacuum
    // given time and still pass a naive gate.
    const { capacityCurve } = buildVacuumFixturePayload();

    for (const curve of capacityCurve.samples) {
      const blankOff = capacityCurve.blankOff.find(
        (b) => b.sealWaterTempC === curve.sealWaterTempC
      )!;
      const belowBlankOff = curve.fractionOfRating.filter(
        (f) => f.pressureMbar <= blankOff.blankOffPressureMbar
      );

      expect(belowBlankOff.length).toBeGreaterThan(0);
      for (const point of belowBlankOff) {
        expect(point.fraction).toBe(0);
      }
    }
  });

  describe('the vent-gas rule is published AND exercised', () => {
    /**
     * The simulator session inverted this rule from `dryNcgInKgH` /
     * `vapourInKgH` and recovered the linear branch to 0.01 mbar. Two things
     * that episode showed, both asserted here:
     *
     *   1. Two data points IDENTIFY a rule but do not DISTINGUISH it from any
     *      other rule passing through the same two points. Three or more are
     *      needed before the constant means anything.
     *   2. A branch no case exercises is invisible to inversion. Every v1 case
     *      sat on the linear branch, so the saturation ceiling could not have
     *      been recovered at all — it had to be published.
     */
    it('reproduces every reported vent temperature from the published relation', () => {
      const { ventGasTemperature } = buildVacuumFixturePayload();
      const approach = ventGasTemperature.constants.VENT_APPROACH_C;

      for (const c of ventGasTemperature.perCase) {
        const fromRelation = Math.min(c.saturationTempC, c.coolantInletTempC + approach);
        expect(Math.abs(c.ventGasTempC - fromRelation)).toBeLessThan(1e-6);
      }
    });

    it('exercises both branches, so neither can be recovered wrongly', () => {
      const { ventGasTemperature } = buildVacuumFixturePayload();
      const branches = new Set(ventGasTemperature.perCase.map((c) => c.branch));

      expect(branches).toContain('linear');
      expect(branches).toContain('saturation-ceiling');
    });

    it('carries at least three distinct coolant temperatures', () => {
      // Below three, the approach constant is identified but not distinguished.
      const { ventGasTemperature } = buildVacuumFixturePayload();
      const temps = new Set(ventGasTemperature.perCase.map((c) => c.coolantInletTempC));

      expect(temps.size).toBeGreaterThanOrEqual(3);
    });
  });

  it('pull-down capacity is scaled by the reported rated capacity', () => {
    // If totalRatedCapacityM3h and the curve disagree, the pull-down is silently
    // rescaled while keeping the right shape — the hardest mismatch to spot.
    const { capacityCurve, evacuationCases } = buildVacuumFixturePayload();

    for (const c of evacuationCases) {
      const first = c.expected.evacuationSteps![0]!;
      const expectedMax = c.expected.totalRatedCapacityM3h! * capacityCurve.constants.CAP;
      expect(Math.abs(first.capacityM3h - expectedMax)).toBeLessThan(1);
    }
  });
});

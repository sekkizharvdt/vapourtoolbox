/**
 * The committed fixture artifact must be exactly what its generator produces.
 *
 * `docs/thermal/fixtures/flash-chamber-cases.json` is a numerical gate for the
 * external dynamic-simulator work. If the committed file drifts from the
 * generator, that team is gating against something nobody can reproduce, and a
 * property change on this side stops propagating to them silently — the worst
 * possible failure for a cross-checking artifact.
 *
 * It drifted once already: lint-staged runs prettier over `docs/**\/*.json`, and
 * prettier's formatting differs from `JSON.stringify(..., 2)`, so every commit
 * rewrote the file and every regeneration produced a spurious diff. The file is
 * now in `.prettierignore`; this test is what stops that reappearing.
 *
 * A failure here means one of:
 *   - the fixtures need regenerating (`pnpm fixtures:flash-chamber`) after a
 *     deliberate property or calculator change — regenerate and bump
 *     schemaVersion with the change declared in `schemaChanges`
 *   - something reformatted the artifact — check `.prettierignore`
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildFixturePayload,
  serialiseFixturePayload,
  FIXTURE_OUTPUT_PATH,
} from './flashChamberFixtures.gen';

describe('committed flash-chamber fixtures are reproducible', () => {
  it('match the generator byte for byte', () => {
    const committed = readFileSync(FIXTURE_OUTPUT_PATH, 'utf8');
    const regenerated = serialiseFixturePayload(buildFixturePayload().payload);

    // Compare parsed first: a structural diff reports the offending key, where a
    // raw string comparison would only say the two 800-line files differ.
    expect(JSON.parse(regenerated)).toEqual(JSON.parse(committed));
    expect(regenerated).toBe(committed);
  });

  it('declare every schemaVersion in schemaChanges', () => {
    // v3 silently dropped two keys and broke a consumer at import time. Every
    // version from v2 on must have an entry, so a bump cannot skip the record.
    const { payload } = buildFixturePayload();
    const documented = Object.keys(payload.schemaChanges);

    for (let v = 2; v <= payload.schemaVersion; v++) {
      expect(documented).toContain(`v${v}`);
    }
  });

  it('names a generator that actually exists', () => {
    // v9 shipped — and was sent — pointing at scripts/thermal/generate-flash-
    // chamber-fixtures.ts, which has never existed. It is the field a consumer
    // reads to ask how the numbers were produced, so a dead path is a false
    // claim rather than a cosmetic slip.
    const { payload } = buildFixturePayload();
    const repoRoot = join(__dirname, '..', '..', '..', '..', '..', '..');

    expect(existsSync(join(repoRoot, payload.generatedBy))).toBe(true);
  });

  it('publishes a metal mass whose components sum to its total', () => {
    // Two copies of a quantity is how they diverge. If shell + heads stops
    // summing, the breakdown is describing a different vessel than the total.
    for (const c of buildFixturePayload().payload.cases) {
      const m = c.expected.chamberSizing.metalMass;
      expect(m.shellKg + m.dishedHeadsKg).toBeCloseTo(m.totalKg, 2);
    }
  });

  it('keeps the metal mass labelled as resting on an assumed thickness', () => {
    // The geometry is real; the 6 mm wall is not calculated. If that label is
    // dropped the mass silently becomes a design value.
    for (const c of buildFixturePayload().payload.cases) {
      const m = c.expected.chamberSizing.metalMass;
      expect(m.wallThicknessSource).toBe('assumed');
      expect(m.excludes.length).toBeGreaterThan(0);
    }
  });

  it('publishes a heat capacity that is the mass times its own specific heat', () => {
    // The M·c a wall model needs. Pairing a mass with the wrong grade's cp is
    // invisible in either number alone and moves every time constant.
    for (const c of buildFixturePayload().payload.cases) {
      const m = c.expected.chamberSizing.metalMass;
      expect(m.heatCapacityJPerK).toBeCloseTo(m.totalKg * m.specificHeatJPerKgK, 0);
    }
  });

  it('lands the metal mass at a vessel scale, not a units-slip scale', () => {
    // A tonne-scale drum. A factor of 1000 either way is the failure worth
    // catching cheaply.
    for (const c of buildFixturePayload().payload.cases) {
      const m = c.expected.chamberSizing.metalMass;
      expect(m.totalKg).toBeGreaterThan(100);
      expect(m.totalKg).toBeLessThan(20_000);
    }
  });
});

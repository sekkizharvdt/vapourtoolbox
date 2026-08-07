/**
 * The committed metal-properties artifact must be exactly what its generator
 * produces, and must keep the properties that make it safe to consume.
 *
 * Same contract as the flash-chamber, condenser and vacuum fixtures. The extra
 * assertions here guard the two things this particular artifact can get wrong:
 * a specific heat quietly promoted to "sourced" without a citation, and the
 * shell-mass divergence drifting from the relation it claims to publish.
 */

import { readFileSync } from 'node:fs';

import { METAL_PROPERTIES } from '@vapour/constants';

import {
  buildMetalPropertiesFixturePayload,
  serialiseMetalPropertiesFixturePayload,
  METAL_PROPERTIES_FIXTURE_OUTPUT_PATH,
} from './metalPropertiesFixtures.gen';

describe('committed metal properties fixture is reproducible', () => {
  it('matches the generator byte for byte', () => {
    const committed = readFileSync(METAL_PROPERTIES_FIXTURE_OUTPUT_PATH, 'utf8');
    const regenerated = serialiseMetalPropertiesFixturePayload(
      buildMetalPropertiesFixturePayload()
    );

    expect(JSON.parse(regenerated)).toEqual(JSON.parse(committed));
    expect(regenerated).toBe(committed);
  });

  it('declares every schemaVersion in schemaChanges', () => {
    const payload = buildMetalPropertiesFixturePayload();
    for (let v = 1; v <= payload.schemaVersion; v++) {
      expect(Object.keys(payload.schemaChanges)).toContain(`v${v}`);
    }
  });

  it('publishes every grade the repo defines', () => {
    // A grade added to METAL_PROPERTIES but missing from the fixture would leave
    // a consumer silently without a material it can specify.
    const payload = buildMetalPropertiesFixturePayload();
    expect(Object.keys(payload.grades).sort()).toEqual(Object.keys(METAL_PROPERTIES).sort());
  });

  it('marks every specific heat as datasheet-conventional, never sourced', () => {
    // The claim the whole provenance section rests on. If a value is ever
    // promoted to 'sourced' it must come with a citation, and this test failing
    // is the prompt to add one to the fixture rather than to relax the check.
    for (const grade of Object.values(buildMetalPropertiesFixturePayload().grades)) {
      expect(grade.specificHeatBasis).toBe('mill-datasheet-conventional');
    }
  });

  it('quotes a temperature band for every specific heat, never a point value', () => {
    // A band collapsed to a point is precision the data does not carry.
    for (const grade of Object.values(buildMetalPropertiesFixturePayload().grades)) {
      const [low, high] = grade.specificHeatQuotedRangeC;
      expect(high).toBeGreaterThan(low);
    }
  });

  it('publishes a volumetric heat capacity that is the product of its own factors', () => {
    // The unit-handling check the fixture asks consumers to run, asserted on the
    // artifact itself so it cannot ship inconsistent.
    for (const grade of Object.values(buildMetalPropertiesFixturePayload().grades)) {
      expect(grade.volumetricHeatCapacityJPerM3K).toBeCloseTo(
        grade.densityKgM3 * grade.specificHeatJPerKgK,
        0
      );
    }
  });

  it('the shell-mass divergence reproduces its own published relation', () => {
    // The one hard expectation in this fixture. If the per-grade ratios stop
    // being rho(grade)/rho_estimator, the artifact is claiming a relation it
    // does not implement — which is worse than publishing no relation at all.
    const d = buildMetalPropertiesFixturePayload().shellMassDivergence;

    for (const [grade, entry] of Object.entries(d.perGrade)) {
      const expected = entry.densityKgM3 / d.shellEstimatorDensityKgM3;
      expect(entry.ratio).toBeCloseTo(expected, 5);
      expect(entry.percent).toBeCloseTo((expected - 1) * 100, 2);
      // The density quoted in the divergence table must be the same one the
      // grades table publishes — two copies of a number is how they diverge.
      expect(entry.densityKgM3).toBe(METAL_PROPERTIES[grade as never]['densityKgM3']);
    }
  });

  it('states the 316L divergence as the +2.56% the capability register quotes', () => {
    // The specific number already relayed to the simulator session. Pinned so a
    // density edit cannot silently move a figure that has been communicated.
    const d = buildMetalPropertiesFixturePayload().shellMassDivergence;
    const ss316l = d.perGrade.ss_316l;
    // Asserted rather than optional-chained: a missing 316L entry must fail this
    // test loudly, not pass it vacuously.
    expect(ss316l).toBeDefined();
    expect(ss316l!.percent).toBeCloseTo(2.56, 2);
  });

  it('keeps the wall thickness marked as an assumption', () => {
    // 6 mm is unsourced and agreed as a working figure. If it ever reaches a
    // consumer without that label it becomes a design value by accident.
    const v = buildMetalPropertiesFixturePayload().vesselAssumptions;
    expect(v.status).toBe('ASSUMED');
    expect(v.wallThicknessMM).toBe(6);
    expect(v.note).toContain('NOT A DESIGN VALUE');
  });

  it('does not publish a c(T) fit', () => {
    // Deliberately absent — fitting one through band-averaged datasheet values
    // manufactures precision. If this ever fails, a real source must have landed
    // and the knownLimitations entry needs rewriting rather than deleting.
    const payload = buildMetalPropertiesFixturePayload();
    const serialised = serialiseMetalPropertiesFixturePayload(payload);

    expect(payload.knownLimitations.noTemperatureDependence).toContain('DELIBERATELY ABSENT');
    expect(serialised).not.toContain('specificHeatCoefficients');
    for (const grade of Object.values(payload.grades)) {
      expect(grade).not.toHaveProperty('specificHeatAtC');
    }
  });
});

/**
 * The committed condenser artifact must be exactly what its generator produces,
 * and must keep the properties that make it gateable.
 *
 * Same contract as the flash-chamber and vacuum fixtures. The extra assertions
 * here are the ones this fixture's own history argues for: its first draft
 * carried a 1000x units slip, and its second could not distinguish a settable
 * input from a constant.
 */

import { readFileSync } from 'node:fs';

import {
  buildCondenserFixturePayload,
  serialiseCondenserFixturePayload,
  CONDENSER_FIXTURE_OUTPUT_PATH,
} from './condenserFixtures.gen';

describe('committed condenser fixtures are reproducible', () => {
  it('match the generator byte for byte', () => {
    const committed = readFileSync(CONDENSER_FIXTURE_OUTPUT_PATH, 'utf8');
    const regenerated = serialiseCondenserFixturePayload(buildCondenserFixturePayload());

    expect(JSON.parse(regenerated)).toEqual(JSON.parse(committed));
    expect(regenerated).toBe(committed);
  });

  it('declare every schemaVersion in schemaChanges', () => {
    const payload = buildCondenserFixturePayload();
    for (let v = 1; v <= payload.schemaVersion; v++) {
      expect(Object.keys(payload.schemaChanges)).toContain(`v${v}`);
    }
  });

  it('the duty breakdown sums to the duty', () => {
    // dutyKW is not the vapour latent load — it carries two sensible terms. If
    // the components stop summing, the published composition is describing a
    // different quantity than the one being gated on.
    for (const c of buildCondenserFixturePayload().cases) {
      const b = c.expected.dutyBreakdownKW;
      const sum = b.condensing + b.distillateCooling + b.condensateCooling;
      expect(Math.abs(sum - c.expected.dutyKW) / c.expected.dutyKW).toBeLessThan(0.001);
    }
  });

  it('Q = U x A x LMTD holds in every published case', () => {
    // The defect this fixture surfaced. Asserted on the ARTIFACT as well as in
    // the calculator, because the fixture is what another team gates against.
    for (const c of buildCondenserFixturePayload().cases) {
      const e = c.expected;
      const implied = (e.overallU * e.requiredAreaM2 * e.lmtdC) / 1000;
      expect(Math.abs(implied - e.dutyKW) / e.dutyKW).toBeLessThan(0.002);
    }
  });

  it('the seawater rise is not constant across the grid', () => {
    // v1 left condenserSWOutlet unset everywhere, so the rise was 5.00 K in
    // every case and a settable design input looked like a physical constant.
    // The domain range is 5 K default, 7-8 K as the designer requires.
    const rises = new Set(
      buildCondenserFixturePayload().cases.map(
        (c) => c.expected.seawaterOutletTempC - c.expected.seawaterInletTempC
      )
    );
    expect(rises.size).toBeGreaterThanOrEqual(3);
  });

  it('the resistance network closes from the published constants', () => {
    // The strongest assertion here, and the one that would have caught v3. That
    // revision published the EVAPORATOR tube defaults (1.0 mm wall, k = 138)
    // for a condenser that is 17 x 0.4 mm titanium at k = 21, so a consumer
    // closing the network computed U about 2.3% low — in one direction, across
    // every case, which is how the simulator session spotted it.
    //
    // Publishing two film coefficients let them SEE a U disagreement; only the
    // network constants let anyone attribute it. This asserts the published
    // constants actually reproduce the published U.
    const { cases, resistanceNetwork: n } = buildCondenserFixturePayload();

    for (const c of cases) {
      const e = c.expected;
      const od = e.tubeODmm / 1000;
      const id = e.tubeIDmm / 1000;
      const resistance =
        1 / e.shellSideHTC +
        n.distillateFoulingM2KW +
        (od * Math.log(od / id)) / (2 * e.tubeConductivityWmK) +
        n.seawaterFoulingM2KW * (od / id) +
        (1 / e.tubeSideHTC) * (od / id);

      expect(Math.abs(1 / resistance - e.overallU) / e.overallU).toBeLessThan(0.001);
    }
  });

  it('every case sits at a plant scale, not a units-slip scale', () => {
    // The first draft reported a 604 MW condenser with 588,000 tubes from
    // passing kg/h into a T/h field. Cheap to assert, and it would have caught it.
    for (const c of buildCondenserFixturePayload().cases) {
      expect(c.expected.dutyKW).toBeLessThan(50_000);
      expect(c.expected.tubes).toBeLessThan(10_000);
    }
  });
});

/**
 * Regenerates docs/thermal/fixtures/flash-chamber-cases.json.
 *
 * Run: pnpm fixtures:flash-chamber
 *
 * Executed through jest rather than as a bare node script: the calculator pulls
 * in `pipeService`, which imports `@vapour/firebase`, whose client module never
 * settles outside a browser-like environment. Jest already resolves and stubs
 * that graph for the test suite, so running here costs nothing and avoids
 * restructuring shared infrastructure for a fixture script. The `.gen.ts` suffix
 * keeps it out of `testMatch`, so normal test runs never execute it.
 *
 * The fixture set is the numerical anchor the external dynamic-simulator work
 * (vapour-dynamics, rungs 0/1) checks its steady-state flash against. Earlier
 * revisions were produced ad hoc, which is how v3 came to drop two keys without
 * recording it and break a consumer at import time. Generating from a checked-in
 * script makes every revision reproducible and diffable.
 *
 * Each case carries, beside the expected output:
 *   - inletConsistency — proof the stated feed is genuinely subcooled liquid
 *   - sensitivity      — how much a small enthalpy error is amplified into the
 *                        vapour rate, so a consumer can size its own tolerance
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getSaturationPressure, getSeawaterEnthalpy } from '@vapour/constants';
import type { FlashChamberInput } from '@vapour/types';

import { calculateFlashChamber, resolveInletPressureMbar } from '../flashChamberCalculator';

const SCHEMA_VERSION = 8;

const OUTPUT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'thermal',
  'fixtures',
  'flash-chamber-cases.json'
);

/** Geometry and velocity inputs held constant so cases differ only in process conditions. */
const COMMON: Omit<
  FlashChamberInput,
  'waterType' | 'salinity' | 'operatingPressure' | 'waterFlowRate' | 'inletTemperature'
> = {
  mode: 'WATER_FLOW',
  flowRateUnit: 'TON_HR',
  retentionTime: 2.5,
  flashingZoneHeight: 500,
  sprayAngle: 60,
  inletWaterVelocity: 2.5,
  outletWaterVelocity: 0.1,
  vaporVelocity: 20,
  pumpCenterlineAboveFFL: 0.6,
  operatingLevelAbovePump: 4,
  operatingLevelRatio: 0.5,
  btlGapBelowLGL: 0.1,
  autoCalculateDiameter: true,
};

interface CaseSpec {
  id: string;
  note: string;
  waterType: FlashChamberInput['waterType'];
  salinity: number;
  operatingPressure: number;
  waterFlowRate: number;
  inletTemperature: number;
  /** Omitted means the default 3 bar full-cone differential. */
  sprayNozzleDeltaPBar?: number;
}

const CASE_SPECS: CaseSpec[] = [
  {
    id: 'dm-01',
    note: 'DM water, moderate vacuum, large flash dT.',
    waterType: 'DM_WATER',
    salinity: 0,
    operatingPressure: 60,
    waterFlowRate: 100,
    inletTemperature: 46,
  },
  {
    id: 'dm-02',
    note: 'DM water at 63 C. Was the v2 expected-to-fail diagnostic; finding 5 removed the enthalpy crossover and it now agrees to 0.017%.',
    waterType: 'DM_WATER',
    salinity: 0,
    operatingPressure: 200,
    waterFlowRate: 100,
    inletTemperature: 63,
  },
  {
    id: 'sw-01',
    note: 'Standard seawater. Pairs with dm-01 to isolate the salinity terms.',
    waterType: 'SEAWATER',
    salinity: 35000,
    operatingPressure: 60,
    waterFlowRate: 100,
    inletTemperature: 46,
  },
  {
    id: 'sw-02',
    note: 'Concentrated feed, deeper vacuum.',
    waterType: 'SEAWATER',
    salinity: 45000,
    operatingPressure: 100,
    waterFlowRate: 60,
    inletTemperature: 52,
  },
  {
    id: 'sw-03',
    note: 'High salinity.',
    waterType: 'SEAWATER',
    salinity: 60000,
    operatingPressure: 80,
    waterFlowRate: 80,
    inletTemperature: 49,
  },
  {
    id: 'sw-04',
    note: 'Small flash dT (~1.4 K) \u2014 highest amplification in the set.',
    waterType: 'SEAWATER',
    salinity: 45000,
    operatingPressure: 312,
    waterFlowRate: 120,
    inletTemperature: 72,
  },
  {
    id: 'sw-05',
    note: "ADDED v4 at the simulator session's request: last-effect brine concentration. The two enthalpy implementations diverge faster than linearly with salinity (+0.13% at 35 g/kg, +0.25% at 45, +0.54% at 60), and a MED train reaches 70-120 g/kg by the last effect \u2014 beyond what the v3 grid covered. Needed before rung 7.",
    waterType: 'SEAWATER',
    salinity: 90000,
    operatingPressure: 100,
    waterFlowRate: 60,
    inletTemperature: 52,
  },
  {
    id: 'sw-06',
    note: 'ADDED v4: near the top of the MIT correlation validity range. Feed is 115,000 ppm; the brine concentrates above that but stays inside 120,000, which is the hard ceiling \u2014 120,000 ppm feed throws, correctly, because the brine would exceed the correlation range.',
    waterType: 'SEAWATER',
    salinity: 115000,
    operatingPressure: 200,
    waterFlowRate: 60,
    inletTemperature: 63,
  },
  {
    id: 'sw-08',
    note:
      "ADDED v7 at the simulator session's request. 90 g/kg at 90 °C — the only empty cell on " +
      'the grid. Above 45 g/kg every other case sits at a SINGLE temperature (60 g/kg at 49 °C, ' +
      '90 at 52, 115 at 63), so a salinity-term difference that varies with temperature has ' +
      'nowhere to show itself up there. Pairs with sw-05 (same 90 g/kg, 52 °C) to give a ' +
      'temperature axis at high concentration, and with sw-07 to give a large flash at high ' +
      'concentration. It exists to detect a FUTURE divergence, not a current one — the ' +
      'correlations agree today.',
    waterType: 'SEAWATER',
    salinity: 90000,
    operatingPressure: 200,
    waterFlowRate: 60,
    inletTemperature: 90,
  },
  {
    id: 'sw-07',
    note:
      'ADDED v5. Hot feed flashed to deep vacuum — a ~30 K flash at the LOWEST amplification in ' +
      'the set, the regime the grid previously lacked entirely. Only expressible now that the ' +
      'spray-nozzle differential is an input: the old hardcoded inlet of operating + 50 mbar ' +
      'stated this feed far below its own saturation pressure (702 mbar at 90 °C).',
    waterType: 'SEAWATER',
    salinity: 35000,
    operatingPressure: 200,
    waterFlowRate: 100,
    inletTemperature: 90,
  },
  {
    id: 'dm-03',
    note:
      'ADDED v5. The same large flash on DM water, pairing with sw-07 the way dm-01 pairs with ' +
      'sw-01, so seawater-property error can be separated from flash error at large dT.',
    waterType: 'DM_WATER',
    salinity: 0,
    operatingPressure: 200,
    waterFlowRate: 100,
    inletTemperature: 90,
  },
];

function buildInput(spec: CaseSpec): FlashChamberInput {
  return {
    ...COMMON,
    waterType: spec.waterType,
    salinity: spec.salinity,
    operatingPressure: spec.operatingPressure,
    waterFlowRate: spec.waterFlowRate,
    inletTemperature: spec.inletTemperature,
    ...(spec.sprayNozzleDeltaPBar !== undefined && {
      sprayNozzleDeltaPBar: spec.sprayNozzleDeltaPBar,
    }),
  };
}

const round = (n: number, d: number): number => Number(n.toFixed(d));

function buildCase(spec: CaseSpec) {
  const input = buildInput(spec);
  const result = calculateFlashChamber(input);
  const { inlet, brine } = result.heatMassBalance;

  const inletPressureMbar = resolveInletPressureMbar(
    spec.operatingPressure,
    spec.sprayNozzleDeltaPBar
  );
  const saturationAtInletMbar = getSaturationPressure(spec.inletTemperature) * 1000;

  // Amplification: the vapour rate is (h_in - h_brine) / h_fg, so a relative
  // error in either enthalpy is magnified by the ratio of the enthalpy LEVEL to
  // the enthalpy DIFFERENCE. A consumer gating on vapour rate needs to divide
  // its tolerance by this factor to get the enthalpy accuracy it implies.
  const enthalpyDifference = inlet.enthalpy - brine.enthalpy;
  const amplificationFactor = Math.abs(inlet.enthalpy / enthalpyDifference);
  const flashDeltaTK = inlet.temperature - brine.temperature;

  const brineSalinityPpm =
    spec.waterType === 'SEAWATER' ? (spec.salinity * inlet.flowRate) / brine.flowRate : 0;

  return {
    id: spec.id,
    note: spec.note,
    input,
    inletConsistency: {
      inletPressureMbar: round(inletPressureMbar, 1),
      saturationPressureAtInletTempMbar: round(saturationAtInletMbar, 1),
      subcoolMarginMbar: round(inletPressureMbar - saturationAtInletMbar, 1),
      subcooled: inletPressureMbar > saturationAtInletMbar,
      sprayNozzleDeltaPBar: round((inletPressureMbar - spec.operatingPressure) / 1000, 3),
    },
    sensitivity: {
      flashDeltaTK: round(flashDeltaTK, 3),
      enthalpyDifferenceKjKg: round(enthalpyDifference, 3),
      amplificationFactor: round(amplificationFactor, 2),
      enthalpyAccuracyNeededForHalfPercentFlowGate: `${(0.5 / amplificationFactor).toFixed(3)}%`,
      brineSalinityPpm: round(brineSalinityPpm, 0),
      concentrationFactor:
        spec.waterType === 'SEAWATER' ? round(brineSalinityPpm / spec.salinity, 4) : null,
    },
    expected: {
      heatMassBalance: result.heatMassBalance,
      chamberSizing: result.chamberSizing,
      nozzles: result.nozzles,
      npsha: result.npsha,
      elevations: result.elevations,
    },
    // Stays at case level, where v4 consumers read it. Moving it under
    // `expected` would be exactly the v3 mistake: a silent relocation that
    // breaks a reader at import time.
    warnings: result.warnings,
  };
}

/**
 * Build the full fixture payload. Pure — no filesystem access — so the
 * reproducibility guard in flashChamberFixtures.reproducible.test.ts can compare
 * it against the committed file without rewriting anything.
 */
export function buildFixturePayload() {
  const cases = CASE_SPECS.map(buildCase);

  // Guardrails: the whole point of v2 was that every stated feed is a real
  // subcooled liquid. Fail loudly rather than emit an ill-posed fixture.
  for (const c of cases) {
    if (!c.inletConsistency.subcooled) {
      throw new Error(
        `${c.id}: inlet pressure ${c.inletConsistency.inletPressureMbar} mbar is below the ` +
          `saturation pressure ${c.inletConsistency.saturationPressureAtInletTempMbar} mbar at ` +
          `${c.input.inletTemperature} °C — the feed would already be flashing in its supply pipe.`
      );
    }
    if (c.expected.heatMassBalance.vapor.flowRate <= 0) {
      throw new Error(`${c.id}: non-positive vapour rate — the case does not flash.`);
    }
  }

  const amplifications = cases.map((c) => c.sensitivity.amplificationFactor);
  const worst = cases.reduce((a, b) =>
    a.sensitivity.amplificationFactor > b.sensitivity.amplificationFactor ? a : b
  );
  const best = cases.reduce((a, b) =>
    a.sensitivity.amplificationFactor < b.sensitivity.amplificationFactor ? a : b
  );

  // Sanity-check the enthalpy path used for the amplification figure is the same
  // one the calculator uses, so the guidance cannot drift from the data.
  const spotCheck = getSeawaterEnthalpy(35000, 60);
  if (!Number.isFinite(spotCheck)) {
    throw new Error('Seawater enthalpy path is unavailable — refusing to emit fixtures.');
  }

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: 'scripts/thermal/generate-flash-chamber-fixtures.ts',
    generatedFor: 'vapour-dynamics rung 0/1 — spec section 7.1 / 7.2',
    schemaChanges: {
      v8: {
        added: [],
        removed: [],
        changed: [
          'Brine temperature rises in all eight seawater cases, and vapour rate falls 0.06-0.30%. ' +
            'BPE was evaluated at the FEED salinity; the brine leaving is at the OUTLET salinity, ' +
            'which is higher, so the brine boiling point was understated in proportion to the ' +
            'concentration factor. DM cases move 0.0000 K — the control.',
          'Shift by case: sw-08 +0.0713 K (CF 1.048), sw-07 +0.0236 K (CF 1.053), ' +
            'sw-05 +0.0108 K, sw-03 +0.0084 K, sw-01 +0.0059 K, sw-02 +0.0052 K, ' +
            'sw-06 +0.0043 K, sw-04 +0.0016 K.',
        ],
        note:
          'Found by the simulator session, from the coefficients this file published in v7 — the ' +
          'BPE correlation was never the problem, the salinity argument was. sw-08 was added in ' +
          'v7 as insurance against a hypothetical FUTURE salinity-term divergence and instead ' +
          'paid for itself immediately on something unrelated: it is the only cell where a high ' +
          'concentration factor and a high BPE magnitude coincide, so it alone reached 71% of ' +
          "the 0.1 K gate while every other case stayed under 0.010 K. A case's value is not " +
          'limited to the reason it was added.',
      },
      v7: {
        added: [
          'case sw-08 (90 g/kg at 90 °C) — a second temperature at high concentration, and a ' +
            'large flash at high concentration. Added to detect a FUTURE salinity-term ' +
            'divergence; the correlations agree today.',
          'knownLimitations.pureWaterBaseline and knownLimitations.boilingPointElevation',
        ],
        removed: [],
        changed: [
          'gateGuidance.largeFlashCases now states the DETECTION rationale (a temperature-' +
            'dependent error only shows up across a wide flash) instead of the derived-tolerance ' +
            'one. The previous wording implied large-flash cases were easy to pass; they are the ' +
            'cases that are hard to fool.',
        ],
        note:
          'No expected values move for the nine pre-existing cases. Confirmed by the simulator ' +
          'session: sw-07 normalised residual 0.212% -> 0.0201%, now level with its pure-water ' +
          'twin dm-03 at 0.0197%, so nothing salinity-dependent remains in it; sw-06 flow error ' +
          '-1.741% -> -0.300%. The residual that is left does not trend with salinity ' +
          '(0.002-0.003% across 0-115 g/kg at matched temperature) but does with temperature ' +
          '(0.056%), which identifies it as the pure-water baseline difference. See ' +
          'knownLimitations.pureWaterBaseline — neither side should change.',
      },
      v6: {
        added: [],
        removed: [],
        changed: [
          'EVERY expected enthalpy, vapour rate, brine rate and heat duty moves. The seawater ' +
            'salinity terms in h and cp were a home-grown Millero-form pair, not the published ' +
            'correlations. They are now Sharqawy et al. (2010) Eq. (43) for enthalpy (fitted to ' +
            'Bromley et al. 1970) and Eq. (9) for cp (Jamieson et al. 1969) — the accepted ' +
            'sources, and the ones the independent simulator implementation transcribes.',
          'sw-06 moves most (-1.446% on vapour rate): its absolute enthalpies differed ~2.1% at ' +
            '115 g/kg, the largest on the grid, but its 1.3 K flash made the amplification-' +
            'normalised metric blind to it. Pinned magnitudes SHOULD fail here — intended signal.',
          'sw-07 moves +0.707% while dm-03 moves 0.000% at identical temperature and flash. That ' +
            'asymmetry is the whole finding: the disagreement was in the SALINITY term and ' +
            'changed sign across a 30 K flash, so inlet (+0.149%) and outlet (-0.132%) errors ' +
            'ADDED instead of cancelling. Compare sw-01, same salinity but a 9.5 K flash, where ' +
            'both errors are the same sign and it cancels to -0.137%.',
          'All four DM-water cases move 0.000% — the control proving the change is confined to ' +
            'the salinity term and the IAPWS-IF97 pure-water baseline is untouched.',
        ],
        note:
          'Found by the simulator session cross-checking layer 1 against its own transcription, ' +
          'after v5 added the 90 °C cases that made the disagreement visible at all. ' +
          "getSeawaterEnthalpy also narrows to Eq. (43)'s own 10-120 °C envelope while cp keeps " +
          "Eq. (9)'s 0-180 °C, so the two correlations no longer share one invented range.",
      },
      v5: {
        added: [
          'cases sw-07 and dm-03 — ~30 K flash at low amplification, previously inexpressible',
          'inletConsistency.sprayNozzleDeltaPBar',
          'input.sprayNozzleDeltaPBar (omitted where the 3 bar default applies)',
        ],
        removed: [],
        changed: [
          'inletConsistency.inletPressureMbar and expected.heatMassBalance.inlet.pressure — the ' +
            'feed pressure is now chamber + spray-nozzle differential (default 3 bar) instead of ' +
            'a hardcoded operating + 50 mbar. Every case moves. No other expected value changes: ' +
            'liquid enthalpy is nearly pressure-independent, so the flash is unaffected.',
        ],
        note:
          'The v4 knownLimitations.inletPressure entry is resolved and removed. Fixtures are now ' +
          'generated by a checked-in script rather than ad hoc.',
      },
      v4: {
        added: ['cases sw-05 (90,000 ppm) and sw-06 (115,000 ppm)', 'sensitivity.brineSalinityPpm'],
        removed: [],
        note: 'No keys removed. v3 removed usableAsNumericalGate and crossover without listing them, which broke a consumer that read them at import time — removals are now listed explicitly.',
      },
      v3: {
        added: ['sensitivity block'],
        removed: ['usableAsNumericalGate', 'crossover'],
        note: 'Removals were not documented at the time. Recorded here retrospectively.',
      },
      v2: {
        added: ['inletConsistency', 'crossover', 'usableAsNumericalGate'],
        removed: [],
        note: 'Corrected v1, where every inlet was stated below its own saturation pressure.',
      },
    },
    correctionsApplied: [
      'Finding 8 — seawater h and cp salinity terms replaced with the PUBLISHED correlations, ' +
        'Sharqawy et al. (2010) Eq. (43) and Eq. (9). The previous pair was a home-grown ' +
        'Millero-form fit: internally self-consistent, externally unanchored.',
      'Finding 1 — seawater enthalpy salinity exponent S^2 -> S^1.5. SUPERSEDED by finding 8, ' +
        'which replaced the correlation that exponent belonged to.',
      'Finding 5 — pure-water h and cp re-based on IAPWS-IF97 Region 1; agreement with published h_f now better than 0.06% at every point with no sign change.',
      'Inlet pressure is a real input — the spray-nozzle differential — not a hardcoded allowance.',
      'All inlets genuinely subcooled, asserted by the generator rather than by inspection.',
    ],
    knownLimitations: {
      pureWaterBaseline:
        'A permanent ~0.02-0.06% difference against the simulator implementation, and not a ' +
        'defect on either side. This codebase uses IAPWS-IF97 Region 1 for pure water and adds ' +
        "Eq. (43)'s salinity correction; the simulator uses Eq. (43) whole, including Sharqawy's " +
        'own h_w polynomial, which is not IF97. Adopting theirs here would import a 0.13% ' +
        'pure-water error to obtain the salt term; adopting ours there would break their layer-1 ' +
        'agreement against the MIT published tables, which are generated from the library that ' +
        "uses Sharqawy's h_w. The residual is identifiable: it varies with temperature and NOT " +
        'with salinity, and is an order of magnitude inside every gate.',
      boilingPointElevation:
        'RESOLVED in v8, and the resolution is worth keeping. The BPE correlation was never ' +
        'wrong: Sharqawy Eq. (36), BPE = A*S^2 + B*S with S as MASS FRACTION, ' +
        'A = 17.95 + 0.2823*t - 4.584e-4*t^2, B = 6.56 + 0.05267*t + 1.536e-4*t^2, reproduces ' +
        'the reference to 0.003%. The defect was the ARGUMENT: BPE was evaluated at the feed ' +
        'salinity when the brine leaving is at the outlet salinity. It is now solved as a fixed ' +
        'point together with the brine enthalpy, which the code already iterated. Publishing the ' +
        'coefficients here in v7 is what closed it — an output diff says WHETHER two ' +
        'implementations differ, a transcription diff says WHERE. Publish coefficients, not just ' +
        'outputs, in both directions.',
      salinityCeiling:
        'Feed salinity cannot reach 120,000 ppm because the BRINE concentrates past the MIT correlation limit and the property function throws (correctly). sw-06 at 115,000 ppm feed is close to the practical maximum.',
      hCpNotAnIntegralPair:
        'h (Eq. 43, from Bromley) and cp (Eq. 9, from Jamieson) are independent fits to different ' +
        'datasets and disagree by up to ~2.2% on dh/dT versus cp at 120 g/kg and 90 °C (0.43% ' +
        'inside the MED design envelope). That is a property of the published correlations, not ' +
        'a defect, and using both is what the MIT library does. It is acceptable here because ' +
        'this codebase uses cp only for sensible duties and h only for stream enthalpies, never ' +
        'differentiating one to obtain the other. A DYNAMIC energy balance cannot make that ' +
        'assumption and should use the derivative of Eq. (43), accepting a cp that is not ' +
        "Jamieson's — the opposite trade.",
      normalisedMetricBlindSpot:
        'The amplification-normalised enthalpy difference is the right metric for a vapour-rate ' +
        'gate, but it cancels systematic salinity error by construction. sw-06 differed ~2.1% on ' +
        'ABSOLUTE enthalpy while reading 0.038% normalised, because its flash is only 1.3 K wide. ' +
        'Gate on the normalised quantity; DIAGNOSE on the absolute one. Large-flash cases ' +
        '(sw-07, dm-03) are where the correlations must genuinely agree — small-flash cases ' +
        'cannot tell you.',
      nozzleFlowCoupling:
        'The spray-nozzle differential sets the feed pressure but the feed FLOW is still stated directly, as this is a steady-state fixture. A dynamic model must close the loop: flow through the nozzle follows Q = Q_rated x (dP / P_rated)^n, so it responds to chamber pressure.',
    },
    gateGuidance: {
      recommended: 'Gate on vapour rate, vapour and brine temperatures, and mass/energy closure.',
      amplificationWarning:
        `Amplification is computed per case in the sensitivity block and spans ${best.sensitivity.amplificationFactor} ` +
        `to ${worst.sensitivity.amplificationFactor} across this set. The worst is ${worst.id} at ` +
        `${worst.sensitivity.amplificationFactor}, where a 0.5% vapour-rate gate implies ` +
        `${worst.sensitivity.enthalpyAccuracyNeededForHalfPercentFlowGate} enthalpy agreement — tighter than ` +
        'either implementation claims. Read the per-case value; do not assume a single figure.',
      largeFlashCases:
        `${cases
          .filter((c) => c.sensitivity.flashDeltaTK > 25)
          .map((c) => c.id)
          .join(', ')} are the large-dT cases, and they matter for a reason that has nothing to ` +
        'do with their looser derived tolerance. A property error that varies with temperature ' +
        'appears in (h_in - h_out) only when the two ends are far enough apart for the error to ' +
        'differ between them. Over a short flash the inlet and outlet errors are nearly equal and ' +
        'CANCEL; over ~30 K they can carry opposite signs and ADD. That is exactly how the v6 ' +
        'salinity-term defect was found, and why a grid confined to the design envelope missed ' +
        'it. Large flash dT is where the correlations must genuinely agree; small flash dT ' +
        'cannot tell you whether they do. Keep these cases permanently — they are the detector, ' +
        'not a temporary probe.',
      preferred:
        'Gate on the enthalpy difference with the case amplification divided out, as well as on vapour rate. The normalised quantity is comparable between cases; raw flow error is not.',
    },
    units: {
      flowRate: 't/h',
      temperature: 'degC',
      pressure: 'mbar(a)',
      enthalpy: 'kJ/kg',
      heatDuty: 'kW',
      salinity: 'ppm',
      length: 'mm',
      volume: 'm3',
      area: 'm2',
      elevation: 'm',
      nozzleDifferential: 'bar',
    },
    cases,
  };

  return { payload, amplifications, best, worst };
}

/** Serialised exactly as the committed artifact. The file is in .prettierignore
 *  so this formatting is the only formatting it ever has. */
export function serialiseFixturePayload(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const FIXTURE_OUTPUT_PATH = OUTPUT_PATH;

it('regenerates the flash chamber fixture set', () => {
  const { payload, amplifications, best, worst } = buildFixturePayload();

  writeFileSync(OUTPUT_PATH, serialiseFixturePayload(payload));

  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${payload.cases.length} cases (schemaVersion ${SCHEMA_VERSION}) to ${OUTPUT_PATH}\n` +
      `Amplification ${Math.min(...amplifications)}–${Math.max(...amplifications)} ` +
      `(best ${best.id}, worst ${worst.id})`
  );
});

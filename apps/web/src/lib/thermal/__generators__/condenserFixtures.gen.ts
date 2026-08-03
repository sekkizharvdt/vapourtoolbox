/**
 * Regenerates docs/thermal/fixtures/condenser-cases.json.
 *
 * Run: pnpm fixtures:condenser
 *
 * Supplies the rung-5 steady-state gate for the MED final condenser — spec §7.2,
 * "Condenser | heatExchangerSizing | duty, outlet temperatures, LMTD".
 *
 * Written to answer six questions the simulator session asked in advance rather
 * than discovering them across revisions. Each has its own top-level key:
 *
 *   overallU          — which correlations, and whether a cap is ever applied
 *   lmtdConvention    — arrangement, and whether an F-factor is used
 *   filmCoefficients  — tube and shell sides SEPARATELY, never a combined total
 *   offDesign         — whether U is a point or a curve. It is a point
 *   hotwellHoldup     — ABSENT, stated so it is not rediscovered
 *   ventCondenser     — NOT MODELLED, which turns out to match their model
 *
 * The `.gen.ts` suffix keeps it out of `testMatch`; it runs under jest because
 * the calculator's import graph reaches `@vapour/firebase`.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { VENT_FRACTION } from '@vapour/constants';

import { designMEDPlant } from '../med/designPipeline';
import type { MEDDesignerInput } from '../med/designerTypes';

const SCHEMA_VERSION = 1;

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
  'condenser-cases.json'
);

const round = (n: number, d: number): number => Number(n.toFixed(d));

/**
 * Latent heat of water near the MED steam temperature, kJ/kg. Used only for the
 * order-of-magnitude scale check below, never in a reported value.
 */
const LATENT_HEAT_NEAR_60C_KJ_KG = 2350;

interface CaseSpec {
  id: string;
  note: string;
  input: MEDDesignerInput;
}

/**
 * BARC-anchored base, varied on the quantities that move condenser duty.
 *
 * NOTE THE UNITS. `MEDDesignerInput.steamFlow` is **T/h**, while
 * `MEDEngineInput.steamFlow` — used by the golden tests — is **kg/h**. The BARC
 * figure is 1,040 kg/h, so it is 1.04 here. Passing 1040 produced a 604 MW
 * condenser duty and 588,000 tubes: a clean 1000x, and it would have shipped as
 * a gate fixture if the magnitudes had not been read. The guardrail below now
 * catches this class of error rather than relying on someone noticing.
 */
const BASE: MEDDesignerInput = {
  steamFlowTPerH: 1.04,
  steamTemperature: 62.2,
  seawaterTemperature: 30,
  targetGOR: 9.8,
  numberOfEffects: 6,
  seawaterSalinity: 35000,
  maxBrineSalinity: 59400,
  condenserApproach: 4,
};

const CASE_SPECS: CaseSpec[] = [
  {
    id: 'cond-01',
    note: 'BARC-anchored base case. 30 °C seawater inlet.',
    input: { ...BASE },
  },
  {
    id: 'cond-02',
    note: 'Colder seawater. Raises LMTD at fixed duty, so area falls — the cleanest single-variable check on the LMTD convention.',
    input: { ...BASE, seawaterTemperature: 20 },
  },
  {
    id: 'cond-03',
    note: 'Warmer seawater. The opposite direction, and the one that squeezes LMTD toward the approach.',
    input: { ...BASE, seawaterTemperature: 35 },
  },
  {
    id: 'cond-04',
    note: 'Wider condenser approach at the base seawater temperature — moves the seawater outlet independently of the inlet.',
    input: { ...BASE, condenserApproach: 6 },
  },
  {
    id: 'cond-05',
    note: 'Fewer effects, so more vapour reaches the condenser: a materially larger duty on the same geometry basis.',
    input: { ...BASE, numberOfEffects: 4 },
  },
];

function buildCase(spec: CaseSpec) {
  const result = designMEDPlant(spec.input);
  const c = result.condenser;

  return {
    id: spec.id,
    note: spec.note,
    input: spec.input,
    expected: {
      // Duty and driving force
      vapourFlowTPerH: round(c.vapourFlow, 4),
      vapourTempC: round(c.vapourTemp, 4),
      dutyKW: round(c.duty, 3),
      lmtdC: round(c.lmtd, 4),

      // Film coefficients, SEPARATELY. Publishing components rather than a
      // combined U is what let the vent-gas rule be checked; the same applies
      // here — a single U can only be compared, two coefficients can be
      // diagnosed.
      tubeSideHTC: round(c.tubeSideHTC, 3),
      shellSideHTC: round(c.shellSideHTC, 3),
      overallU: round(c.overallU, 3),

      // Geometry
      requiredAreaM2: round(c.requiredArea, 3),
      designAreaM2: round(c.designArea, 3),
      tubes: c.tubes,
      passes: c.passes,
      tubeVelocityMS: round(c.velocity, 4),
      tubeODmm: c.tubeOD,
      tubeLengthMM: c.tubeLengthMM,
      shellODmm: round(c.shellODmm, 2),

      // Coolant
      seawaterFlowTPerH: round(c.seawaterFlow, 3),
      seawaterFlowM3h: round(c.seawaterFlowM3h, 3),
      seawaterInletTempC: spec.input.seawaterTemperature,
    },
  };
}

export function buildCondenserFixturePayload() {
  const cases = CASE_SPECS.map(buildCase);

  // Guardrails — a condenser case with no driving force or no duty would gate
  // nothing while looking complete.
  for (const c of cases) {
    if (c.expected.lmtdC <= 0) {
      throw new Error(`${c.id}: LMTD <= 0. Temperature cross — not a valid reference case.`);
    }
    if (c.expected.dutyKW <= 0) {
      throw new Error(`${c.id}: non-positive duty.`);
    }
    if (c.expected.overallU <= 0 || c.expected.tubeSideHTC <= 0 || c.expected.shellSideHTC <= 0) {
      throw new Error(`${c.id}: a heat transfer coefficient is non-positive.`);
    }

    // Scale check. The condenser rejects roughly what the steam brought in, so
    // its duty must be commensurate with the steam thermal input. A units slip
    // on `steamFlow` (T/h here, kg/h in MEDEngineInput) moves this by 1000x and
    // nothing else in the pipeline objects — the first version of this fixture
    // reported 604 MW and 588,000 tubes.
    const steamThermalKW = (c.input.steamFlowTPerH * 1000 * LATENT_HEAT_NEAR_60C_KJ_KG) / 3600;
    const ratio = c.expected.dutyKW / steamThermalKW;
    if (ratio < 0.1 || ratio > 10) {
      throw new Error(
        `${c.id}: condenser duty ${c.expected.dutyKW.toFixed(0)} kW is ${ratio.toFixed(1)}x the ` +
          `steam thermal input ${steamThermalKW.toFixed(0)} kW. Expected the same order — check ` +
          'the units on steamFlow (T/h here, kg/h in MEDEngineInput).'
      );
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: 'apps/web/src/lib/thermal/__generators__/condenserFixtures.gen.ts',
    generatedFor: 'vapour-dynamics rung 5 — spec §7.2 condenser steady-state gate',
    schemaChanges: {
      v1: {
        added: ['condenser cases', 'overallU', 'lmtdConvention', 'filmCoefficients', 'offDesign'],
        removed: [],
        note: 'First revision. Answers the six questions asked before the fixture was built rather than across revisions after it.',
      },
    },
    units: {
      flow: 't/h',
      volumetricFlow: 'm3/h',
      temperature: 'degC',
      duty: 'kW',
      lmtd: 'K',
      htc: 'W/(m2·K)',
      area: 'm2',
      length: 'mm',
      velocity: 'm/s',
    },

    overallU: {
      relation: '1/U = 1/h_shell + R_f,shell + wall + R_f,tube·(OD/ID) + (1/h_tube)·(OD/ID)',
      tubeSideCorrelation: 'Dittus-Boelter, seawater forced convection',
      shellSideCorrelation:
        'Nusselt film condensation, with Kern row correction and an NCG degradation factor',
      capApplied: false,
      capNote:
        'There is NO cap on the condenser U. This differs from the evaporator, which is capped ' +
        'at MED_EVAPORATOR_DESIGN_U_WM2K (3,100 W/m²·K) and reports `overallHTCSource` as ' +
        'correlated / design-cap / user-override. `sizeCondensingHX` has no such limit, so the ' +
        'reported U is always the correlated value and "which was used" has one answer here.',
    },

    lmtdConvention: {
      arrangement: 'COUNTER',
      correctionFactor: 1.0,
      correctionFactorApplied: false,
      note:
        'Counterflow, with the hot side ISOTHERMAL (hotInlet = hotOutlet = vapour temperature), ' +
        'so dT1 = T_vap - T_sw,out and dT2 = T_vap - T_sw,in. The F-factor branch in ' +
        'calculateLMTD only fires for CROSSFLOW and SHELL_AND_TUBE; COUNTER leaves it at 1.0.',
      whyFactorOneIsCorrect:
        'With an isothermal hot side the two temperature differences are the same PAIR under ' +
        'counterflow and parallel flow — only their order swaps — and LMTD is symmetric in that ' +
        'pair. So the arrangement does not change the answer and F = 1 is correct rather than an ' +
        'omission. Stated because an unexplained F = 1 is exactly the kind of thing that becomes ' +
        'a 2% mystery for three revisions.',
    },

    filmCoefficients: {
      reportedSeparately: true,
      note:
        'tubeSideHTC and shellSideHTC are given per case, never only as a combined U. A single ' +
        'U can be compared; two coefficients can be diagnosed. This is the same reason the ' +
        'vacuum fixture reports dry NCG and vapour separately rather than one total.',
    },

    offDesign: {
      isDesignPoint: true,
      note:
        'U IS A POINT, NOT A CURVE. `sizeCondensingHX` takes a design tube velocity (1.8 m/s for ' +
        'the condenser) and iterates the tube count until the actual velocity matches, then ' +
        'computes U at that velocity. There is no U(load) or U(velocity) relation anywhere in ' +
        'this calculator, and interpolating these five cases into one would be inventing a shape ' +
        'the model does not have — the same error as building an ejector capacity curve out of a ' +
        'single sizing point.',
      whatCanBeDoneInstead:
        'The tube-side coefficient IS a velocity relation: Dittus-Boelter gives Nu ∝ Re^0.8, so ' +
        'h_tube ∝ v^0.8 at fixed properties. A dynamic model can scale h_tube off-design from ' +
        'the reported design-point value and re-form U with the shell side held, which is ' +
        'defensible. The shell side has no equivalent scaling here: Nusselt condensation depends ' +
        'on the film and the row count, not on a load parameter this calculator varies.',
      tubeSideExponent: 0.8,
    },

    knownLimitations: {
      hotwellHoldup:
        'ABSENT. The hotwell exists as a concept — gross condensate is extracted from it — but ' +
        'no volume, level or inventory is modelled anywhere. Same reason MED effects have no ' +
        'liquid holdup: there is no liquid inventory model, only a shipping-weight fill ' +
        'allowance used for operating weight.',
      ventCondenser:
        'NOT MODELLED, and this is a match rather than a gap. `finalCondenserModel` removes a ' +
        `flat VENT_FRACTION = ${VENT_FRACTION} of the vapour to vacuum and models nothing ` +
        'between the vessel and the vacuum system — no vent condenser, no separate coolant. A ' +
        'coupled model drawing its vent at vessel conditions with nothing in between is doing ' +
        'the same thing, so `ventGasTemperature` from the vacuum fixture applies as-is.',
      metalMass:
        'DELIBERATELY NOT IN THIS FIXTURE. The condenser mass is `designArea x 50 kg/m²`, a ' +
        'budgetary allowance assuming titanium, with no geometry behind it — despite full tube ' +
        'geometry being available on this very object. A fixture is precisely where a cost ' +
        'allowance would be read as a thermal mass, so it is excluded rather than caveated. ' +
        'Condenser thermal mass is a §4.3 calibration parameter with no prior.',
      designMarginInArea:
        'designAreaM2 carries the design margin; requiredAreaM2 does not. Gate against ' +
        'requiredArea when checking the heat transfer, and against designArea only when ' +
        'checking the sizing decision.',
    },

    gateGuidance: {
      order:
        'Gate on duty and LMTD first, then the two film coefficients, then U, then required ' +
        'area. A U mismatch with both coefficients matching is a resistance-network difference; ' +
        'a coefficient mismatch is a correlation difference. Checking U alone cannot separate them.',
      whatNotToGate:
        'Do not gate on designArea without accounting for the design margin, on tube count ' +
        '(a selection, not a physical result), or on anything off-design.',
    },

    cases,
  };
}

export function serialiseCondenserFixturePayload(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const CONDENSER_FIXTURE_OUTPUT_PATH = OUTPUT_PATH;

it('regenerates the condenser fixture set', () => {
  const payload = buildCondenserFixturePayload();

  writeFileSync(OUTPUT_PATH, serialiseCondenserFixturePayload(payload));

  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${payload.cases.length} condenser cases (schemaVersion ${SCHEMA_VERSION}) to ${OUTPUT_PATH}`
  );
});

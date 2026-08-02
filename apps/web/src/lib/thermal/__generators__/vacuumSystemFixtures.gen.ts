/**
 * Regenerates docs/thermal/fixtures/vacuum-system-cases.json.
 *
 * Run: pnpm fixtures:vacuum-system
 *
 * Supplies the external dynamic-simulator work with two distinct things for
 * rung 3 (NCG inventory becomes a state; vacuum pull-down becomes answerable):
 *
 *   1. `capacityCurve` — S(P), the pump capacity as a function of suction
 *      pressure. This is an INPUT (spec §4.2 boundary condition), not a gate.
 *   2. `evacuationCases` — pull-down curves from `calculateVacuumSystem`, which
 *      integrates V·dP/dt = −S(P)·P. This is the GATE (spec §7.2.1 rung 3a),
 *      and the strong kind: the simulator solves the same ODE, so a mismatch is
 *      a defect rather than a modelling-choice difference.
 *
 * THIS IS A LIQUID-RING PUMP CURVE. It is NOT an ejector curve, and the
 * distinction is load-bearing — see knownLimitations.noEjectorCapacityCurve.
 *
 * Executed through jest rather than as a bare node script, for the same reason
 * as the flash-chamber generator: the calculator's import graph reaches
 * `@vapour/firebase`, whose client module never settles outside a browser-like
 * environment. The `.gen.ts` suffix keeps it out of `testMatch`.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getSaturationPressure, getSaturationTemperature } from '@vapour/constants';

import {
  calculateVacuumSystem,
  lrvpCapacityFraction,
  LRVP_RATING_SUCTION_MBAR,
  LRVP_RATING_SEAL_TEMP_C,
  LRVP_OPEN_SUCTION_CAP,
  VENT_APPROACH_C,
  ventGasTemperatureC,
  type VacuumSystemInput,
} from '../vacuumSystemCalculator';

const SCHEMA_VERSION = 2;

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
  'vacuum-system-cases.json'
);

const round = (n: number, d: number): number => Number(n.toFixed(d));

/** Seal-water temperatures spanning chilled loop to warm seawater. */
const SEAL_TEMPS_C = [15, 20, 25, 30, 35];

/** Log-ish pressure grid from atmospheric down past every blank-off. */
const PRESSURE_GRID_MBAR = [
  1013, 800, 600, 400, 300, 200, 150, 100, 80, 60, 50, 40, 30, 25, 20, 15, 12, 10,
];

function buildCapacityCurve() {
  const blankOff = SEAL_TEMPS_C.map((tempC) => ({
    sealWaterTempC: tempC,
    blankOffPressureMbar: round(getSaturationPressure(tempC) * 1000, 2),
  }));

  const samples = SEAL_TEMPS_C.map((tempC) => ({
    sealWaterTempC: tempC,
    // S(P) / S_rated, dimensionless. Multiply by the frame rating in m³/h.
    fractionOfRating: PRESSURE_GRID_MBAR.map((pressureMbar) => ({
      pressureMbar,
      fraction: round(
        Math.min(LRVP_OPEN_SUCTION_CAP, lrvpCapacityFraction(pressureMbar, tempC)),
        6
      ),
    })),
  }));

  return {
    machine: 'Liquid ring vacuum pump (LRVP), single stage',
    quantity: 'S(P) / S_rated — volumetric capacity as a fraction of the frame rating',
    relation: 'S(P)/S_rated = min(CAP, max(0, (P - Psat(T_seal)) / (P_rating - Psat(T_rating))))',
    constants: {
      P_rating_mbar: LRVP_RATING_SUCTION_MBAR,
      T_rating_C: LRVP_RATING_SEAL_TEMP_C,
      CAP: LRVP_OPEN_SUCTION_CAP,
      denominator_mbar: round(
        LRVP_RATING_SUCTION_MBAR - getSaturationPressure(LRVP_RATING_SEAL_TEMP_C) * 1000,
        4
      ),
    },
    // Stated so the comparison can be a transcription diff rather than an output
    // diff — the lesson from the flash-chamber BPE finding, which stayed open
    // across three revisions while only outputs were compared.
    note:
      'The relation is closed form and exact; the samples below are a convenience, not the ' +
      'definition. Capacity reaches ZERO at the seal-water saturation pressure — that physical ' +
      'blank-off is what makes this curve usable for a pull-down integration.',
    blankOff,
    samples,
  };
}

/**
 * The vent-gas temperature rule, published rather than left to be inverted.
 *
 * The simulator session recovered the linear branch from `dryNcgInKgH` /
 * `vapourInKgH` to 0.01 mbar — possible only because the split is reported as
 * two numbers rather than one total. It could not have recovered the saturation
 * ceiling, because no case on the v1 grid exercised it. Publishing the relation
 * closes that, and case lrvp-06 exercises the branch so the statement is checked
 * rather than asserted.
 */
function buildVentGasRule(cases: ReturnType<typeof buildEvacuationCase>[]) {
  return {
    relation: 'T_vent = min(tSat(P_suction), T_coolant_inlet + VENT_APPROACH_C)',
    constants: { VENT_APPROACH_C },
    rationale:
      'The NCG offtake sits at the condenser cold end, so extracted gas cools to roughly the ' +
      'tube-side coolant inlet plus a small approach — but never above the vapour-space ' +
      'saturation temperature at suction pressure. T_vent then sets the water vapour riding with ' +
      'the NCG by Dalton, and therefore the volumetric load the pump sees.',
    perCase: cases.map((c) => {
      const tSat = getSaturationTemperature(c.input.suctionPressureMbar / 1000);
      const linear = c.input.coolantInletTempC + VENT_APPROACH_C;
      return {
        id: c.id,
        suctionPressureMbar: c.input.suctionPressureMbar,
        coolantInletTempC: c.input.coolantInletTempC,
        saturationTempC: round(tSat, 3),
        linearBranchTempC: round(linear, 3),
        ventGasTempC: round(
          ventGasTemperatureC(c.input.suctionPressureMbar, c.input.coolantInletTempC),
          3
        ),
        branch: tSat < linear ? 'saturation-ceiling' : 'linear',
      };
    }),
  };
}

interface EvacuationCaseSpec {
  id: string;
  note: string;
  input: VacuumSystemInput;
}

const EVACUATION_SPECS: EvacuationCaseSpec[] = [
  {
    id: 'lrvp-01',
    note: 'Design point for a small MED final condenser vent. Chilled seal loop reaches deep vacuum.',
    input: {
      suctionPressureMbar: 60,
      coolantInletTempC: 30,
      dischargePressureMbar: 1013,
      ncgMode: 'manual',
      dryNcgFlowKgH: 20,
      motivePressureBar: 10,
      coolingWaterTempC: 30,
      sealWaterTempC: 20,
      trainConfig: 'lrvp_only',
      evacuationVolumeM3: 50,
    },
  },
  {
    id: 'lrvp-02',
    note:
      'Same duty on WARMER seal water. Blank-off rises from 23.4 to 31.7 mbar, so the capacity ' +
      'FRACTION at the 60 mbar duty point falls from 0.441 to 0.341 — and the sizing loop ' +
      'therefore selects a BIGGER pump (2x LRVP-3000 against 2x LRVP-2000). The pull-down is ' +
      'consequently FASTER than case 01, not slower, at 220 kW against 150 kW. Read alongside ' +
      'case 01: warmer seal water costs pump size and power, not evacuation time.',
    input: {
      suctionPressureMbar: 60,
      coolantInletTempC: 30,
      dischargePressureMbar: 1013,
      ncgMode: 'manual',
      dryNcgFlowKgH: 20,
      motivePressureBar: 10,
      coolingWaterTempC: 30,
      sealWaterTempC: 25,
      trainConfig: 'lrvp_only',
      evacuationVolumeM3: 50,
    },
  },
  {
    id: 'lrvp-03',
    note: 'Larger vessel, shallower vacuum — pull-down time scales linearly with volume at fixed S(P).',
    input: {
      suctionPressureMbar: 100,
      coolantInletTempC: 30,
      dischargePressureMbar: 1013,
      ncgMode: 'manual',
      dryNcgFlowKgH: 40,
      motivePressureBar: 10,
      coolingWaterTempC: 30,
      sealWaterTempC: 20,
      trainConfig: 'lrvp_only',
      evacuationVolumeM3: 200,
    },
  },
  {
    id: 'lrvp-04',
    note: 'HEI leakage rather than a manual NCG figure, so the load is derived from system volume per the standard.',
    input: {
      suctionPressureMbar: 80,
      coolantInletTempC: 28,
      dischargePressureMbar: 1013,
      ncgMode: 'hei_leakage',
      systemVolumeM3: 120,
      motivePressureBar: 10,
      coolingWaterTempC: 28,
      sealWaterTempC: 20,
      trainConfig: 'lrvp_only',
      evacuationVolumeM3: 120,
    },
  },
  {
    id: 'lrvp-05',
    note:
      'ADDED v2. A THIRD cooling-water temperature (22 °C). With only two distinct values on the ' +
      'grid, the 2 K vent approach was identified but not distinguished from any other rule ' +
      'passing through both points. This is the case that separates them.',
    input: {
      suctionPressureMbar: 80,
      coolantInletTempC: 22,
      dischargePressureMbar: 1013,
      ncgMode: 'manual',
      dryNcgFlowKgH: 20,
      motivePressureBar: 10,
      coolingWaterTempC: 22,
      sealWaterTempC: 15,
      trainConfig: 'lrvp_only',
      evacuationVolumeM3: 100,
    },
  },
  {
    id: 'lrvp-06',
    note:
      'ADDED v2, and the more important of the two. Here the SATURATION CEILING binds: at ' +
      '35 mbar the vapour-space saturation temperature is 26.67 °C, below the 34 °C that a bare ' +
      '2 K approach to 32 °C cooling water would give, so the vent gas is capped at saturation. ' +
      'The rule is min(tSat(P), T_cw + 2), not T_cw + 2 — and the ceiling branch is invisible to ' +
      'inversion unless a case exercises it. Every other case on this grid sits on the linear ' +
      'branch.',
    input: {
      suctionPressureMbar: 35,
      coolantInletTempC: 32,
      dischargePressureMbar: 1013,
      ncgMode: 'manual',
      dryNcgFlowKgH: 15,
      motivePressureBar: 10,
      coolingWaterTempC: 32,
      sealWaterTempC: 15,
      trainConfig: 'lrvp_only',
      evacuationVolumeM3: 80,
    },
  },
];

function buildEvacuationCase(spec: EvacuationCaseSpec) {
  const result = calculateVacuumSystem(spec.input);
  const lrvpStage = result.stages.find((st) => st.type === 'lrvp');

  return {
    id: spec.id,
    note: spec.note,
    input: spec.input,
    expected: {
      // The scale factor for the capacity curve: S(P) = totalRatedCapacityM3h ×
      // fractionOfRating(P). Surfaced here rather than left to be reconstructed
      // from `stages`, because getting it wrong silently rescales the whole
      // pull-down while leaving its shape correct — the hardest kind of
      // mismatch to spot.
      totalRatedCapacityM3h: lrvpStage
        ? (lrvpStage.lrvpRatedCapacityM3h ?? 0) * (lrvpStage.lrvpCount ?? 1)
        : null,
      evacuationTimeMinutes: result.evacuationTimeMinutes ?? null,
      evacuationSteps: result.evacuationSteps ?? null,
      totalPowerKW: result.totalPowerKW,
      stages: result.stages,
    },
    warnings: result.warnings,
  };
}

export function buildVacuumFixturePayload() {
  const capacityCurve = buildCapacityCurve();
  const evacuationCases = EVACUATION_SPECS.map(buildEvacuationCase);

  // Guardrails. A pull-down fixture whose curve never reaches zero, or whose
  // integration did not run, would silently validate the wrong thing.
  for (const c of evacuationCases) {
    if (c.expected.evacuationSteps === null || c.expected.evacuationSteps.length === 0) {
      throw new Error(`${c.id}: no evacuation curve was produced — the case does not pump down.`);
    }
    if (!Number.isFinite(c.expected.evacuationTimeMinutes ?? NaN)) {
      throw new Error(
        `${c.id}: evacuation time is not finite, which means capacity reached zero above the ` +
          'target pressure. Raise the target or lower the seal-water temperature.'
      );
    }
    const target = c.input.suctionPressureMbar;
    const blankOff = getSaturationPressure(c.input.sealWaterTempC) * 1000;
    if (target <= blankOff) {
      throw new Error(
        `${c.id}: target ${target} mbar is at or below the ${blankOff.toFixed(1)} mbar blank-off ` +
          `for ${c.input.sealWaterTempC} °C seal water — physically unreachable.`
      );
    }
  }

  for (const s of capacityCurve.samples) {
    const atBlankOff = s.fractionOfRating.find(
      (f) => f.pressureMbar <= getSaturationPressure(s.sealWaterTempC) * 1000
    );
    if (atBlankOff && atBlankOff.fraction !== 0) {
      throw new Error(
        `Seal ${s.sealWaterTempC} °C: capacity is ${atBlankOff.fraction} at ${atBlankOff.pressureMbar} mbar, ` +
          'at or below blank-off — it must be exactly zero.'
      );
    }
  }

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: 'apps/web/src/lib/thermal/__generators__/vacuumSystemFixtures.gen.ts',
    generatedFor: 'vapour-dynamics rung 3 — spec §4.2 (S(P) input) and §7.2.1 (pull-down gate)',
    schemaChanges: {
      v2: {
        added: [
          'ventGasTemperature — the vent-gas rule published outright, with constants and a ' +
            'per-case branch label, instead of left to be inverted from the NCG/vapour split.',
          'case lrvp-05 (22 °C cooling water) — a THIRD distinct T_coolant. With two values the ' +
            '2 K approach was identified but not distinguished from any other rule through both ' +
            'points.',
          'case lrvp-06 (35 mbar, 32 °C cooling water) — exercises the SATURATION CEILING ' +
            'branch, which no v1 case did and which inversion therefore could not reveal.',
        ],
        removed: [],
        changed: [],
        note:
          'No existing case moves. Prompted by the simulator session recovering the linear ' +
          'branch of the vent rule from `dryNcgInKgH` / `vapourInKgH` to 0.01 mbar — possible ' +
          'only because the split is reported as two numbers rather than one total, and a good ' +
          'demonstration that publishing components beats publishing totals. They correctly ' +
          'flagged that two data points identify but do not distinguish the rule; the ceiling ' +
          'branch is the part inversion could not have found at all.',
      },
      v1: {
        added: ['capacityCurve', 'evacuationCases'],
        removed: [],
        note: 'First revision. Supplies the LRVP capacity curve and pull-down reference for rung 3.',
      },
    },
    units: {
      pressure: 'mbar(a)',
      temperature: 'degC',
      volume: 'm3',
      capacity: 'm3/h',
      time: 'minutes',
      power: 'kW',
      ncgFlow: 'kg/h',
    },
    knownLimitations: {
      noEjectorCapacityCurve:
        'THIS IS A LIQUID-RING PUMP CURVE, NOT AN EJECTOR CURVE. Vapour Toolbox cannot currently ' +
        'produce an ejector S(P), and supplying this one in its place would be wrong rather than ' +
        'approximate. `sizeEjectorStage` computes motive steam for a load at a design point — a ' +
        'point, not a curve — and inverting it fails on four counts: (1) capacity never reaches ' +
        'zero, because the CR factor floors at 0.2 and Ra clamps at 0.05, so an integration of ' +
        'V·dP/dt = -S(P)·P would reach ANY vacuum given time and the gate would pass; (2) the CR ' +
        'factor that governs the curve is described in its own source comment as an interim ' +
        'correlation pending a rebuild against the Huang model, and below ~150 mbar it sits on ' +
        'its floor rather than evaluating; (3) pull-down entrains AIR while Ra_theo is a ' +
        'steam-steam enthalpy ratio, so the sqrt(M_H2O/M_mix) correction becomes the dominant ' +
        'term far outside its calibration; (4) as P_suction approaches P_discharge the ' +
        'denominator (h_g(T_d) - h_g(T_s)) tends to zero and Ra diverges, so the top of the ' +
        'curve is a clamp and a fallback constant. Closing this properly needs HEI 2647 ' +
        'air-equivalent capacity curves (which include breakoff), manufacturer performance ' +
        'curves, or the Huang rebuild.',
      ejectorTrainsUseATemporaryLrvp:
        'For `single_ejector` and `two_stage_ejector` configurations the calculator sizes a ' +
        'TEMPORARY LRVP to estimate evacuation and warns that a real train needs a separate pump ' +
        'or hogging ejector. Those cases are deliberately not in this fixture: the pull-down ' +
        'would be the substitute machine, not the plant.',
      openSuctionCap:
        `Capacity is capped at ${LRVP_OPEN_SUCTION_CAP}x the frame rating toward atmospheric, ` +
        'because a liquid ring pump on open suction is displacement-limited rather than following ' +
        'the linear blank-off relation. The cap binds above roughly 150-200 mbar depending on ' +
        'seal temperature, so the early pull-down is flat.',
      integrationScheme:
        'evacuationSteps come from 20 log-spaced pressure intervals, evaluating S(P) at the ' +
        'midpoint of each and applying t = V·ln(P_high/P_low)/S. A simulator using a different ' +
        'step count or quadrature will differ slightly on cumulative time while agreeing on the ' +
        'curve shape — compare S(P) pointwise first, then the integral.',
      noVapourLoad:
        'The pull-down integration treats the vessel contents as a single compressible gas. It ' +
        'does not model vapour generated by flashing liquid during evacuation, which in a real ' +
        'MED start-up is significant once the vessel reaches the liquid saturation pressure. ' +
        'Rung 3 should expect this fixture to describe an EMPTY vessel.',
    },
    gateGuidance: {
      partA:
        'Gate first on S(P) pointwise against `capacityCurve.relation`, which is closed form and ' +
        'exact — not on the sampled values, which are rounded. Agreement should be at machine ' +
        'precision; anything else is a transcription difference and worth finding before the ' +
        'integration is compared.',
      partB:
        'Then gate on `evacuationSteps`. Both sides integrate V·dP/dt = -S(P)·P, so a mismatch ' +
        'here with part A passing is a quadrature difference — check step count before ' +
        'suspecting physics.',
      leakage:
        'These cases have NO in-leakage term during pull-down: the curve runs to the target ' +
        'pressure rather than asymptoting. Spec §7.2.1 part (b) — pressure asymptoting to P* ' +
        'where in-leakage mass rate equals capacity mass rate — is NOT covered here and needs ' +
        'the HEI leakage table applied on the simulator side.',
      sizingIsNotCapacity:
        'Each case reports `totalRatedCapacityM3h`, the pump the SIZING loop selected for the ' +
        'continuous duty. Use it as given; do not re-derive it. Cases 01 and 02 show why: warmer ' +
        'seal water lowers the capacity fraction at the duty point, so the loop picks a larger ' +
        'frame, and the pull-down comes out FASTER on worse seal water. That is the sizing ' +
        'response, not the capacity curve, and conflating the two will look like a sign error ' +
        'in S(P).',
      blankOff:
        'The physically important feature is that S(P) reaches exactly zero at the seal-water ' +
        'saturation pressure. A pull-down model that can reach any vacuum given time has lost ' +
        'that limit, and will pass a naive gate while being qualitatively wrong.',
    },
    ventGasTemperature: buildVentGasRule(evacuationCases),
    capacityCurve,
    evacuationCases,
  };

  return payload;
}

export function serialiseVacuumFixturePayload(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const VACUUM_FIXTURE_OUTPUT_PATH = OUTPUT_PATH;

it('regenerates the vacuum system fixture set', () => {
  const payload = buildVacuumFixturePayload();

  writeFileSync(OUTPUT_PATH, serialiseVacuumFixturePayload(payload));

  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${payload.evacuationCases.length} evacuation cases and ` +
      `${payload.capacityCurve.samples.length} capacity curves (schemaVersion ${SCHEMA_VERSION}) ` +
      `to ${OUTPUT_PATH}`
  );
});

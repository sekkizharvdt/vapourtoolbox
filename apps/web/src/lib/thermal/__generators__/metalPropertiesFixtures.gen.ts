/**
 * Regenerates docs/thermal/fixtures/metal-properties.json.
 *
 * Run: cd apps/web && jest --testMatch "**\/metalPropertiesFixtures.gen.ts"
 *
 * The sibling generators each have a `pnpm fixtures:*` alias in the root
 * package.json; this one does not yet, because that file was being edited in
 * another session when this landed. Add
 *   "fixtures:metal-properties": "cd apps/web && jest --testMatch \"**\/metalPropertiesFixtures.gen.ts\""
 * alongside the others when convenient — the command above is what it runs.
 *
 * Supplies the external dynamic-simulator work with the metal properties needed
 * to form `M·c` for a vessel wall (rung 4, metal thermal mass) and `k` for wall
 * conduction. Before `METAL_PROPERTIES` existed this repo held seven metal
 * densities spread across two files and zero specific heats, so the product
 * could not be formed at all.
 *
 * ── This fixture is deliberately not a gate ──────────────────────────────
 * The other three fixtures publish CALCULATOR OUTPUT, and a disagreement is a
 * defect on one side. This one publishes REFERENCE DATA. If the simulator's
 * handbook gives a different specific heat for 316L, neither side is wrong —
 * they are quoting different sources. What is published here is therefore the
 * value AND how firm it is (`specificHeatBasis`), so a consumer can decide
 * whether to adopt it or keep its own, rather than gating against it blindly.
 *
 * Executed through jest rather than as a bare node script, matching the other
 * generators; the `.gen.ts` suffix keeps it out of `testMatch`.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  METAL_PROPERTIES,
  ASSUMED_VESSEL_WALL_THICKNESS_MM,
  ASSUMED_VESSEL_MATERIAL,
  metalHeatCapacityJPerK,
  type MetalGrade,
} from '@vapour/constants';

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
  'metal-properties.json'
);

const round = (n: number, d: number): number => Number(n.toFixed(d));

/**
 * Shell density hardcoded in `med/weightEstimation.ts` (`DENSITY.duplex_ss`),
 * applied to shell, heads and tubesheets regardless of the material specified.
 *
 * NOT the same grade as `METAL_PROPERTIES.duplex_2205` (7805 kg/m³, UNS S32205)
 * — the weight estimator's figure is UNS S32304. Publishing the estimator's own
 * constant rather than the nearest catalogue entry is the point: the divergence
 * below has to be computed against the number actually used.
 */
const WEIGHT_ESTIMATOR_SHELL_DENSITY_KGM3 = 7800;

/**
 * The shell-mass divergence, published as a relation and a per-grade expected
 * value rather than as a tolerance.
 *
 * The toolbox's weight estimate multiplies shell, heads and tubesheets by a
 * fixed duplex density whatever material is specified; the simulator recomputes
 * mass from `thickness x area x rho(named material)`. For any non-duplex vessel
 * the two WILL differ, by exactly this ratio.
 *
 * **That divergence is the check working.** Neither side reconciles toward the
 * other and the two must never be averaged. It is stated per grade because a
 * maintainer who meets "these two masses differ" investigates, and one who
 * meets +2.56% recognises it.
 */
function buildShellMassDivergence() {
  const perGrade = Object.fromEntries(
    (Object.keys(METAL_PROPERTIES) as MetalGrade[]).map((grade) => {
      const ratio = METAL_PROPERTIES[grade].densityKgM3 / WEIGHT_ESTIMATOR_SHELL_DENSITY_KGM3;
      return [
        grade,
        {
          densityKgM3: METAL_PROPERTIES[grade].densityKgM3,
          ratio: round(ratio, 6),
          percent: round((ratio - 1) * 100, 3),
        },
      ];
    })
  );

  return {
    relation:
      'divergence = rho(named material) / rho_shell_estimator - 1, applied to shell, heads and ' +
      'tubesheets only',
    shellEstimatorDensityKgM3: WEIGHT_ESTIMATOR_SHELL_DENSITY_KGM3,
    shellEstimatorGradeNote:
      'UNS S32304, hardcoded as DENSITY.duplex_ss in med/weightEstimation.ts and applied ' +
      'regardless of the material actually specified. It is NOT metal_properties.duplex_2205 ' +
      '(7805 kg/m3, UNS S32205) — do not substitute one for the other.',
    appliesTo: ['shell', 'dished heads', 'tubesheets'],
    doesNotApplyTo:
      'Tubes, which the weight estimator already keys off the tube material (titanium vs ' +
      'aluminium), and water boxes and internals, which are percentage allowances on shell ' +
      'weight rather than computed parts.',
    isAnExpectedValueNotATolerance:
      'This is what the two independent computations SHOULD differ by. It is not an error bar ' +
      'and not a fudge factor. A simulator run that reproduces the ratio has confirmed both ' +
      'sides; one that does not has found something. Never average the two masses, and never ' +
      'apply this as a correction to make them agree — that would destroy the only check either ' +
      'side has on the other.',
    perGrade,
  };
}

function buildGrades() {
  return Object.fromEntries(
    (Object.keys(METAL_PROPERTIES) as MetalGrade[]).map((grade) => {
      const p = METAL_PROPERTIES[grade];
      return [
        grade,
        {
          label: p.label,
          densityKgM3: p.densityKgM3,
          specificHeatJPerKgK: p.specificHeatJPerKgK,
          specificHeatQuotedRangeC: p.specificHeatQuotedRangeC,
          specificHeatBasis: p.specificHeatBasis,
          thermalConductivityWmK: p.thermalConductivityWmK,
          // Published because it is the product a dynamic model actually wants,
          // and forming it from the two factors above is where a caller pairs a
          // mass with the wrong grade's specific heat.
          volumetricHeatCapacityJPerM3K: round(p.densityKgM3 * p.specificHeatJPerKgK, 0),
        },
      ];
    })
  );
}

export function buildMetalPropertiesFixturePayload() {
  const assumed = METAL_PROPERTIES[ASSUMED_VESSEL_MATERIAL];

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: 'apps/web/src/lib/thermal/__generators__/metalPropertiesFixtures.gen.ts',
    generatedFor: 'vapour-dynamics rung 4 — metal thermal mass and wall conduction',
    schemaChanges: {
      v1: {
        added: [
          'grades — ten metal grades with density, specific heat, conductivity and the ' +
            'volumetric heat capacity product.',
          'shellMassDivergence — the +2.56% (for 316L) shell/heads/tubesheets divergence, ' +
            'published per grade as an expected value rather than a tolerance.',
          'vesselAssumptions — the 6 mm / SS 316L working assumption, marked as an assumption.',
        ],
        note:
          'First revision. This fixture is REFERENCE DATA, not calculator output — see ' +
          'gateGuidance.thisIsNotAGate before comparing anything against it.',
      },
    },
    units: {
      density: 'kg/m3',
      specificHeat: 'J/(kg.K)',
      volumetricHeatCapacity: 'J/(m3.K)',
      thermalConductivity: 'W/(m.K)',
      temperature: 'degC',
      thickness: 'mm',
      heatCapacity: 'J/K',
    },
    provenance: {
      densityAndConductivity: 'Firm.',
      specificHeat:
        'The conventional mill-datasheet figure, quoted over a temperature BAND rather than at ' +
        'a point, and consistent across major producers — but NOT traced to a named standard in ' +
        'this repo. Every entry carries specificHeatBasis: "mill-datasheet-conventional" for ' +
        'that reason, and none carries "sourced". If a conclusion comes to rest on the ' +
        'particular value of a specific heat here, pin it to a named document first.',
      whyTheDistinctionIsMarked:
        'The difference between "the datasheet number" and "a sourced number" has cost this ' +
        'project three findings: a validity envelope carried over from a citation nobody had ' +
        'opened, a correlation whose cited paper was not its source, and a figure that ended up ' +
        'citing itself. The basis is therefore stated per value rather than left implicit.',
      whyItBlocksNothingToday:
        'Metal thermal mass is a few percent of the liquid heat capacity in every vessel this ' +
        'repo sizes, so a 5% error in c moves a total heat capacity by well under 1%. That ' +
        'argument holds for liquid-filled drums and does NOT hold for a MED effect, where a ' +
        'tube bundle sits under a thin falling film and the ratio inverts.',
    },
    vesselAssumptions: {
      wallThicknessMM: ASSUMED_VESSEL_WALL_THICKNESS_MM,
      material: ASSUMED_VESSEL_MATERIAL,
      status: 'ASSUMED',
      agreedOn: '2026-08-03',
      note:
        'A WORKING ASSUMPTION, NOT A DESIGN VALUE. Wall thickness on a vacuum vessel is set by ' +
        'external-pressure buckling (ASME VIII Div 1 UG-28) plus corrosion allowance and minimum ' +
        'practical plate. This repo performs none of that calculation. For a built plant the ' +
        'real answer is the plate variant actually purchased, which lives in the procurement ' +
        'material master.',
      onTheEightMillimetreFigure:
        'The 8 mm appearing in med/weightEstimation.ts is a DEFAULT FUNCTION ARGUMENT ' +
        '(estimatePlantWeight(result, shellThkMM = 8, ...)), never a design output. It is not a ' +
        'competing value and there is nothing to reconcile between the two.',
      exampleHeatCapacityJPerK: {
        perTonneOfAssumedMaterial: round(metalHeatCapacityJPerK(1000, ASSUMED_VESSEL_MATERIAL), 0),
        relation: 'C = mass_kg x specificHeatJPerKgK',
        note:
          `Worked at 1 t of ${assumed.label} so a consumer can check its own unit handling ` +
          'against a single unambiguous number before scaling.',
      },
    },
    knownLimitations: {
      noTemperatureDependence:
        'c(T) IS DELIBERATELY ABSENT. Austenitic stainless specific heat rises a few percent ' +
        'between ambient and 100 degC, and a plant startup crosses exactly that span, so a c(T) ' +
        'correlation is the right shape of answer and was asked for. It is absent because ' +
        'fitting one through band-averaged datasheet values manufactures precision the ' +
        'underlying data does not carry. Use the band value and note that the band (0-100 degC) ' +
        'is wider than the startup span. Supply a real c(T) with its source when a result needs ' +
        'one — do not interpolate these.',
      noEmissivityOrInsulation:
        'No emissivity, insulation material, thickness or conductivity is recorded anywhere in ' +
        'this repo. Vessels are understood to be insulated; that is an untagged assumption and ' +
        'is NOT grounds for setting a vessel ua_to_ambient to zero.',
      grainOfTheData:
        'Densities are catalogue values to 4 significant figures; specific heats are quoted to ' +
        'the nearest 10 J/(kg.K) and conductivities to the nearest 1 W/(m.K). Reproducing these ' +
        'to more digits than they carry is not agreement.',
    },
    gateGuidance: {
      thisIsNotAGate:
        'The flash chamber, condenser and vacuum fixtures publish calculator output, where a ' +
        'disagreement is a defect on one side. This one publishes reference data. If your ' +
        'handbook gives a different specific heat for 316L, neither side is wrong — you are ' +
        'quoting different sources. Decide whether to adopt these values or keep your own, and ' +
        'record which you used; do not fail a run on a mismatch here.',
      whatToActuallyCheck:
        'Check unit handling, not values: form volumetricHeatCapacityJPerM3K yourself from ' +
        'density x specific heat and confirm it matches, then form a wall heat capacity from ' +
        'vesselAssumptions and confirm it matches exampleHeatCapacityJPerK scaled. A factor of ' +
        '1000 in J vs kJ is the failure this fixture can genuinely catch.',
      onTheShellMassDivergence:
        'shellMassDivergence is the one number here that IS a hard expectation. Reproduce the ' +
        'ratio for the grade you are modelling. Matching confirms both computations; not ' +
        'matching means one of them has changed and is worth finding.',
    },
    shellMassDivergence: buildShellMassDivergence(),
    grades: buildGrades(),
  };
}

export function serialiseMetalPropertiesFixturePayload(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const METAL_PROPERTIES_FIXTURE_OUTPUT_PATH = OUTPUT_PATH;

it('regenerates the metal properties fixture', () => {
  const payload = buildMetalPropertiesFixturePayload();

  writeFileSync(OUTPUT_PATH, serialiseMetalPropertiesFixturePayload(payload));

  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${Object.keys(payload.grades).length} metal grades (schemaVersion ${SCHEMA_VERSION}) ` +
      `to ${OUTPUT_PATH}`
  );
});

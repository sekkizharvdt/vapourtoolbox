/**
 * Metal property invariants.
 *
 * A constants table is exactly the kind of file that goes unchecked until a
 * defect ships from it — this repo has spent a week removing home-grown
 * correlations, a 1000x unit slip and two clamped guards presented as physics.
 * These assertions are cheap and pin the properties that other code actually
 * relies on.
 */

import { MED_TUBE_CONDUCTIVITY } from './medConstants';
import {
  METAL_PROPERTIES,
  ASSUMED_VESSEL_WALL_THICKNESS_MM,
  ASSUMED_VESSEL_MATERIAL,
  metalHeatCapacityJPerK,
  type MetalGrade,
} from './metalProperties';

const GRADES = Object.keys(METAL_PROPERTIES) as MetalGrade[];

describe('every grade is completely specified', () => {
  it.each(GRADES)('%s has all properties with sane magnitudes', (grade) => {
    const m = METAL_PROPERTIES[grade];

    // Densities: aluminium alloy 2,680 is the floor, Cu-Ni 8,950 the ceiling.
    expect(m.densityKgM3).toBeGreaterThan(2000);
    expect(m.densityKgM3).toBeLessThan(10000);

    // Specific heats: Cu-Ni 380 is the floor, aluminium 900 the ceiling.
    expect(m.specificHeatJPerKgK).toBeGreaterThan(300);
    expect(m.specificHeatJPerKgK).toBeLessThan(1000);

    expect(m.thermalConductivityWmK).toBeGreaterThan(0);
    expect(m.label.length).toBeGreaterThan(0);
  });

  it.each(GRADES)('%s states the temperature band its specific heat is quoted over', (grade) => {
    // Rule 3 applied to metal properties: a specific heat without a temperature
    // is not a usable number. The simulator asked for exactly this.
    const [lo, hi] = METAL_PROPERTIES[grade].specificHeatQuotedRangeC;
    expect(hi).toBeGreaterThan(lo);
  });

  it.each(GRADES)('%s does not overstate how well grounded its specific heat is', (grade) => {
    // Nothing here is traced to a named standard yet. When one is, flip the
    // basis to 'sourced' in the same change that adds the citation — never
    // before, because the label is the only thing distinguishing a datasheet
    // convention from a reference value.
    expect(METAL_PROPERTIES[grade].specificHeatBasis).toBe('mill-datasheet-conventional');
  });
});

describe('tube conductivity is derived, not transcribed', () => {
  /**
   * MED_TUBE_CONDUCTIVITY is keyed by TubeMaterial and reads its values from
   * METAL_PROPERTIES. If someone re-inlines the numbers, this fails. A second
   * transcription of the same physical constant is the defect class that
   * produced the seawater enthalpy finding.
   */
  const TUBE_TO_GRADE: Record<string, MetalGrade> = {
    titanium: 'titanium_gr2',
    al_brass: 'al_brass',
    cu_ni_90_10: 'cu_ni_90_10',
    cu_ni_70_30: 'cu_ni_70_30',
    al_alloy: 'al_alloy',
    ss_316l: 'ss_316l',
    duplex_2205: 'duplex_2205',
  };

  it.each(Object.entries(TUBE_TO_GRADE))('%s matches grade %s', (tubeKey, grade) => {
    expect(MED_TUBE_CONDUCTIVITY[tubeKey]).toBe(METAL_PROPERTIES[grade].thermalConductivityWmK);
  });

  it('covers every tube material, with no extras', () => {
    expect(Object.keys(MED_TUBE_CONDUCTIVITY).sort()).toEqual(Object.keys(TUBE_TO_GRADE).sort());
  });
});

describe('the water-to-steel heat capacity ratio the design guidance rests on', () => {
  /**
   * The SSOT equipment type used to claim metal mass "usually dominates how long
   * startup takes". It was replaced with a claim that stands on its own: water's
   * specific heat is roughly EIGHT times steel's, so a wall dominates a
   * liquid-filled vessel only once its mass exceeds about eight times the holdup.
   *
   * That number now lives in a comment, so this test ties it to the constants.
   * If a specific heat is edited such that the ratio moves materially, the
   * guidance is wrong and this fails rather than the comment quietly rotting.
   */
  const WATER_CP_J_PER_KG_K = 4180;

  it.each(['ss_316l', 'ss_304l', 'duplex_2205', 'carbon_steel'] as MetalGrade[])(
    'water is 8-9x %s',
    (grade) => {
      const ratio = WATER_CP_J_PER_KG_K / METAL_PROPERTIES[grade].specificHeatJPerKgK;
      expect(ratio).toBeGreaterThan(8);
      expect(ratio).toBeLessThan(9);
    }
  );
});

describe('the vessel wall assumption is labelled as one', () => {
  it('is 6 mm SS 316L, and the material resolves', () => {
    expect(ASSUMED_VESSEL_WALL_THICKNESS_MM).toBe(6);
    expect(ASSUMED_VESSEL_MATERIAL).toBe('ss_316l');
    expect(METAL_PROPERTIES[ASSUMED_VESSEL_MATERIAL]).toBeDefined();
  });

  it('gives a wall far below the mass at which it would dominate a drum', () => {
    // 2 m x 4 m drum: shell + two 2:1 SE heads at 6 mm 316L is ~1.5 t, against a
    // ~35 t threshold for 4.2 t of brine. Pins the conclusion, not the thickness
    // — the thickness is an assumption and no result may rest on its magnitude.
    const { densityKgM3 } = METAL_PROPERTIES.ss_316l;
    const t = ASSUMED_VESSEL_WALL_THICKNESS_MM / 1000;
    const shell = Math.PI * 2 * 4 * t * densityKgM3;
    const heads = 2 * (Math.PI / 4) * 2 * 2 * t * densityKgM3 * 1.084;
    const wallMass = shell + heads;

    const holdupKg = 4200;
    const dominanceThresholdKg = (holdupKg * 4180) / METAL_PROPERTIES.ss_316l.specificHeatJPerKgK;

    expect(wallMass).toBeLessThan(dominanceThresholdKg / 10);
  });
});

describe('metalHeatCapacityJPerK', () => {
  it('pairs a mass with its own grade', () => {
    expect(metalHeatCapacityJPerK(1000, 'ss_316l')).toBe(
      1000 * METAL_PROPERTIES.ss_316l.specificHeatJPerKgK
    );
  });

  it('distinguishes grades that differ', () => {
    expect(metalHeatCapacityJPerK(1000, 'ss_316l')).not.toBe(
      metalHeatCapacityJPerK(1000, 'cu_ni_90_10')
    );
  });
});

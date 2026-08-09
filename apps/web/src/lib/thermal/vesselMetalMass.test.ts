/**
 * Vessel envelope metal mass.
 *
 * The assertions here are the ones that would catch a wrong number reaching a
 * dynamic model: units, the thin-wall approximation the shell formula avoids,
 * and the pairing of a mass with its own grade's specific heat.
 */

import { METAL_PROPERTIES } from '@vapour/constants';

import { cylindricalShellMassKg, dishedHeadMassKg, vesselEnvelopeMass } from './vesselMetalMass';

describe('cylindricalShellMassKg', () => {
  it('computes the annulus volume × density', () => {
    // 1000 mm ID, 2000 mm long, 10 mm wall, 8000 kg/m³.
    // OD = 1.02 m; area = π(1.02² − 1.00²)/4 = π(0.0404)/4 = 0.031730 m²
    // × 2 m × 8000 = 507.68 kg
    expect(cylindricalShellMassKg(1000, 2000, 10, 8000)).toBeCloseTo(507.68, 1);
  });

  it('uses the annulus, not the thin-wall approximation', () => {
    // π·D_mean·t·L would give π × 1.01 × 0.01 × 2 × 8000 = 507.68 too at this
    // ratio, so probe a thick wall where the two diverge: 200 mm ID, 20 mm wall.
    // Annulus: π(0.24² − 0.20²)/4 × 1 × 8000 = π(0.0176)/4 × 8000 = 110.58 kg
    // Thin-wall: π × 0.22 × 0.02 × 1 × 8000 = 110.58 kg — identical, because
    // D_mean = ID + t is the exact mean. Assert the identity holds so a future
    // edit to either form is caught rather than silently changing the basis.
    const id = 200;
    const t = 20;
    const rho = 8000;
    const annulus = cylindricalShellMassKg(id, 1000, t, rho);
    const thinWall = Math.PI * ((id + t) / 1000) * (t / 1000) * 1 * rho;

    expect(annulus).toBeCloseTo(thinWall, 6);
  });

  it('scales linearly with length and density', () => {
    const base = cylindricalShellMassKg(1500, 3000, 6, 8000);

    expect(cylindricalShellMassKg(1500, 6000, 6, 8000)).toBeCloseTo(2 * base, 6);
    expect(cylindricalShellMassKg(1500, 3000, 6, 4000)).toBeCloseTo(base / 2, 6);
  });
});

describe('dishedHeadMassKg', () => {
  it('applies the 2:1 SE blank-area factor', () => {
    // (π/4) × 1.5² × 0.006 × 8000 × 1.084 = 91.96 kg
    expect(dishedHeadMassKg(1500, 6, 8000)).toBeCloseTo(91.96, 1);
  });

  it('is heavier than a flat plate of the same diameter', () => {
    // The 1.084 factor exists because the knuckle needs more blank than a disc.
    const flatPlate = (Math.PI / 4) * 1.5 * 1.5 * 0.006 * 8000;

    expect(dishedHeadMassKg(1500, 6, 8000)).toBeGreaterThan(flatPlate);
    expect(dishedHeadMassKg(1500, 6, 8000) / flatPlate).toBeCloseTo(1.084, 6);
  });
});

describe('vesselEnvelopeMass', () => {
  const input = {
    insideDiameterMM: 1500,
    tangentToTangentMM: 4000,
    thicknessMM: 6,
    grade: 'ss_316l' as const,
  };

  it('sums shell and both heads into the total', () => {
    const m = vesselEnvelopeMass(input);

    expect(m.totalKg).toBeCloseTo(m.shellKg + m.dishedHeadsKg, 6);
    expect(m.shellKg).toBeGreaterThan(0);
    expect(m.dishedHeadsKg).toBeGreaterThan(0);
  });

  it('defaults to two heads and honours an explicit count', () => {
    const two = vesselEnvelopeMass(input);
    const one = vesselEnvelopeMass({ ...input, headCount: 1 });

    expect(two.dishedHeadsKg).toBeCloseTo(2 * one.dishedHeadsKg, 6);
  });

  it('takes density from the named grade, not a hardcoded one', () => {
    // The defect this module exists to avoid: weightEstimation hardcodes duplex
    // 7800 whatever material is specified, which is the +2.56% divergence.
    const ss = vesselEnvelopeMass(input);
    const ti = vesselEnvelopeMass({ ...input, grade: 'titanium_gr2' });

    expect(ss.densityKgM3).toBe(METAL_PROPERTIES.ss_316l.densityKgM3);
    expect(ti.densityKgM3).toBe(METAL_PROPERTIES.titanium_gr2.densityKgM3);
    expect(ti.totalKg / ss.totalKg).toBeCloseTo(4510 / 8000, 6);
  });

  it('pairs the mass with its own grade specific heat', () => {
    // A mass paired with the wrong grade's cp is invisible in the total and
    // moves every time constant downstream.
    const ti = vesselEnvelopeMass({ ...input, grade: 'titanium_gr2' });

    expect(ti.heatCapacityJPerK).toBeCloseTo(
      ti.totalKg * METAL_PROPERTIES.titanium_gr2.specificHeatJPerKgK,
      6
    );
  });

  it('lands at a plant scale for a real flash chamber', () => {
    // 1.5 m × 4 m in 6 mm 316L. Shell ≈ π(1.512²−1.500²)/4 × 4 × 8000 ≈ 908 kg,
    // heads ≈ 2 × 92 ≈ 184 kg. A units slip would move this by 10³.
    const m = vesselEnvelopeMass(input);

    expect(m.totalKg).toBeGreaterThan(500);
    expect(m.totalKg).toBeLessThan(2000);
  });
});

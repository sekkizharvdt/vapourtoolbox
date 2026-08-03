/**
 * Q = U · A · ΔT must hold for every condensing exchanger the sizer returns.
 *
 * It did not. `requiredArea` was computed once at the DESIGN tube velocity and
 * then frozen, while `overallHTC` was refined afterwards at the ACTUAL velocity
 * — so the two returned values came from different velocities and the identity
 * failed by 4% to 27%, worst where the selected tube count pushed the actual
 * velocity furthest from design.
 *
 * Nothing caught it because nothing asserted the three quantities TOGETHER.
 * Individually each was plausible and correctly signed; the condenser and
 * preheater sizing had no numeric coverage at all. It surfaced only when a
 * reference fixture was built and a consumer would have gated on duty, U and
 * area at once — which is exactly what spec §7.2 asks of the rung-5 gate.
 *
 * This is the invariant, not a snapshot: it holds for any input, so no
 * re-baselining is needed when the design legitimately changes.
 */

import { designMEDPlant } from './designPipeline';
import type { MEDDesignerInput } from './designerTypes';

const BASE: MEDDesignerInput = {
  // T/h — note MEDEngineInput.steamFlow is kg/h for the same physical quantity
  steamFlowTPerH: 1.04,
  steamTemperature: 62.2,
  seawaterTemperature: 30,
  targetGOR: 9.8,
  numberOfEffects: 6,
  seawaterSalinity: 35000,
  maxBrineSalinity: 59400,
  condenserApproach: 4,
};

describe('condenser sizing is internally consistent', () => {
  const CASES: [string, MEDDesignerInput][] = [
    ['base', BASE],
    ['cold seawater', { ...BASE, seawaterTemperature: 20 }],
    ['warm seawater', { ...BASE, seawaterTemperature: 35 }],
    ['wide approach', { ...BASE, condenserApproach: 6 }],
    ['four effects', { ...BASE, numberOfEffects: 4 }],
    ['eight effects', { ...BASE, numberOfEffects: 8 }],
  ];

  it.each(CASES)('%s: Q = U · A · LMTD', (_label, input) => {
    const c = designMEDPlant(input).condenser;

    const impliedDutyKW = (c.overallU * c.requiredArea * c.lmtd) / 1000;
    const deviation = Math.abs(impliedDutyKW - c.duty) / c.duty;

    // 0.1% covers the fixed point's own convergence; the defect gave 4-27%.
    expect(deviation).toBeLessThan(0.001);
  });

  it.each(CASES)('%s: the reported U is a real series resistance', (_label, input) => {
    const c = designMEDPlant(input).condenser;

    // U must sit below both film coefficients — a series resistance cannot
    // exceed either branch. Cheap, but it catches a U left over from a
    // different velocity or a different exchanger.
    expect(c.velocity).toBeGreaterThan(0);
    expect(c.tubeSideHTC).toBeGreaterThan(0);
    expect(c.overallU).toBeLessThan(c.tubeSideHTC);
    expect(c.overallU).toBeLessThan(c.shellSideHTC);
  });

  it('design area carries the margin and required area does not', () => {
    const c = designMEDPlant(BASE).condenser;
    expect(c.designArea).toBeGreaterThan(c.requiredArea);
  });
});

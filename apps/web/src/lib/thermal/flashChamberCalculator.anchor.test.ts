/**
 * Flash Chamber Calculator — external anchor tests (UNMOCKED property layer)
 *
 * The main suite (flashChamberCalculator.test.ts) mocks @vapour/constants with
 * rough approximations (its `getSaturationPressure` is `0.01·e^(0.05·T)`, which
 * returns 900 mbar at 90 °C against a true 701.8), so it can never catch a
 * steam-table regression and cannot be used to assert anything thermodynamic.
 * This file mocks nothing: the real IF97 implementation flows through.
 *
 * What it pins is the physical consistency of the reported feed state. The
 * inlet pressure used to be hardcoded `operatingPressure + 50 mbar` — a
 * line-loss allowance, not a nozzle differential. The feed actually enters
 * through a spray nozzle whose ΔP (typically 0.5–6 bar) sets the flow via
 * `Q = Q_rated·(ΔP/P_rated)^n`, so the inlet pressure is `chamber + ΔP`.
 *
 * The old rule was not merely imprecise, it was infeasible: it confined the
 * feed to `Tsat(P_op) < T_in < Tsat(P_op + 50 mbar)`, a window that narrows as
 * pressure rises (11.5 K at 60 mbar, 4.9 K at 200, 1.9 K at 660). Any larger
 * flash put the stated feed pressure below its own saturation pressure — a
 * liquid already boiling in its own supply pipe.
 */

import { getSaturationPressure } from '@vapour/constants';
import type { FlashChamberInput } from '@vapour/types';

import { calculateFlashChamber } from './flashChamberCalculator';

const createInput = (overrides: Partial<FlashChamberInput> = {}): FlashChamberInput => ({
  mode: 'WATER_FLOW',
  waterType: 'SEAWATER',
  operatingPressure: 200,
  inletTemperature: 90,
  salinity: 35000,
  waterFlowRate: 100,
  flowRateUnit: 'TON_HR',
  inletWaterVelocity: 2.5,
  outletWaterVelocity: 0.05,
  vaporVelocity: 20,
  retentionTime: 2,
  flashingZoneHeight: 500,
  sprayAngle: 85,
  pumpCenterlineAboveFFL: 0.5,
  operatingLevelAbovePump: 5,
  operatingLevelRatio: 0.5,
  btlGapBelowLGL: 0.1,
  ...overrides,
});

describe('external anchor — feed state is physically consistent, unmocked', () => {
  /**
   * Published IAPWS saturation pressures, mbar. Sourced independently of the
   * implementation so a steam-table regression cannot move both sides at once.
   *
   * The 100 °C entry is 1014.2 mbar, NOT the 1013.25 mbar of one standard
   * atmosphere: on ITS-90 water boils at 1 atm at 99.974 °C, so Psat at exactly
   * 100.000 °C is slightly above atmospheric. Anchoring it at 1013.25 would
   * silently demand a 0.09% error from a correct implementation.
   */
  const IAPWS_PSAT_MBAR: [number, number][] = [
    [60, 199.4],
    [70, 311.8],
    [80, 473.7],
    [90, 701.8],
    [100, 1014.2],
  ];

  it.each(IAPWS_PSAT_MBAR)(
    'the real Psat at %i °C matches the published value (guards the comparison itself)',
    (tempC, publishedMbar) => {
      expect(getSaturationPressure(tempC) * 1000).toBeCloseTo(publishedMbar, 0);
    }
  );

  it.each([
    [60, 100],
    [70, 100],
    [80, 200],
    [90, 200],
    [100, 500],
  ])(
    'a %i °C feed flashed to %i mbar stays above its own saturation pressure',
    (inletTemperature, operatingPressure) => {
      const result = calculateFlashChamber(createInput({ inletTemperature, operatingPressure }));
      const publishedPsatMbar = IAPWS_PSAT_MBAR.find(([t]) => t === inletTemperature)![1];

      expect(result.heatMassBalance.inlet.pressure).toBeGreaterThan(publishedPsatMbar);

      // The superseded `operating + 50` rule fails this for every case here —
      // which is why none of them could be expressed before.
      expect(operatingPressure + 50).toBeLessThan(publishedPsatMbar);
    }
  );

  it('supports the large-flash duty the old rule made inexpressible', () => {
    // 90 °C feed → 200 mbar chamber. Tsat(200 mbar) = 60.06 °C, so this is a
    // ~30 K flash, against the 1.9 K ceiling the old rule imposed near 660 mbar.
    const result = calculateFlashChamber(
      createInput({ inletTemperature: 90, operatingPressure: 200 })
    );
    const { inlet, vapor } = result.heatMassBalance;

    expect(inlet.temperature - vapor.temperature).toBeGreaterThan(25);
    // Fed at 3 bar nozzle ΔP above a 200 mbar chamber.
    expect(inlet.pressure).toBeCloseTo(3200, 6);
    expect(vapor.flowRate).toBeGreaterThan(0);
  });

  /**
   * A genuine external anchor on the flash itself.
   *
   * The vapour flow is solved FROM the energy balance, so asserting that the
   * balance closes is a tautology (the type's own NOTE records that the former
   * balanceError field was removed for exactly this reason). Instead, compute
   * the flash fraction independently from published IAPWS values and compare.
   *
   * DM water at 90 °C flashed to 200 mbar (Tsat = 60.06 °C):
   *   h_f(90 °C)     = 376.97 kJ/kg   (IAPWS)
   *   h_f(60.06 °C)  = 251.4  kJ/kg   (IAPWS, 251.15 at 60 °C + 0.06·4.185)
   *   h_g(60.06 °C)  = 2609.7 kJ/kg   (IAPWS, 2609.6 at 60 °C)
   *   y = (376.97 − 251.4) / (2609.7 − 251.4) = 125.57 / 2358.3 = 0.05324
   * so 100 ton/hr of feed yields 5.324 ton/hr of vapour.
   */
  it('matches a hand-computed flash fraction from published IAPWS enthalpies', () => {
    const result = calculateFlashChamber(
      createInput({
        waterType: 'DM_WATER',
        salinity: 0,
        inletTemperature: 90,
        operatingPressure: 200,
        waterFlowRate: 100,
      })
    );

    const handComputedVapourTonHr = 5.324;
    const deviationPercent =
      Math.abs(
        (result.heatMassBalance.vapor.flowRate - handComputedVapourTonHr) / handComputedVapourTonHr
      ) * 100;

    // 0.5% covers the rounding in the published table values used above.
    expect(deviationPercent).toBeLessThan(0.5);
  });
});

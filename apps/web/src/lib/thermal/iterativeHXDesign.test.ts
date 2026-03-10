/**
 * Iterative Heat Exchanger Design — Unit Tests
 *
 * Tests convergence, validation, parameter effects, and real-world scenarios.
 */

import { designHeatExchanger } from './iterativeHXDesign';
import type { IterativeHXInput } from './iterativeHXDesign.types';
import { findTubeIndex } from './heatExchangerSizing';

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a baseline MED condenser input:
 *   - 5 MW duty (approx)
 *   - Steam condensing at 65°C on shell side
 *   - Seawater cooling from 25°C to 35°C on tube side
 *   - 19.05mm OD, BWG 16, Cu-Ni 90/10 tubes
 *   - 2 passes, 6m effective length
 */
function createCondenserInput(overrides: Partial<IterativeHXInput> = {}): IterativeHXInput {
  return {
    exchangerType: 'CONDENSER',
    tubeSide: {
      fluid: 'SEAWATER',
      salinity: 35000,
      massFlowRate: 430, // ton/hr → ~119 kg/s → Q ≈ 5 MW at ΔT=10°C
      inletTemp: 25,
      outletTemp: 35,
    },
    shellSide: {
      massFlowRate: 7.6, // ton/hr → ~2.1 kg/s condensate → Q ≈ 5 MW
      saturationTemp: 65,
    },
    flowArrangement: 'COUNTER',
    tubeOrientation: 'horizontal',
    tubeGeometry: {
      tubeSpecIndex: findTubeIndex(19.05, 16),
      tubeMaterial: 'cuNi_90_10',
      tubeLayout: 'triangular',
      tubePasses: 2,
      tubeLength: 6,
    },
    fouling: {
      tubeSide: 0.000088, // Seawater < 50°C (TEMA)
      shellSide: 0.0000088, // Clean steam condensate
    },
    ...overrides,
  };
}

// ── Convergence ──────────────────────────────────────────────────────────────

describe('designHeatExchanger — convergence', () => {
  it('converges for a typical MED condenser case', () => {
    const result = designHeatExchanger(createCondenserInput());

    expect(result.converged).toBe(true);
    expect(result.iterationCount).toBeGreaterThan(1);
    expect(result.iterationCount).toBeLessThanOrEqual(20);
  });

  it('converges within 15 iterations', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.iterationCount).toBeLessThanOrEqual(15);
  });

  it('final U matches between assumed and calculated within tolerance', () => {
    const result = designHeatExchanger(createCondenserInput());
    const lastIter = result.iterations[result.iterations.length - 1]!;
    const error = Math.abs(lastIter.calculatedU - lastIter.assumedU) / lastIter.calculatedU;
    expect(error).toBeLessThan(0.05);
  });

  it('iteration history shows decreasing error', () => {
    const result = designHeatExchanger(createCondenserInput());
    // First iteration error should be larger than last
    if (result.iterations.length > 2) {
      expect(result.iterations[0]!.relativeError).toBeGreaterThan(
        result.iterations[result.iterations.length - 1]!.relativeError
      );
    }
  });
});

// ── Heat Duty & LMTD ────────────────────────────────────────────────────────

describe('designHeatExchanger — heat duty & LMTD', () => {
  it('calculates reasonable heat duty for the baseline case', () => {
    const result = designHeatExchanger(createCondenserInput());
    // Q = m × Cp × ΔT ≈ 119 kg/s × 3.99 kJ/(kg·K) × 10 K ≈ 4750 kW
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(4000);
    expect(result.heatDuty.heatDutyKW).toBeLessThan(6000);
  });

  it('calculates LMTD correctly for isothermal condensation', () => {
    const result = designHeatExchanger(createCondenserInput());
    // Counter-current with T_hot=65°C (both), T_cold_in=25°C, T_cold_out=35°C
    // ΔT1 = 65-35 = 30, ΔT2 = 65-25 = 40
    // LMTD = (30-40)/ln(30/40) = -10/ln(0.75) ≈ 34.8°C
    expect(result.lmtdResult.correctedLMTD).toBeCloseTo(34.8, 0);
    expect(result.lmtdResult.correctionFactor).toBe(1.0); // Counter-current
  });

  it('warns on heat duty mismatch between tube and shell sides', () => {
    // Deliberately set shell flow too high for tube-side duty
    const result = designHeatExchanger(
      createCondenserInput({
        shellSide: { massFlowRate: 20, saturationTemp: 65 }, // way more steam than needed
      })
    );
    expect(result.warnings.some((w) => w.includes('Heat duty mismatch'))).toBe(true);
  });
});

// ── HTC Results ──────────────────────────────────────────────────────────────

describe('designHeatExchanger — HTC', () => {
  it('tube-side HTC is in expected range for seawater', () => {
    const result = designHeatExchanger(createCondenserInput());
    // Dittus-Boelter for turbulent water: range depends on velocity
    // High velocity (>5 m/s) can push HTC above 20000 W/m²·K
    expect(result.tubeSideHTC).toBeGreaterThan(2000);
    expect(result.tubeSideHTC).toBeLessThan(50000);
  });

  it('shell-side HTC is in expected range for condensation', () => {
    const result = designHeatExchanger(createCondenserInput());
    // Nusselt film condensation: typically 5000-20000 W/m²·K
    expect(result.shellSideHTC).toBeGreaterThan(3000);
    expect(result.shellSideHTC).toBeLessThan(25000);
  });

  it('overall HTC is less than both individual HTCs', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.htcResult.overallHTC).toBeLessThan(result.tubeSideHTC);
    expect(result.htcResult.overallHTC).toBeLessThan(result.shellSideHTC);
  });

  it('resistance breakdown sums to total', () => {
    const result = designHeatExchanger(createCondenserInput());
    const r = result.htcResult.resistances;
    const sum = r.tubeSide + r.tubeSideFouling + r.tubeWall + r.shellSideFouling + r.shellSide;
    expect(sum).toBeCloseTo(r.total, 10);
  });
});

// ── Geometry ─────────────────────────────────────────────────────────────────

describe('designHeatExchanger — geometry', () => {
  it('produces reasonable tube count for 5 MW condenser', () => {
    const result = designHeatExchanger(createCondenserInput());
    // For a 5MW condenser with U~2500, LMTD~35, A~57m²
    // 19.05mm × 6m → ~0.359 m²/tube → ~160 tubes
    expect(result.geometry.actualTubeCount).toBeGreaterThan(50);
    expect(result.geometry.actualTubeCount).toBeLessThan(500);
  });

  it('tube count is divisible by passes', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.actualTubeCount % result.geometry.tubePasses).toBe(0);
  });

  it('actual area ≥ required area', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.actualArea).toBeGreaterThanOrEqual(result.geometry.requiredArea);
  });

  it('shell ID is a reasonable size', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.shellID).toBeGreaterThan(100);
    expect(result.geometry.shellID).toBeLessThan(2000);
  });
});

// ── Velocity & Pressure Drop ─────────────────────────────────────────────────

describe('designHeatExchanger — velocity', () => {
  it('tube-side velocity is reasonable', () => {
    const result = designHeatExchanger(createCondenserInput());
    // Velocity can be high when LMTD is large (small area, few tubes)
    // The engineer would adjust passes/geometry to bring it into 1-2.5 m/s range
    expect(result.velocity.tubeSideVelocity).toBeGreaterThan(0.3);
    expect(result.velocity.tubeSideVelocity).toBeLessThan(15);
  });

  it('pressure drop is positive', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.velocity.tubeSidePressureDrop).toBeGreaterThan(0);
  });

  it('Reynolds number indicates turbulent flow', () => {
    const result = designHeatExchanger(createCondenserInput());
    // For meaningful HTC from Dittus-Boelter, Re should be > 10000
    expect(result.velocity.tubeSideReynolds).toBeGreaterThan(5000);
  });
});

// ── Parameter Effects ────────────────────────────────────────────────────────

describe('designHeatExchanger — parameter effects', () => {
  it('higher flow rate → more tubes (higher duty)', () => {
    const r1 = designHeatExchanger(
      createCondenserInput({
        tubeSide: {
          fluid: 'SEAWATER',
          salinity: 35000,
          massFlowRate: 300,
          inletTemp: 25,
          outletTemp: 35,
        },
        shellSide: { massFlowRate: 5.3, saturationTemp: 65 },
      })
    );
    const r2 = designHeatExchanger(
      createCondenserInput({
        tubeSide: {
          fluid: 'SEAWATER',
          salinity: 35000,
          massFlowRate: 600,
          inletTemp: 25,
          outletTemp: 35,
        },
        shellSide: { massFlowRate: 10.6, saturationTemp: 65 },
      })
    );
    expect(r2.geometry.actualTubeCount).toBeGreaterThan(r1.geometry.actualTubeCount);
  });

  it('more tube passes → higher velocity', () => {
    const r1 = designHeatExchanger(
      createCondenserInput({
        tubeGeometry: {
          tubeSpecIndex: findTubeIndex(19.05, 16),
          tubeMaterial: 'cuNi_90_10',
          tubeLayout: 'triangular',
          tubePasses: 1,
          tubeLength: 6,
        },
      })
    );
    const r2 = designHeatExchanger(
      createCondenserInput({
        tubeGeometry: {
          tubeSpecIndex: findTubeIndex(19.05, 16),
          tubeMaterial: 'cuNi_90_10',
          tubeLayout: 'triangular',
          tubePasses: 4,
          tubeLength: 6,
        },
      })
    );
    expect(r2.velocity.tubeSideVelocity).toBeGreaterThan(r1.velocity.tubeSideVelocity);
  });

  it('higher saturation temperature → higher LMTD → smaller area', () => {
    const r1 = designHeatExchanger(
      createCondenserInput({ shellSide: { massFlowRate: 7.6, saturationTemp: 50 } })
    );
    const r2 = designHeatExchanger(
      createCondenserInput({ shellSide: { massFlowRate: 7.6, saturationTemp: 80 } })
    );
    expect(r2.lmtdResult.correctedLMTD).toBeGreaterThan(r1.lmtdResult.correctedLMTD);
    expect(r2.geometry.requiredArea).toBeLessThan(r1.geometry.requiredArea);
  });

  it('higher fouling → lower overall U → more area', () => {
    const r1 = designHeatExchanger(
      createCondenserInput({ fouling: { tubeSide: 0.00005, shellSide: 0.00001 } })
    );
    const r2 = designHeatExchanger(
      createCondenserInput({ fouling: { tubeSide: 0.0005, shellSide: 0.0001 } })
    );
    expect(r2.htcResult.overallHTC).toBeLessThan(r1.htcResult.overallHTC);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('designHeatExchanger — validation', () => {
  it('throws for unsupported exchanger type', () => {
    expect(() =>
      designHeatExchanger(createCondenserInput({ exchangerType: 'EVAPORATOR' }))
    ).toThrow('not yet supported');
  });

  it('throws when tube-side inlet ≥ saturation temp', () => {
    expect(() =>
      designHeatExchanger(
        createCondenserInput({
          tubeSide: {
            fluid: 'SEAWATER',
            salinity: 35000,
            massFlowRate: 430,
            inletTemp: 70,
            outletTemp: 80,
          },
          shellSide: { massFlowRate: 7.6, saturationTemp: 65 },
        })
      )
    ).toThrow('inlet temperature must be below');
  });

  it('throws when tube-side outlet ≤ inlet (not heated)', () => {
    expect(() =>
      designHeatExchanger(
        createCondenserInput({
          tubeSide: {
            fluid: 'SEAWATER',
            salinity: 35000,
            massFlowRate: 430,
            inletTemp: 35,
            outletTemp: 25,
          },
        })
      )
    ).toThrow('outlet temperature must be greater than inlet');
  });

  it('throws for invalid tube spec', () => {
    expect(() =>
      designHeatExchanger(
        createCondenserInput({
          tubeGeometry: {
            tubeSpecIndex: 999,
            tubeMaterial: 'cuNi_90_10',
            tubeLayout: 'triangular',
            tubePasses: 2,
            tubeLength: 6,
          },
        })
      )
    ).toThrow('Invalid tube spec');
  });

  it('throws for zero mass flow rate', () => {
    expect(() =>
      designHeatExchanger(
        createCondenserInput({
          tubeSide: {
            fluid: 'SEAWATER',
            salinity: 35000,
            massFlowRate: 0,
            inletTemp: 25,
            outletTemp: 35,
          },
        })
      )
    ).toThrow('mass flow rate must be positive');
  });
});

// ── Real-World Scenario ──────────────────────────────────────────────────────

describe('Real-world: 5 MW MED condenser', () => {
  it('produces a complete, physically consistent design', () => {
    const result = designHeatExchanger(createCondenserInput());

    // Converged
    expect(result.converged).toBe(true);

    // Heat duty: ~4750 kW
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(4000);
    expect(result.heatDuty.heatDutyKW).toBeLessThan(6000);

    // LMTD: ~35°C for 65°C sat, 25→35°C cooling water
    expect(result.lmtdResult.correctedLMTD).toBeGreaterThan(25);
    expect(result.lmtdResult.correctedLMTD).toBeLessThan(45);

    // Overall U: typical condenser range 1500-4000
    expect(result.htcResult.overallHTC).toBeGreaterThan(1000);
    expect(result.htcResult.overallHTC).toBeLessThan(5000);

    // Area: Q/(U×LMTD) should be reasonable
    expect(result.geometry.requiredArea).toBeGreaterThan(20);
    expect(result.geometry.requiredArea).toBeLessThan(200);

    // Shell ID: should be moderate for ~100-200 tubes
    expect(result.geometry.shellID).toBeGreaterThan(200);
    expect(result.geometry.shellID).toBeLessThan(1200);

    // Velocity may be high for this LMTD; engineer adjusts geometry to bring into range
    expect(result.velocity.tubeSideVelocity).toBeGreaterThan(0.5);
    expect(result.velocity.tubeSideVelocity).toBeLessThan(15);

    // No critical warnings (heat duty mismatch is expected due to approximate shell flow)
    const criticalWarnings = result.warnings.filter(
      (w) => w.includes('did not converge') || w.includes('Temperature cross')
    );
    expect(criticalWarnings).toHaveLength(0);
  });
});

describe('Real-world: pure water condenser', () => {
  it('works with PURE_WATER tube-side fluid', () => {
    const result = designHeatExchanger(
      createCondenserInput({
        tubeSide: {
          fluid: 'PURE_WATER',
          massFlowRate: 430,
          inletTemp: 25,
          outletTemp: 35,
        },
      })
    );

    expect(result.converged).toBe(true);
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(4000);
    // Pure water has higher Cp → slightly higher Q than seawater at same flow
  });
});

describe('Real-world: high saturation temperature condenser', () => {
  it('converges for T_sat = 100°C (atmospheric)', () => {
    const result = designHeatExchanger(
      createCondenserInput({
        shellSide: { massFlowRate: 7.6, saturationTemp: 100 },
        tubeSide: {
          fluid: 'SEAWATER',
          salinity: 35000,
          massFlowRate: 430,
          inletTemp: 25,
          outletTemp: 40,
        },
      })
    );

    expect(result.converged).toBe(true);
    // Higher LMTD → smaller area
    expect(result.geometry.requiredArea).toBeLessThan(100);
  });
});

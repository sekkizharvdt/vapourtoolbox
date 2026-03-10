/**
 * Iterative Heat Exchanger Design -- Unit Tests
 *
 * Tests convergence, validation, parameter effects, and real-world scenarios
 * for all three exchanger types: CONDENSER, EVAPORATOR, LIQUID_LIQUID.
 */

import { designHeatExchanger } from './iterativeHXDesign';
import type { IterativeHXInput } from './iterativeHXDesign.types';
import { findTubeIndex } from './heatExchangerSizing';

// == Factory: Condenser ======================================================

/**
 * Create a baseline MED condenser input:
 *   - 5 MW duty (approx)
 *   - Steam condensing at 65C on shell side
 *   - Seawater cooling from 25C to 35C on tube side
 *   - 19.05mm OD, BWG 16, Cu-Ni 90/10 tubes
 *   - 2 passes, 6m effective length
 */
function createCondenserInput(overrides: Partial<IterativeHXInput> = {}): IterativeHXInput {
  return {
    exchangerType: 'CONDENSER',
    tubeSide: {
      fluid: 'SEAWATER',
      salinity: 35000,
      massFlowRate: 430, // ton/hr
      inletTemp: 25,
      outletTemp: 35,
    },
    shellSide: {
      massFlowRate: 7.6, // ton/hr
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
      tubeSide: 0.000088,
      shellSide: 0.0000088,
    },
    ...overrides,
  };
}

// == Factory: Evaporator =====================================================

/**
 * Create a baseline evaporator input:
 *   - Hot water (80C -> 60C) on tube side
 *   - Boiling at 50C on shell side
 *   - ~2.5 MW duty
 */
function createEvaporatorInput(overrides: Partial<IterativeHXInput> = {}): IterativeHXInput {
  return {
    exchangerType: 'EVAPORATOR',
    tubeSide: {
      fluid: 'PURE_WATER',
      massFlowRate: 110, // ton/hr
      inletTemp: 80,
      outletTemp: 60,
    },
    shellSide: {
      massFlowRate: 3.8, // ton/hr vapor produced
      saturationTemp: 50,
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
      tubeSide: 0.000088,
      shellSide: 0.000176, // Higher fouling for boiling service
    },
    ...overrides,
  };
}

// == Factory: Liquid-Liquid ==================================================

/**
 * Create a baseline liquid-liquid heat exchanger input:
 *   - Hot pure water (80C -> 50C) on shell side
 *   - Cold seawater (25C -> 45C) on tube side
 *   - ~3.5 MW duty
 */
function createLiquidLiquidInput(overrides: Partial<IterativeHXInput> = {}): IterativeHXInput {
  return {
    exchangerType: 'LIQUID_LIQUID',
    tubeSide: {
      fluid: 'SEAWATER',
      salinity: 35000,
      massFlowRate: 150, // ton/hr
      inletTemp: 25,
      outletTemp: 45,
    },
    shellSide: {
      fluid: 'PURE_WATER',
      massFlowRate: 100, // ton/hr
      inletTemp: 80,
      outletTemp: 50,
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
      tubeSide: 0.000088,
      shellSide: 0.000088,
    },
    ...overrides,
  };
}

// ============================================================================
// CONDENSER TESTS
// ============================================================================

describe('CONDENSER -- convergence', () => {
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
    if (result.iterations.length > 2) {
      expect(result.iterations[0]!.relativeError).toBeGreaterThan(
        result.iterations[result.iterations.length - 1]!.relativeError
      );
    }
  });
});

describe('CONDENSER -- heat duty & LMTD', () => {
  it('calculates reasonable heat duty for the baseline case', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(4000);
    expect(result.heatDuty.heatDutyKW).toBeLessThan(6000);
  });

  it('calculates LMTD correctly for isothermal condensation', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.lmtdResult.correctedLMTD).toBeCloseTo(34.8, 0);
    expect(result.lmtdResult.correctionFactor).toBe(1.0);
  });

  it('warns on heat duty mismatch between tube and shell sides', () => {
    const result = designHeatExchanger(
      createCondenserInput({
        shellSide: { massFlowRate: 20, saturationTemp: 65 },
      })
    );
    expect(result.warnings.some((w) => w.includes('Heat duty mismatch'))).toBe(true);
  });
});

describe('CONDENSER -- HTC', () => {
  it('tube-side HTC is in expected range for seawater', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.tubeSideHTC).toBeGreaterThan(2000);
    expect(result.tubeSideHTC).toBeLessThan(50000);
  });

  it('shell-side HTC is in expected range for condensation', () => {
    const result = designHeatExchanger(createCondenserInput());
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

describe('CONDENSER -- geometry', () => {
  it('produces reasonable tube count for 5 MW condenser', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.actualTubeCount).toBeGreaterThan(50);
    expect(result.geometry.actualTubeCount).toBeLessThan(500);
  });

  it('tube count is divisible by passes', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.actualTubeCount % result.geometry.tubePasses).toBe(0);
  });

  it('actual area >= required area', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.actualArea).toBeGreaterThanOrEqual(result.geometry.requiredArea);
  });

  it('shell ID is a reasonable size', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.geometry.shellID).toBeGreaterThan(100);
    expect(result.geometry.shellID).toBeLessThan(2000);
  });
});

describe('CONDENSER -- velocity', () => {
  it('tube-side velocity is reasonable', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.velocity.tubeSideVelocity).toBeGreaterThan(0.3);
    expect(result.velocity.tubeSideVelocity).toBeLessThan(15);
  });

  it('pressure drop is positive', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.velocity.tubeSidePressureDrop).toBeGreaterThan(0);
  });

  it('Reynolds number indicates turbulent flow', () => {
    const result = designHeatExchanger(createCondenserInput());
    expect(result.velocity.tubeSideReynolds).toBeGreaterThan(5000);
  });
});

describe('CONDENSER -- parameter effects', () => {
  it('higher flow rate -> more tubes (higher duty)', () => {
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

  it('more tube passes -> higher velocity', () => {
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

  it('higher saturation temperature -> higher LMTD -> smaller area', () => {
    const r1 = designHeatExchanger(
      createCondenserInput({ shellSide: { massFlowRate: 7.6, saturationTemp: 50 } })
    );
    const r2 = designHeatExchanger(
      createCondenserInput({ shellSide: { massFlowRate: 7.6, saturationTemp: 80 } })
    );
    expect(r2.lmtdResult.correctedLMTD).toBeGreaterThan(r1.lmtdResult.correctedLMTD);
    expect(r2.geometry.requiredArea).toBeLessThan(r1.geometry.requiredArea);
  });

  it('higher fouling -> lower overall U -> more area', () => {
    const r1 = designHeatExchanger(
      createCondenserInput({ fouling: { tubeSide: 0.00005, shellSide: 0.00001 } })
    );
    const r2 = designHeatExchanger(
      createCondenserInput({ fouling: { tubeSide: 0.0005, shellSide: 0.0001 } })
    );
    expect(r2.htcResult.overallHTC).toBeLessThan(r1.htcResult.overallHTC);
  });
});

// ============================================================================
// EVAPORATOR TESTS
// ============================================================================

describe('EVAPORATOR -- convergence', () => {
  it('converges for a typical evaporator case', () => {
    const result = designHeatExchanger(createEvaporatorInput());

    expect(result.converged).toBe(true);
    expect(result.iterationCount).toBeGreaterThan(1);
    expect(result.iterationCount).toBeLessThanOrEqual(20);
  });

  it('converges within 15 iterations', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    expect(result.iterationCount).toBeLessThanOrEqual(15);
  });
});

describe('EVAPORATOR -- heat duty & LMTD', () => {
  it('calculates reasonable heat duty', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    // Q = 110 ton/hr * (1/3.6) * 4.18 * 20 = ~2560 kW
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(2000);
    expect(result.heatDuty.heatDutyKW).toBeLessThan(3500);
  });

  it('calculates LMTD for evaporator (isothermal cold side)', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    // Hot: 80->60, Cold: 50->50 (isothermal boiling)
    // DT1 = 80-50 = 30, DT2 = 60-50 = 10
    // LMTD = (30-10)/ln(30/10) = 20/ln(3) = ~18.2
    expect(result.lmtdResult.correctedLMTD).toBeGreaterThan(15);
    expect(result.lmtdResult.correctedLMTD).toBeLessThan(25);
  });
});

describe('EVAPORATOR -- HTC', () => {
  it('shell-side HTC (Mostinski boiling) is in expected range', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    // Mostinski for water boiling: typically 2000-15000 W/m2K
    expect(result.shellSideHTC).toBeGreaterThan(1000);
    expect(result.shellSideHTC).toBeLessThan(20000);
  });

  it('tube-side HTC (Dittus-Boelter) is in expected range', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    expect(result.tubeSideHTC).toBeGreaterThan(1000);
    expect(result.tubeSideHTC).toBeLessThan(50000);
  });

  it('overall HTC is less than both individual HTCs', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    expect(result.htcResult.overallHTC).toBeLessThan(result.tubeSideHTC);
    expect(result.htcResult.overallHTC).toBeLessThan(result.shellSideHTC);
  });
});

describe('EVAPORATOR -- geometry & velocity', () => {
  it('produces reasonable tube count', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    expect(result.geometry.actualTubeCount).toBeGreaterThan(20);
    expect(result.geometry.actualTubeCount).toBeLessThan(1000);
  });

  it('tube count is divisible by passes', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    expect(result.geometry.actualTubeCount % result.geometry.tubePasses).toBe(0);
  });

  it('tube-side velocity is positive', () => {
    const result = designHeatExchanger(createEvaporatorInput());
    expect(result.velocity.tubeSideVelocity).toBeGreaterThan(0.1);
  });
});

describe('EVAPORATOR -- parameter effects', () => {
  it('higher boiling temperature -> smaller LMTD -> larger area', () => {
    const r1 = designHeatExchanger(
      createEvaporatorInput({ shellSide: { massFlowRate: 3.8, saturationTemp: 40 } })
    );
    const r2 = designHeatExchanger(
      createEvaporatorInput({ shellSide: { massFlowRate: 3.8, saturationTemp: 55 } })
    );
    // Higher boiling temp means closer to tube-side temps -> smaller LMTD
    expect(r2.lmtdResult.correctedLMTD).toBeLessThan(r1.lmtdResult.correctedLMTD);
    expect(r2.geometry.requiredArea).toBeGreaterThan(r1.geometry.requiredArea);
  });
});

describe('EVAPORATOR -- validation', () => {
  it('throws when tube inlet <= saturation temp', () => {
    expect(() =>
      designHeatExchanger(
        createEvaporatorInput({
          tubeSide: {
            fluid: 'PURE_WATER',
            massFlowRate: 110,
            inletTemp: 45, // Below boiling point of 50C
            outletTemp: 30,
          },
        })
      )
    ).toThrow('inlet temperature must be above');
  });

  it('throws when tube outlet >= inlet (not cooling)', () => {
    expect(() =>
      designHeatExchanger(
        createEvaporatorInput({
          tubeSide: {
            fluid: 'PURE_WATER',
            massFlowRate: 110,
            inletTemp: 80,
            outletTemp: 90, // Outlet > inlet means heating, not valid for evaporator
          },
        })
      )
    ).toThrow('outlet temperature must be less than inlet');
  });
});

// ============================================================================
// LIQUID-LIQUID TESTS
// ============================================================================

describe('LIQUID_LIQUID -- convergence', () => {
  it('converges for a typical water-to-water heat exchanger', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());

    expect(result.converged).toBe(true);
    expect(result.iterationCount).toBeGreaterThan(1);
    expect(result.iterationCount).toBeLessThanOrEqual(20);
  });

  it('converges within 15 iterations', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    expect(result.iterationCount).toBeLessThanOrEqual(15);
  });
});

describe('LIQUID_LIQUID -- heat duty & LMTD', () => {
  it('calculates reasonable heat duty', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    // Q = 150 ton/hr * (1/3.6) * ~3.99 * 20 = ~3325 kW (seawater Cp ~3.99)
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(2500);
    expect(result.heatDuty.heatDutyKW).toBeLessThan(4500);
  });

  it('calculates LMTD for two-stream counter-current', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    // Hot: 80->50, Cold: 25->45 (counter-current)
    // DT1 = 80-45 = 35, DT2 = 50-25 = 25
    // LMTD = (35-25)/ln(35/25) = 10/ln(1.4) = ~29.7
    expect(result.lmtdResult.correctedLMTD).toBeGreaterThan(25);
    expect(result.lmtdResult.correctedLMTD).toBeLessThan(35);
  });
});

describe('LIQUID_LIQUID -- HTC', () => {
  it('shell-side HTC (Kern) is in expected range', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    // Kern for water cross-flow: typically 500-8000 W/m2K
    expect(result.shellSideHTC).toBeGreaterThan(300);
    expect(result.shellSideHTC).toBeLessThan(15000);
  });

  it('overall HTC is less than both individual HTCs', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    expect(result.htcResult.overallHTC).toBeLessThan(result.tubeSideHTC);
    expect(result.htcResult.overallHTC).toBeLessThan(result.shellSideHTC);
  });

  it('resistance breakdown sums to total', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    const r = result.htcResult.resistances;
    const sum = r.tubeSide + r.tubeSideFouling + r.tubeWall + r.shellSideFouling + r.shellSide;
    expect(sum).toBeCloseTo(r.total, 10);
  });
});

describe('LIQUID_LIQUID -- geometry & velocity', () => {
  it('produces reasonable tube count', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    expect(result.geometry.actualTubeCount).toBeGreaterThan(20);
    expect(result.geometry.actualTubeCount).toBeLessThan(1000);
  });

  it('tube count is divisible by passes', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    expect(result.geometry.actualTubeCount % result.geometry.tubePasses).toBe(0);
  });

  it('tube-side velocity is reasonable', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());
    expect(result.velocity.tubeSideVelocity).toBeGreaterThan(0.1);
    expect(result.velocity.tubeSideVelocity).toBeLessThan(15);
  });
});

describe('LIQUID_LIQUID -- parameter effects', () => {
  it('higher shell flow rate -> higher shell-side HTC', () => {
    const r1 = designHeatExchanger(
      createLiquidLiquidInput({
        shellSide: {
          fluid: 'PURE_WATER',
          massFlowRate: 50,
          inletTemp: 80,
          outletTemp: 50,
        },
      })
    );
    const r2 = designHeatExchanger(
      createLiquidLiquidInput({
        shellSide: {
          fluid: 'PURE_WATER',
          massFlowRate: 200,
          inletTemp: 80,
          outletTemp: 50,
        },
      })
    );
    // Higher velocity -> higher HTC (Kern Nu ~ Re^0.55)
    expect(r2.shellSideHTC).toBeGreaterThan(r1.shellSideHTC);
  });
});

// ============================================================================
// VALIDATION (cross-type)
// ============================================================================

describe('validation -- cross-type', () => {
  it('throws when tube-side inlet >= saturation temp (condenser)', () => {
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

  it('throws when tube-side outlet <= inlet (condenser)', () => {
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

// ============================================================================
// REAL-WORLD SCENARIOS
// ============================================================================

describe('Real-world: 5 MW MED condenser', () => {
  it('produces a complete, physically consistent design', () => {
    const result = designHeatExchanger(createCondenserInput());

    expect(result.converged).toBe(true);
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(4000);
    expect(result.heatDuty.heatDutyKW).toBeLessThan(6000);
    expect(result.lmtdResult.correctedLMTD).toBeGreaterThan(25);
    expect(result.lmtdResult.correctedLMTD).toBeLessThan(45);
    expect(result.htcResult.overallHTC).toBeGreaterThan(1000);
    expect(result.htcResult.overallHTC).toBeLessThan(5000);
    expect(result.geometry.requiredArea).toBeGreaterThan(20);
    expect(result.geometry.requiredArea).toBeLessThan(200);
    expect(result.geometry.shellID).toBeGreaterThan(200);
    expect(result.geometry.shellID).toBeLessThan(1200);
    expect(result.velocity.tubeSideVelocity).toBeGreaterThan(0.5);
    expect(result.velocity.tubeSideVelocity).toBeLessThan(15);

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
  });
});

describe('Real-world: high saturation temperature condenser', () => {
  it('converges for T_sat = 100C (atmospheric)', () => {
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
    expect(result.geometry.requiredArea).toBeLessThan(100);
  });
});

describe('Real-world: MED evaporator', () => {
  it('produces a consistent evaporator design', () => {
    const result = designHeatExchanger(createEvaporatorInput());

    expect(result.converged).toBe(true);
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(2000);
    expect(result.geometry.actualTubeCount).toBeGreaterThan(20);
    expect(result.geometry.shellID).toBeGreaterThan(100);

    const criticalWarnings = result.warnings.filter((w) => w.includes('did not converge'));
    expect(criticalWarnings).toHaveLength(0);
  });
});

describe('Real-world: seawater preheater (liquid-liquid)', () => {
  it('produces a consistent liquid-liquid design', () => {
    const result = designHeatExchanger(createLiquidLiquidInput());

    expect(result.converged).toBe(true);
    expect(result.heatDuty.heatDutyKW).toBeGreaterThan(2500);
    expect(result.geometry.actualTubeCount).toBeGreaterThan(20);
    expect(result.geometry.shellID).toBeGreaterThan(100);

    const criticalWarnings = result.warnings.filter((w) => w.includes('did not converge'));
    expect(criticalWarnings).toHaveLength(0);
  });
});

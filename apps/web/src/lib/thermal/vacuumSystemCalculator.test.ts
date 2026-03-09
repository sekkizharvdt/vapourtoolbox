/**
 * Vacuum System Calculator — Unit Tests
 */

import {
  calculateVacuumSystem,
  type VacuumSystemInput,
  type TrainConfig,
} from './vacuumSystemCalculator';

// ── Factory ──────────────────────────────────────────────────────────────────

function createInput(overrides: Partial<VacuumSystemInput> = {}): VacuumSystemInput {
  return {
    suctionPressureMbar: 40,
    suctionTemperatureC: 30,
    dischargePressureMbar: 1013,
    ncgMode: 'manual',
    dryNcgFlowKgH: 5,
    motivePressureBar: 10,
    coolingWaterTempC: 32,
    sealWaterTempC: 32,
    trainConfig: 'two_stage_ejector',
    ...overrides,
  };
}

// ── Basic Functionality ──────────────────────────────────────────────────────

describe('calculateVacuumSystem — basic', () => {
  it('returns a valid result with stages', () => {
    const result = calculateVacuumSystem(createInput());

    expect(result.totalDryNcgKgH).toBeGreaterThan(0);
    expect(result.totalSuctionFlowKgH).toBeGreaterThan(0);
    expect(result.totalSuctionVolumeM3h).toBeGreaterThan(0);
    expect(result.stages.length).toBeGreaterThan(0);
    expect(result.suctionPressureMbar).toBe(40);
  });

  it('includes vapour with NCG', () => {
    const result = calculateVacuumSystem(createInput());
    expect(result.vapourWithNcgKgH).toBeGreaterThan(0);
    expect(result.totalSuctionFlowKgH).toBeGreaterThan(result.totalDryNcgKgH);
  });

  it('design volume includes margin', () => {
    const result = calculateVacuumSystem(createInput({ designMargin: 0.2 }));
    expect(result.designSuctionVolumeM3h).toBeGreaterThan(result.totalSuctionVolumeM3h);
    expect(result.designMargin).toBe(0.2);
  });

  it('returns new heiLeakageKgH and manualNcgKgH breakdown fields', () => {
    const result = calculateVacuumSystem(createInput());
    expect(typeof result.heiLeakageKgH).toBe('number');
    expect(typeof result.manualNcgKgH).toBe('number');
  });
});

// ── NCG Load Modes ───────────────────────────────────────────────────────────

describe('calculateVacuumSystem — NCG modes', () => {
  it('manual mode uses provided NCG flow', () => {
    const result = calculateVacuumSystem(createInput({ ncgMode: 'manual', dryNcgFlowKgH: 10 }));
    expect(result.manualNcgKgH).toBeCloseTo(10, 0);
    expect(result.airLeakageKgH).toBeCloseTo(10, 0);
  });

  it('HEI leakage mode estimates from system volume', () => {
    const result = calculateVacuumSystem(
      createInput({
        ncgMode: 'hei_leakage',
        systemVolumeM3: 100,
        dryNcgFlowKgH: undefined,
      })
    );
    expect(result.heiLeakageKgH).toBeGreaterThan(0);
    expect(result.airLeakageKgH).toBeGreaterThan(0);
  });

  it('seawater mode includes dissolved gas', () => {
    const result = calculateVacuumSystem(
      createInput({
        ncgMode: 'seawater',
        seawaterFlowM3h: 500,
        seawaterTemperatureC: 25,
        salinityGkg: 35,
        dryNcgFlowKgH: undefined,
      })
    );
    expect(result.dissolvedGasKgH).toBeGreaterThan(0);
    expect(result.totalDryNcgKgH).toBeGreaterThanOrEqual(result.dissolvedGasKgH);
  });
});

// ── Combined NCG Mode ───────────────────────────────────────────────────────

describe('calculateVacuumSystem — combined NCG mode', () => {
  it('sums manual + HEI leakage', () => {
    const result = calculateVacuumSystem(
      createInput({
        ncgMode: 'combined',
        includeManualNcg: true,
        includeHeiLeakage: true,
        includeSeawaterGas: false,
        dryNcgFlowKgH: 3,
        systemVolumeM3: 100,
        connectionCount: 20,
      })
    );
    expect(result.manualNcgKgH).toBeCloseTo(3, 0);
    expect(result.heiLeakageKgH).toBeGreaterThan(0);
    // Total should be sum of both
    expect(result.totalDryNcgKgH).toBeCloseTo(result.manualNcgKgH + result.heiLeakageKgH, 0);
  });

  it('sums manual + seawater dissolved gas', () => {
    const result = calculateVacuumSystem(
      createInput({
        ncgMode: 'combined',
        includeManualNcg: true,
        includeHeiLeakage: false,
        includeSeawaterGas: true,
        dryNcgFlowKgH: 2,
        seawaterFlowM3h: 500,
        seawaterTemperatureC: 25,
        salinityGkg: 35,
      })
    );
    expect(result.manualNcgKgH).toBeCloseTo(2, 0);
    expect(result.dissolvedGasKgH).toBeGreaterThan(0);
    expect(result.totalDryNcgKgH).toBeGreaterThan(result.manualNcgKgH);
  });

  it('sums all three sources together', () => {
    const result = calculateVacuumSystem(
      createInput({
        ncgMode: 'combined',
        includeManualNcg: true,
        includeHeiLeakage: true,
        includeSeawaterGas: true,
        dryNcgFlowKgH: 2,
        systemVolumeM3: 50,
        connectionCount: 10,
        seawaterFlowM3h: 500,
        seawaterTemperatureC: 25,
        salinityGkg: 35,
      })
    );
    expect(result.manualNcgKgH).toBeGreaterThan(0);
    expect(result.heiLeakageKgH).toBeGreaterThan(0);
    expect(result.dissolvedGasKgH).toBeGreaterThan(0);
    // Total should be all three
    const expectedTotal = result.manualNcgKgH + result.heiLeakageKgH + result.dissolvedGasKgH;
    expect(result.totalDryNcgKgH).toBeCloseTo(expectedTotal, 0);
  });

  it('throws when no sources are enabled', () => {
    expect(() =>
      calculateVacuumSystem(
        createInput({
          ncgMode: 'combined',
          includeManualNcg: false,
          includeHeiLeakage: false,
          includeSeawaterGas: false,
          dryNcgFlowKgH: 0,
        })
      )
    ).toThrow();
  });
});

// ── Train Configurations ─────────────────────────────────────────────────────

describe('calculateVacuumSystem — train configs', () => {
  const trainConfigs: TrainConfig[] = [
    'single_ejector',
    'two_stage_ejector',
    'lrvp_only',
    'hybrid',
  ];

  for (const config of trainConfigs) {
    it(`${config} returns valid stages`, () => {
      const result = calculateVacuumSystem(createInput({ trainConfig: config }));
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.trainConfig).toBe(config);
    });
  }

  it('two_stage_ejector has at least 2 stages', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'two_stage_ejector' }));
    const ejectorStages = result.stages.filter((s) => s.type === 'ejector');
    expect(ejectorStages.length).toBeGreaterThanOrEqual(2);
  });

  it('lrvp_only has an LRVP stage', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only' }));
    const lrvpStages = result.stages.filter((s) => s.type === 'lrvp');
    expect(lrvpStages.length).toBeGreaterThanOrEqual(1);
  });

  it('hybrid has both ejector and LRVP stages', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'hybrid' }));
    const ejectorStages = result.stages.filter((s) => s.type === 'ejector');
    const lrvpStages = result.stages.filter((s) => s.type === 'lrvp');
    expect(ejectorStages.length).toBeGreaterThanOrEqual(1);
    expect(lrvpStages.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Ejector Stages ───────────────────────────────────────────────────────────

describe('calculateVacuumSystem — ejector stages', () => {
  it('ejector stages consume motive steam', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'two_stage_ejector' }));
    expect(result.totalMotiveSteamKgH).toBeGreaterThan(0);

    const ejectorStages = result.stages.filter((s) => s.type === 'ejector');
    for (const stage of ejectorStages) {
      expect(stage.motiveSteamKgH).toBeGreaterThan(0);
      expect(stage.entrainmentRatio).toBeGreaterThan(0);
      expect(stage.compressionRatio).toBeGreaterThan(1);
    }
  });

  it('higher motive pressure → equal or lower steam consumption', () => {
    const low = calculateVacuumSystem(createInput({ motivePressureBar: 5 }));
    const high = calculateVacuumSystem(createInput({ motivePressureBar: 15 }));
    expect(high.totalMotiveSteamKgH).toBeLessThanOrEqual(low.totalMotiveSteamKgH);
  });
});

// ── LRVP Stages — Multiple Pumps ────────────────────────────────────────────

describe('calculateVacuumSystem — LRVP stages', () => {
  it('LRVP stages have model, power, and count', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only' }));
    const lrvpStages = result.stages.filter((s) => s.type === 'lrvp');

    for (const stage of lrvpStages) {
      expect(stage.lrvpModel).toBeTruthy();
      expect(stage.lrvpPowerKW).toBeGreaterThan(0);
      expect(stage.lrvpRatedCapacityM3h).toBeGreaterThan(0);
      expect(stage.lrvpCount).toBeGreaterThanOrEqual(1);
      expect(stage.lrvpTotalPowerKW).toBeGreaterThan(0);
    }

    expect(result.totalPowerKW).toBeGreaterThan(0);
  });

  it('uses multiple pumps in parallel for large loads', () => {
    // At 40 mbar, 30°C, 5 kg/h NCG → very large suction volume
    // This should require multiple pumps in parallel
    const result = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only' }));
    const lrvpStage = result.stages.find((s) => s.type === 'lrvp')!;
    // At these conditions the volume is enormous — should need multiple pumps
    expect(lrvpStage.lrvpCount).toBeGreaterThan(1);
    expect(lrvpStage.lrvpTotalPowerKW).toBe(lrvpStage.lrvpPowerKW! * lrvpStage.lrvpCount!);
  });

  it('more NCG → more pumps or larger pump', () => {
    const low = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only', dryNcgFlowKgH: 2 }));
    const high = calculateVacuumSystem(
      createInput({ trainConfig: 'lrvp_only', dryNcgFlowKgH: 20 })
    );
    expect(high.totalPowerKW).toBeGreaterThanOrEqual(low.totalPowerKW);
  });

  it('selects optimal frame size to minimize total power', () => {
    // Small load that fits in a single pump
    const result = calculateVacuumSystem(
      createInput({
        trainConfig: 'lrvp_only',
        suctionPressureMbar: 200,
        suctionTemperatureC: 20,
        dryNcgFlowKgH: 1,
      })
    );
    const lrvpStage = result.stages.find((s) => s.type === 'lrvp')!;
    // Should fit in a single pump at moderate vacuum
    expect(lrvpStage.lrvpCount).toBeGreaterThanOrEqual(1);
    expect(lrvpStage.lrvpTotalPowerKW).toBeLessThanOrEqual(110); // Not always the max frame
  });
});

// ── Parameter Effects ────────────────────────────────────────────────────────

describe('calculateVacuumSystem — parameter effects', () => {
  it('more NCG load → more steam/power', () => {
    const low = calculateVacuumSystem(createInput({ dryNcgFlowKgH: 2 }));
    const high = calculateVacuumSystem(createInput({ dryNcgFlowKgH: 20 }));
    expect(high.totalMotiveSteamKgH).toBeGreaterThan(low.totalMotiveSteamKgH);
  });

  it('deeper vacuum → more steam consumption', () => {
    const shallow = calculateVacuumSystem(createInput({ suctionPressureMbar: 100 }));
    const deep = calculateVacuumSystem(createInput({ suctionPressureMbar: 20 }));
    expect(deep.totalMotiveSteamKgH).toBeGreaterThan(shallow.totalMotiveSteamKgH);
  });
});

// ── Evacuation Time ─────────────────────────────────────────────────────────

describe('calculateVacuumSystem — evacuation time', () => {
  it('calculates evacuation time when vessel volume provided (LRVP config)', () => {
    const result = calculateVacuumSystem(
      createInput({
        trainConfig: 'lrvp_only',
        evacuationVolumeM3: 50,
      })
    );
    expect(result.evacuationVolumeM3).toBe(50);
    expect(result.evacuationTimeMinutes).toBeGreaterThan(0);
    expect(result.evacuationSteps).toBeDefined();
    expect(result.evacuationSteps!.length).toBeGreaterThan(0);
  });

  it('calculates evacuation time for ejector configs using dedicated LRVP', () => {
    const result = calculateVacuumSystem(
      createInput({
        trainConfig: 'two_stage_ejector',
        evacuationVolumeM3: 50,
      })
    );
    expect(result.evacuationTimeMinutes).toBeGreaterThan(0);
    // Should warn about separate pump needed
    const hasEvacWarning = result.warnings.some((w) => w.includes('Evacuation'));
    expect(hasEvacWarning).toBe(true);
  });

  it('larger vessel → longer evacuation', () => {
    const small = calculateVacuumSystem(
      createInput({ trainConfig: 'lrvp_only', evacuationVolumeM3: 20 })
    );
    const large = calculateVacuumSystem(
      createInput({ trainConfig: 'lrvp_only', evacuationVolumeM3: 200 })
    );
    expect(large.evacuationTimeMinutes!).toBeGreaterThan(small.evacuationTimeMinutes!);
  });

  it('does not calculate evacuation when no volume given', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only' }));
    expect(result.evacuationTimeMinutes).toBeUndefined();
    expect(result.evacuationSteps).toBeUndefined();
  });

  it('evacuation steps show decreasing pressure and increasing time', () => {
    const result = calculateVacuumSystem(
      createInput({ trainConfig: 'lrvp_only', evacuationVolumeM3: 50 })
    );
    const steps = result.evacuationSteps!;
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.pressureMbar).toBeLessThan(steps[i - 1]!.pressureMbar);
      expect(steps[i]!.cumulativeMinutes).toBeGreaterThanOrEqual(steps[i - 1]!.cumulativeMinutes);
    }
  });
});

// ── Warnings ─────────────────────────────────────────────────────────────────

describe('calculateVacuumSystem — warnings', () => {
  it('returns warnings array', () => {
    const result = calculateVacuumSystem(createInput());
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('warns about multiple parallel LRVP pumps', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only' }));
    const lrvpStage = result.stages.find((s) => s.type === 'lrvp')!;
    if (lrvpStage.lrvpCount! > 1) {
      const hasParallelWarning = result.warnings.some((w) => w.includes('parallel'));
      expect(hasParallelWarning).toBe(true);
    }
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('calculateVacuumSystem — validation', () => {
  it('throws for suction pressure >= discharge pressure', () => {
    expect(() =>
      calculateVacuumSystem(createInput({ suctionPressureMbar: 1100, dischargePressureMbar: 1013 }))
    ).toThrow();
  });

  it('throws for negative NCG flow in manual mode', () => {
    expect(() => calculateVacuumSystem(createInput({ dryNcgFlowKgH: -1 }))).toThrow();
  });
});

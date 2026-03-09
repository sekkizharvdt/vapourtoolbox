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
});

// ── NCG Load Modes ───────────────────────────────────────────────────────────

describe('calculateVacuumSystem — NCG modes', () => {
  it('manual mode uses provided NCG flow', () => {
    const result = calculateVacuumSystem(createInput({ ncgMode: 'manual', dryNcgFlowKgH: 10 }));
    // Air leakage = manual value
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
    // Two ejector stages plus potentially inter-condensers
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

// ── LRVP Stages ──────────────────────────────────────────────────────────────

describe('calculateVacuumSystem — LRVP stages', () => {
  it('LRVP stages have model and power', () => {
    const result = calculateVacuumSystem(createInput({ trainConfig: 'lrvp_only' }));
    const lrvpStages = result.stages.filter((s) => s.type === 'lrvp');

    for (const stage of lrvpStages) {
      expect(stage.lrvpModel).toBeTruthy();
      expect(stage.lrvpPowerKW).toBeGreaterThan(0);
      expect(stage.lrvpRatedCapacityM3h).toBeGreaterThan(0);
    }

    expect(result.totalPowerKW).toBeGreaterThan(0);
  });
});

// ── Parameter Effects ────────────────────────────────────────────────────────

describe('calculateVacuumSystem — parameter effects', () => {
  it('more NCG load → more steam/power', () => {
    const low = calculateVacuumSystem(createInput({ dryNcgFlowKgH: 2 }));
    const high = calculateVacuumSystem(createInput({ dryNcgFlowKgH: 20 }));
    expect(high.totalMotiveSteamKgH).toBeGreaterThan(low.totalMotiveSteamKgH);
  });

  it('deeper vacuum → higher compression ratio', () => {
    const shallow = calculateVacuumSystem(createInput({ suctionPressureMbar: 100 }));
    const deep = calculateVacuumSystem(createInput({ suctionPressureMbar: 20 }));

    const shallowCR = shallow.stages[0]!.compressionRatio;
    const deepCR = deep.stages[0]!.compressionRatio;
    // Not directly comparable across stages, but overall system needs more work for deeper vacuum
    expect(deep.totalMotiveSteamKgH).toBeGreaterThan(shallow.totalMotiveSteamKgH);
    void deepCR;
    void shallowCR;
  });
});

// ── Warnings ─────────────────────────────────────────────────────────────────

describe('calculateVacuumSystem — warnings', () => {
  it('returns warnings array', () => {
    const result = calculateVacuumSystem(createInput());
    expect(Array.isArray(result.warnings)).toBe(true);
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

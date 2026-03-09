/**
 * Chemical Dosing & CIP Calculator — Unit Tests
 */

import {
  calculateDosing,
  calculateCIP,
  calculateTankDimensions,
  calculatePumpPressure,
  selectDosingLine,
  CHEMICAL_PRODUCTS,
  ACID_PRODUCTS,
  DOSING_TUBING_SIZES,
  CIP_TANK_MARGIN,
  BUND_FACTOR,
  type DosingInput,
  type CIPInput,
} from './chemicalDosingCalculator';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createDosingInput(overrides: Partial<DosingInput> = {}): DosingInput {
  return {
    feedFlowM3h: 100,
    doseMgL: 2,
    solutionDensityKgL: 1.1,
    storageDays: 30,
    ...overrides,
  };
}

function createCIPInput(overrides: Partial<CIPInput> = {}): CIPInput {
  return {
    acidType: 'formic',
    heatExchangerArea: 500,
    cleaningConcentration: 3,
    recirculationFlowM3h: 50,
    cleaningDurationHrs: 6,
    numberOfRinses: 3,
    cleaningsPerYear: 4,
    ...overrides,
  };
}

// ── Constants integrity ──────────────────────────────────────────────────────

describe('Constants', () => {
  test('CHEMICAL_PRODUCTS has antiscalant and antifoam', () => {
    expect(CHEMICAL_PRODUCTS.antiscalant).toBeDefined();
    expect(CHEMICAL_PRODUCTS.antifoam).toBeDefined();
    expect(CHEMICAL_PRODUCTS.antiscalant.productName).toBe('Belgard EV 2050');
    expect(CHEMICAL_PRODUCTS.antifoam.productName).toBe('Belite M8');
  });

  test('ACID_PRODUCTS has formic, citric, and hydrochloric', () => {
    expect(ACID_PRODUCTS.formic).toBeDefined();
    expect(ACID_PRODUCTS.citric).toBeDefined();
    expect(ACID_PRODUCTS.hydrochloric).toBeDefined();
    expect(ACID_PRODUCTS.formic.neatConcentration).toBe(85);
    expect(ACID_PRODUCTS.citric.neatConcentration).toBe(50);
    expect(ACID_PRODUCTS.hydrochloric.neatConcentration).toBe(33);
  });

  test('all acid products have valid concentration ranges', () => {
    for (const acid of Object.values(ACID_PRODUCTS)) {
      expect(acid.typicalCleaningMin).toBeGreaterThan(0);
      expect(acid.typicalCleaningMax).toBeGreaterThan(acid.typicalCleaningMin);
      expect(acid.defaultCleaningConc).toBeGreaterThanOrEqual(acid.typicalCleaningMin);
      expect(acid.defaultCleaningConc).toBeLessThanOrEqual(acid.typicalCleaningMax);
      expect(acid.neatDensity).toBeGreaterThan(1);
    }
  });

  test('DOSING_TUBING_SIZES are sorted ascending by OD', () => {
    for (let i = 1; i < DOSING_TUBING_SIZES.length; i++) {
      expect(DOSING_TUBING_SIZES[i]!.od).toBeGreaterThan(DOSING_TUBING_SIZES[i - 1]!.od);
    }
  });

  test('tubing ID = OD - 2×wall', () => {
    for (const tube of DOSING_TUBING_SIZES) {
      expect(tube.id).toBeCloseTo(tube.od - 2 * tube.wall, 1);
    }
  });
});

// ── calculateDosing — core ───────────────────────────────────────────────────

describe('calculateDosing — core', () => {
  test('basic dosing calculation', () => {
    const result = calculateDosing(createDosingInput());
    // 100 m³/h × 2 mg/L = 200 g/h active chemical
    expect(result.activeChemicalGh).toBeCloseTo(200, 1);
    // 200 g/h / (1.1 kg/L × 1000 g/kg) = 0.1818 L/h
    expect(result.chemicalFlowLh).toBeCloseTo(0.1818, 3);
    expect(result.chemicalFlowMlMin).toBeCloseTo(3.03, 1);
    expect(result.doseConfirmMgL).toBe(2);
  });

  test('daily consumption = flow × density × 24', () => {
    const result = calculateDosing(createDosingInput());
    const expectedDaily = result.chemicalFlowLh * 1.1 * 24;
    expect(result.dailyConsumptionKg).toBeCloseTo(expectedDaily, 2);
  });

  test('monthly = daily × 30.4, annual = daily × 365', () => {
    const result = calculateDosing(createDosingInput());
    expect(result.monthlyConsumptionKg).toBeCloseTo(result.dailyConsumptionKg * 30.4, 1);
    expect(result.annualConsumptionKg).toBeCloseTo(result.dailyConsumptionKg * 365, 0);
  });

  test('zero dose produces zero flows', () => {
    const result = calculateDosing(createDosingInput({ doseMgL: 0 }));
    expect(result.chemicalFlowLh).toBe(0);
    expect(result.activeChemicalGh).toBe(0);
    expect(result.dailyConsumptionKg).toBe(0);
  });

  test('higher feed flow → proportionally higher consumption', () => {
    const r1 = calculateDosing(createDosingInput({ feedFlowM3h: 100 }));
    const r2 = calculateDosing(createDosingInput({ feedFlowM3h: 200 }));
    expect(r2.chemicalFlowLh).toBeCloseTo(r1.chemicalFlowLh * 2, 4);
    expect(r2.dailyConsumptionKg).toBeCloseTo(r1.dailyConsumptionKg * 2, 2);
  });

  test('includes dosingLine in result', () => {
    const result = calculateDosing(createDosingInput());
    expect(result.dosingLine).toBeDefined();
    expect(result.dosingLine.tubingOD).toBeGreaterThan(0);
    expect(result.dosingLine.velocity).toBeGreaterThan(0);
  });
});

// ── calculateDosing — validation ─────────────────────────────────────────────

describe('calculateDosing — validation', () => {
  test('throws for zero feed flow', () => {
    expect(() => calculateDosing(createDosingInput({ feedFlowM3h: 0 }))).toThrow(
      'Feed flow must be positive'
    );
  });

  test('throws for negative dose', () => {
    expect(() => calculateDosing(createDosingInput({ doseMgL: -1 }))).toThrow(
      'Dose must be non-negative'
    );
  });

  test('throws for zero density', () => {
    expect(() => calculateDosing(createDosingInput({ solutionDensityKgL: 0 }))).toThrow(
      'Solution density must be positive'
    );
  });
});

// ── calculateDosing — storage tank ───────────────────────────────────────────

describe('calculateDosing — storage tank', () => {
  test('calculates storage tank when storageDays provided', () => {
    const result = calculateDosing(createDosingInput({ storageDays: 30 }));
    expect(result.storageTankM3).toBeDefined();
    expect(result.storageTankM3).toBeGreaterThan(0);
    expect(result.storageTank).toBeDefined();
    expect(result.storageTank!.type).toBe('cylindrical');
    expect(result.bundVolume).toBeDefined();
  });

  test('no storage tank when storageDays not provided', () => {
    const result = calculateDosing(createDosingInput({ storageDays: undefined }));
    expect(result.storageTankM3).toBeUndefined();
    expect(result.storageTank).toBeUndefined();
  });

  test('bund volume = 110% of tank volume', () => {
    const result = calculateDosing(createDosingInput({ storageDays: 30 }));
    expect(result.bundVolume).toBeCloseTo(result.storageTankM3! * BUND_FACTOR, 2);
  });

  test('rectangular tank when specified', () => {
    const result = calculateDosing(createDosingInput({ storageDays: 30, tankType: 'rectangular' }));
    expect(result.storageTank!.type).toBe('rectangular');
    expect(result.storageTank!.length).toBeDefined();
    expect(result.storageTank!.width).toBeDefined();
  });
});

// ── calculateDosing — pump pressure ──────────────────────────────────────────

describe('calculateDosing — pump pressure', () => {
  test('calculates pump pressure when linePressure provided', () => {
    const result = calculateDosing(createDosingInput({ linePressureBarG: 3 }));
    expect(result.pumpPressure).toBeDefined();
    expect(result.pumpPressure!.linePressure).toBe(3);
    expect(result.pumpPressure!.requiredDischargePressure).toBe(5); // 3 + 1.5 + 0.5
  });

  test('no pump pressure when linePressure not provided', () => {
    const result = calculateDosing(createDosingInput());
    expect(result.pumpPressure).toBeUndefined();
  });

  test('zero line pressure still produces result (atmospheric injection)', () => {
    const result = calculateDosing(createDosingInput({ linePressureBarG: 0 }));
    expect(result.pumpPressure).toBeDefined();
    expect(result.pumpPressure!.requiredDischargePressure).toBe(2); // 0 + 1.5 + 0.5
  });
});

// ── calculateDosing — dilution ───────────────────────────────────────────────

describe('calculateDosing — dilution', () => {
  test('calculates dilution when neat and working concentrations provided', () => {
    const result = calculateDosing(
      createDosingInput({ neatConcentration: 100, workingConcentration: 10 })
    );
    expect(result.dilution).toBeDefined();
    expect(result.dilution!.dilutionRatio).toBeCloseTo(10, 1);
    expect(result.dilution!.dilutedSolutionFlowLh).toBeCloseTo(
      result.dilution!.neatChemicalFlowLh * 10,
      3
    );
  });

  test('dilution water = total diluted - neat', () => {
    const result = calculateDosing(
      createDosingInput({ neatConcentration: 100, workingConcentration: 20 })
    );
    const d = result.dilution!;
    expect(d.dilutionWaterFlowLh).toBeCloseTo(d.dilutedSolutionFlowLh - d.neatChemicalFlowLh, 3);
  });

  test('no dilution when workingConc not provided', () => {
    const result = calculateDosing(createDosingInput({ neatConcentration: 100 }));
    expect(result.dilution).toBeUndefined();
  });

  test('warns when working >= neat concentration', () => {
    const result = calculateDosing(
      createDosingInput({ neatConcentration: 50, workingConcentration: 60 })
    );
    expect(result.dilution).toBeUndefined();
    expect(result.warnings.some((w) => w.includes('Working concentration'))).toBe(true);
  });

  test('dilution tank sized when dilutionTankDays provided', () => {
    const result = calculateDosing(
      createDosingInput({
        neatConcentration: 100,
        workingConcentration: 10,
        dilutionTankDays: 7,
      })
    );
    expect(result.dilution!.dilutionTank).toBeDefined();
    expect(result.dilution!.dilutionTank!.volume).toBeGreaterThan(0);
    expect(result.dilution!.dilutionTankBund).toBeDefined();
  });
});

// ── Tank dimensions ──────────────────────────────────────────────────────────

describe('calculateTankDimensions', () => {
  test('cylindrical tank with default aspect ratio', () => {
    const tank = calculateTankDimensions(1.0, 'cylindrical', 1.5);
    expect(tank.type).toBe('cylindrical');
    expect(tank.volume).toBe(1.0);
    expect(tank.volumeLitres).toBe(1000);
    expect(tank.diameter).toBeDefined();
    expect(tank.height).toBeGreaterThan(0);
    // Verify: V = π/4 × D² × H
    const V = (Math.PI / 4) * tank.diameter! ** 2 * tank.height;
    expect(V).toBeCloseTo(1.0, 2);
  });

  test('aspect ratio is respected (H/D)', () => {
    const tank = calculateTankDimensions(1.0, 'cylindrical', 2.0);
    expect(tank.height / tank.diameter!).toBeCloseTo(2.0, 1);
  });

  test('rectangular tank with square base', () => {
    const tank = calculateTankDimensions(1.0, 'rectangular', 1.5);
    expect(tank.type).toBe('rectangular');
    expect(tank.length).toBeDefined();
    expect(tank.width).toBeDefined();
    expect(tank.length).toBeCloseTo(tank.width!, 3);
    // V = L × W × H
    const V = tank.length! * tank.width! * tank.height;
    expect(V).toBeCloseTo(1.0, 2);
  });

  test('zero volume returns zero dimensions', () => {
    const tank = calculateTankDimensions(0);
    expect(tank.volume).toBe(0);
    expect(tank.height).toBe(0);
  });
});

// ── Pump pressure ────────────────────────────────────────────────────────────

describe('calculatePumpPressure', () => {
  test('discharge = line + BPV + injection loss', () => {
    const pp = calculatePumpPressure(5);
    expect(pp.linePressure).toBe(5);
    expect(pp.backPressureValve).toBe(1.5);
    expect(pp.injectionLoss).toBe(0.5);
    expect(pp.requiredDischargePressure).toBe(7);
  });
});

// ── Dosing line selection ────────────────────────────────────────────────────

describe('selectDosingLine', () => {
  test('selects smallest tubing with velocity ≤ 1.5 m/s', () => {
    const line = selectDosingLine(0.5); // 0.5 L/h — very small flow
    expect(line.tubingOD).toBe(DOSING_TUBING_SIZES[0]!.od);
  });

  test('moves to larger tubing for higher flows', () => {
    const small = selectDosingLine(0.1);
    const large = selectDosingLine(100);
    expect(large.tubingOD).toBeGreaterThanOrEqual(small.tubingOD);
  });

  test('flags low velocity', () => {
    // Very low flow in smallest tube
    const line = selectDosingLine(0.001);
    expect(line.velocityStatus).toBe('low');
  });

  test('uses largest tube for very high flows', () => {
    const line = selectDosingLine(10000);
    expect(line.tubingOD).toBe(DOSING_TUBING_SIZES[DOSING_TUBING_SIZES.length - 1]!.od);
  });
});

// ── calculateCIP — core ─────────────────────────────────────────────────────

describe('calculateCIP — core', () => {
  test('basic CIP calculation', () => {
    const result = calculateCIP(createCIPInput());

    // System volume: 500 m² × 3 L/m² = 1500 L = 1.5 m³
    expect(result.systemVolumeLitres).toBeCloseTo(1500, 0);
    expect(result.systemVolume).toBeCloseTo(1.5, 2);

    // Neat acid: 1500 L × 3% / 85% = 52.94 L
    expect(result.neatAcidLitres).toBeCloseTo(52.94, 0);

    // Neat acid mass: 52.94 L × 1.22 kg/L = 64.59 kg
    expect(result.neatAcidMassKg).toBeCloseTo(64.59, 0);
  });

  test('system volume includes piping hold-up', () => {
    const result = calculateCIP(createCIPInput({ pipingHoldup: 0.5 }));
    // 1.5 (HX) + 0.5 (piping) = 2.0 m³
    expect(result.systemVolume).toBeCloseTo(2.0, 2);
    expect(result.pipingVolume).toBeCloseTo(0.5, 2);
  });

  test('system volume override skips area-based calculation', () => {
    const result = calculateCIP(createCIPInput({ systemHoldupOverride: 3.0 }));
    expect(result.systemVolume).toBeCloseTo(3.0, 2);
  });

  test('custom specific volume changes system volume', () => {
    const r1 = calculateCIP(createCIPInput({ specificVolume: 3 }));
    const r2 = calculateCIP(createCIPInput({ specificVolume: 5 }));
    expect(r2.systemVolume).toBeGreaterThan(r1.systemVolume);
  });

  test('rinse water = numberOfRinses × system volume', () => {
    const result = calculateCIP(createCIPInput({ numberOfRinses: 3 }));
    expect(result.totalRinseWater).toBeCloseTo(result.rinseWaterPerRinse * 3, 3);
  });

  test('volume turnovers calculated correctly', () => {
    const result = calculateCIP(createCIPInput());
    // 50 m³/h × 6h = 300 m³ circulated / 1.5 m³ system = 200 turnovers
    expect(result.volumeTurnovers).toBeCloseTo(200, 0);
    expect(result.turnoverStatus).toBe('high'); // 200 > 50
  });

  test('low turnovers warning', () => {
    const result = calculateCIP(
      createCIPInput({
        recirculationFlowM3h: 0.5, // very low flow
        cleaningDurationHrs: 1,
      })
    );
    // 0.5 × 1 / 1.5 = 0.33 turnovers
    expect(result.volumeTurnovers).toBeLessThan(3);
    expect(result.turnoverStatus).toBe('low');
    expect(result.warnings.some((w) => w.includes('turnovers'))).toBe(true);
  });

  test('annual consumption = per-clean × cleans per year', () => {
    const result = calculateCIP(createCIPInput({ cleaningsPerYear: 4 }));
    expect(result.annualNeatAcidKg).toBeCloseTo(result.neatAcidMassKg * 4, 0);
    expect(result.annualNeatAcidLitres).toBeCloseTo(result.neatAcidLitres * 4, 0);
    expect(result.annualWaterM3).toBeCloseTo(result.totalWaterPerClean * 4, 0);
  });
});

// ── calculateCIP — tank sizing ───────────────────────────────────────────────

describe('calculateCIP — tank sizing', () => {
  test('CIP mixing tank = system volume × (1 + margin)', () => {
    const result = calculateCIP(createCIPInput());
    const expectedVol = result.systemVolume * (1 + CIP_TANK_MARGIN);
    expect(result.cipTank.volume).toBeCloseTo(expectedVol, 2);
  });

  test('storage tank when storageDays provided', () => {
    const result = calculateCIP(createCIPInput({ storageDays: 90 }));
    expect(result.storageTank).toBeDefined();
    expect(result.storageTank!.volume).toBeGreaterThan(0);
    expect(result.bundVolume).toBeDefined();
  });

  test('no storage tank when storageDays not provided', () => {
    const result = calculateCIP(createCIPInput());
    expect(result.storageTank).toBeUndefined();
  });
});

// ── calculateCIP — validation ────────────────────────────────────────────────

describe('calculateCIP — validation', () => {
  test('throws for zero HX area', () => {
    expect(() => calculateCIP(createCIPInput({ heatExchangerArea: 0 }))).toThrow(
      'Heat exchanger area must be positive'
    );
  });

  test('throws for cleaning conc > neat conc', () => {
    expect(() =>
      calculateCIP(createCIPInput({ acidType: 'formic', cleaningConcentration: 90 }))
    ).toThrow('exceeds neat acid concentration');
  });

  test('throws for zero recirculation flow', () => {
    expect(() => calculateCIP(createCIPInput({ recirculationFlowM3h: 0 }))).toThrow(
      'Recirculation flow must be positive'
    );
  });

  test('warns when cleaning conc below typical range', () => {
    const result = calculateCIP(createCIPInput({ cleaningConcentration: 0.5 }));
    expect(result.warnings.some((w) => w.includes('below typical range'))).toBe(true);
  });

  test('warns when cleaning conc above typical range', () => {
    const result = calculateCIP(createCIPInput({ cleaningConcentration: 8, acidType: 'formic' }));
    expect(result.warnings.some((w) => w.includes('exceeds typical range'))).toBe(true);
  });
});

// ── calculateCIP — acid types ────────────────────────────────────────────────

describe('calculateCIP — different acids', () => {
  test('formic acid uses 85% neat concentration', () => {
    const result = calculateCIP(createCIPInput({ acidType: 'formic' }));
    // Neat litres = system_L × target% / 85%
    const expected = (result.systemVolumeLitres * 3) / 85;
    expect(result.neatAcidLitres).toBeCloseTo(expected, 0);
  });

  test('citric acid uses 50% neat concentration', () => {
    const result = calculateCIP(createCIPInput({ acidType: 'citric' }));
    const expected = (result.systemVolumeLitres * 3) / 50;
    expect(result.neatAcidLitres).toBeCloseTo(expected, 0);
  });

  test('HCl uses 33% neat concentration', () => {
    const result = calculateCIP(createCIPInput({ acidType: 'hydrochloric' }));
    const expected = (result.systemVolumeLitres * 3) / 33;
    expect(result.neatAcidLitres).toBeCloseTo(expected, 0);
  });

  test('lower neat concentration → more neat acid needed', () => {
    const formic = calculateCIP(createCIPInput({ acidType: 'formic' }));
    const hcl = calculateCIP(createCIPInput({ acidType: 'hydrochloric' }));
    // HCl (33%) needs more litres than formic (85%) for same target conc
    expect(hcl.neatAcidLitres).toBeGreaterThan(formic.neatAcidLitres);
  });
});

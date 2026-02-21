/**
 * Suction System Calculator Tests
 *
 * Tests for MED pump suction system design calculations.
 */

import {
  calculateSuctionSystem,
  validateSuctionSystemInput,
  parseNPSToNumber,
  type SuctionSystemInput,
} from './suctionSystemCalculator';

// ============================================================================
// Mocks
// ============================================================================

// Mock @vapour/constants
jest.mock('@vapour/constants', () => ({
  getSaturationTemperature: jest.fn((pressureBar: number) => {
    // Approximate Antoine equation: T ≈ 100 × (P/1.01325)^0.25 for low pressures
    // For 0.3 bar → ~69°C, 0.1 bar → ~46°C
    if (pressureBar <= 0) return 20;
    return 100 * Math.pow(pressureBar / 1.01325, 0.25);
  }),
  getSaturationPressure: jest.fn((tempC: number) => {
    // Inverse: P ≈ 1.01325 × (T/100)^4
    return 1.01325 * Math.pow(tempC / 100, 4);
  }),
  getBoilingPointElevation: jest.fn((salinity: number, _tempC: number) => {
    // Simple linear: BPE ≈ salinity/35000 × 0.5°C
    return (salinity / 35000) * 0.5;
  }),
  getSeawaterDensity: jest.fn((_salinity: number, _tempC: number) => 1025),
  getSeawaterViscosity: jest.fn((_salinity: number, _tempC: number) => 0.0005),
  getDensityLiquid: jest.fn((_tempC: number) => 980),
  mbarAbsToBar: jest.fn((mbar: number) => mbar / 1000),
}));

// Mock pipeService — need both selectPipeByVelocity and getPipeByNPS
const mockPipes: Record<
  string,
  {
    nps: string;
    dn: string;
    schedule: string;
    od_mm: number;
    wt_mm: number;
    id_mm: number;
    area_mm2: number;
    weight_kgm: number;
  }
> = {
  '2': {
    nps: '2',
    dn: '50',
    schedule: '40',
    od_mm: 60.33,
    wt_mm: 3.91,
    id_mm: 52.51,
    area_mm2: 2165.2,
    weight_kgm: 5.43,
  },
  '3': {
    nps: '3',
    dn: '80',
    schedule: '40',
    od_mm: 88.9,
    wt_mm: 5.49,
    id_mm: 77.92,
    area_mm2: 4768.3,
    weight_kgm: 11.28,
  },
  '4': {
    nps: '4',
    dn: '100',
    schedule: '40',
    od_mm: 114.3,
    wt_mm: 6.02,
    id_mm: 102.26,
    area_mm2: 8213.0,
    weight_kgm: 16.07,
  },
  '6': {
    nps: '6',
    dn: '150',
    schedule: '40',
    od_mm: 168.28,
    wt_mm: 7.11,
    id_mm: 154.06,
    area_mm2: 18638.5,
    weight_kgm: 28.26,
  },
  '8': {
    nps: '8',
    dn: '200',
    schedule: '40',
    od_mm: 219.08,
    wt_mm: 8.18,
    id_mm: 202.72,
    area_mm2: 32280.3,
    weight_kgm: 42.55,
  },
  '10': {
    nps: '10',
    dn: '250',
    schedule: '40',
    od_mm: 273.05,
    wt_mm: 9.27,
    id_mm: 254.51,
    area_mm2: 50870.6,
    weight_kgm: 60.29,
  },
  '12': {
    nps: '12',
    dn: '300',
    schedule: '40',
    od_mm: 323.85,
    wt_mm: 10.31,
    id_mm: 303.23,
    area_mm2: 72183.4,
    weight_kgm: 79.7,
  },
  '14': {
    nps: '14',
    dn: '350',
    schedule: '40',
    od_mm: 355.6,
    wt_mm: 11.13,
    id_mm: 333.34,
    area_mm2: 87280.0,
    weight_kgm: 94.53,
  },
  '16': {
    nps: '16',
    dn: '400',
    schedule: '40',
    od_mm: 406.4,
    wt_mm: 12.7,
    id_mm: 381.0,
    area_mm2: 114010.0,
    weight_kgm: 123.3,
  },
  '20': {
    nps: '20',
    dn: '500',
    schedule: '40',
    od_mm: 508.0,
    wt_mm: 15.09,
    id_mm: 477.82,
    area_mm2: 179370.0,
    weight_kgm: 183.42,
  },
};

const pipeArray = Object.values(mockPipes).sort((a, b) => a.area_mm2 - b.area_mm2);

jest.mock('./pipeService', () => ({
  selectPipeByVelocity: jest.fn(
    (
      volumetricFlow: number,
      targetVelocity: number,
      velocityLimits: { min: number; max: number }
    ) => {
      const requiredAreaM2 = volumetricFlow / targetVelocity;
      const requiredAreaMm2 = requiredAreaM2 * 1e6;
      const selected =
        pipeArray.find((p) => p.area_mm2 >= requiredAreaMm2) ?? pipeArray[pipeArray.length - 1]!;
      const actualVelocity = volumetricFlow / (selected.area_mm2 / 1e6);
      let velocityStatus: 'OK' | 'HIGH' | 'LOW' = 'OK';
      if (actualVelocity > velocityLimits.max) velocityStatus = 'HIGH';
      else if (actualVelocity < velocityLimits.min) velocityStatus = 'LOW';
      return {
        ...selected,
        displayName: `${selected.nps}" Sch 40`,
        isExactMatch: false,
        actualVelocity,
        velocityStatus,
      };
    }
  ),
  getPipeByNPS: jest.fn((nps: string) => mockPipes[nps] ?? null),
}));

// Mock pressureDropCalculator — return fresh mutable objects per call
jest.mock('./pressureDropCalculator', () => {
  const actual = jest.requireActual('./pressureDropCalculator');
  return {
    ...actual,
    calculatePressureDrop: jest.fn(
      (input: { pipeLength: number; fittings?: Array<{ type: string; count: number }> }) => {
        const pipeLoss = input.pipeLength * 0.005;
        // Sum K-factors from fittings
        let fittingsLoss = 0;
        const breakdown: Array<{ type: string; count: number; kFactor: number; loss: number }> = [];
        if (input.fittings) {
          for (const f of input.fittings) {
            const k = actual.K_FACTORS[f.type] ?? 1.0;
            const loss = k * f.count * 0.05; // velocity head ~0.05m at ~1 m/s
            fittingsLoss += loss;
            breakdown.push({ type: f.type, count: f.count, kFactor: k, loss });
          }
        }
        const total = pipeLoss + fittingsLoss;
        return {
          velocity: 1.2,
          reynoldsNumber: 50000,
          flowRegime: 'turbulent' as const,
          frictionFactor: 0.02,
          straightPipeLoss: pipeLoss,
          fittingsLoss,
          fittingsBreakdown: breakdown,
          totalKFactor: 3.0,
          equivalentLength: 10,
          elevationHead: 0,
          totalPressureDropMH2O: total,
          totalPressureDropBar: total * 0.0981,
          totalPressureDropMbar: total * 98.1,
          totalPressureDropKPa: total * 9.81,
          pipe: mockPipes['4'],
          warnings: [],
        };
      }
    ),
  };
});

// ============================================================================
// Tests
// ============================================================================

describe('Suction System Calculator', () => {
  const baseInput: SuctionSystemInput = {
    effectPressure: 300, // 300 mbar abs (typical MED last effect)
    fluidType: 'brine',
    salinity: 45000,
    flowRate: 100, // ton/hr
    nozzleVelocityTarget: 0.08,
    suctionVelocityTarget: 1.2,
    elbowCount: 1,
    verticalPipeRun: 3,
    horizontalPipeRun: 2,
    minColumnHeight: 0.5,
    residenceTime: 30,
    pumpNPSHr: 2,
    safetyMargin: 0.5,
    mode: 'find_elevation',
  };

  // ===========================================================================
  // parseNPSToNumber
  // ===========================================================================
  describe('parseNPSToNumber', () => {
    it('should parse integer NPS', () => {
      expect(parseNPSToNumber('4')).toBe(4);
      expect(parseNPSToNumber('10')).toBe(10);
    });

    it('should parse fractional NPS', () => {
      expect(parseNPSToNumber('1/2')).toBe(0.5);
      expect(parseNPSToNumber('3/4')).toBe(0.75);
    });

    it('should parse mixed NPS', () => {
      expect(parseNPSToNumber('1-1/4')).toBe(1.25);
      expect(parseNPSToNumber('1-1/2')).toBe(1.5);
      expect(parseNPSToNumber('2-1/2')).toBe(2.5);
    });
  });

  // ===========================================================================
  // Validation
  // ===========================================================================
  describe('validateSuctionSystemInput', () => {
    it('should return no errors for valid input', () => {
      const errors = validateSuctionSystemInput(baseInput);
      expect(errors).toHaveLength(0);
    });

    it('should reject zero or negative effect pressure', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, effectPressure: 0 });
      expect(errors.some((e) => e.includes('Effect pressure must be positive'))).toBe(true);
    });

    it('should reject effect pressure above atmospheric', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, effectPressure: 1100 });
      expect(errors.some((e) => e.includes('under vacuum'))).toBe(true);
    });

    it('should reject invalid salinity for brine', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, salinity: 150000 });
      expect(errors.some((e) => e.includes('Salinity'))).toBe(true);
    });

    it('should accept any salinity for distillate', () => {
      const errors = validateSuctionSystemInput({
        ...baseInput,
        fluidType: 'distillate',
        salinity: 999999, // Ignored for distillate
      });
      expect(errors.filter((e) => e.includes('Salinity'))).toHaveLength(0);
    });

    it('should reject zero flow rate', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, flowRate: 0 });
      expect(errors.some((e) => e.includes('Flow rate must be positive'))).toBe(true);
    });

    it('should reject nozzle velocity out of range', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, nozzleVelocityTarget: 0.5 });
      expect(errors.some((e) => e.includes('Nozzle velocity target'))).toBe(true);
    });

    it('should reject suction velocity out of range', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, suctionVelocityTarget: 3.0 });
      expect(errors.some((e) => e.includes('Suction velocity target'))).toBe(true);
    });

    it('should reject negative elbow count', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, elbowCount: -1 });
      expect(errors.some((e) => e.includes('Elbow count'))).toBe(true);
    });

    it('should reject zero min column height', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, minColumnHeight: 0 });
      expect(errors.some((e) => e.includes('Minimum column height'))).toBe(true);
    });

    it('should reject zero residence time', () => {
      const errors = validateSuctionSystemInput({ ...baseInput, residenceTime: 0 });
      expect(errors.some((e) => e.includes('Residence time'))).toBe(true);
    });

    it('should require userElevation in verify mode', () => {
      const errors = validateSuctionSystemInput({
        ...baseInput,
        mode: 'verify_elevation',
      });
      expect(errors.some((e) => e.includes('User elevation'))).toBe(true);
    });

    it('should accept valid verify mode with elevation', () => {
      const errors = validateSuctionSystemInput({
        ...baseInput,
        mode: 'verify_elevation',
        userElevation: 5.0,
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Fluid Properties
  // ===========================================================================
  describe('Fluid property derivation', () => {
    it('should derive temperature from pressure for brine', () => {
      const result = calculateSuctionSystem(baseInput);
      // 300 mbar = 0.3 bar → Tsat from mock ≈ 73.5°C
      expect(result.saturationTemperature).toBeGreaterThan(0);
      // BPE for 45000 ppm ≈ 0.64°C from mock
      expect(result.boilingPointElevation).toBeGreaterThan(0);
      expect(result.fluidTemperature).toBe(
        result.saturationTemperature + result.boilingPointElevation
      );
    });

    it('should have zero BPE for distillate', () => {
      const result = calculateSuctionSystem({
        ...baseInput,
        fluidType: 'distillate',
      });
      expect(result.boilingPointElevation).toBe(0);
      expect(result.fluidTemperature).toBe(result.saturationTemperature);
    });

    it('should use seawater density for brine', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.fluidDensity).toBe(1025); // mocked getSeawaterDensity
    });

    it('should use pure water density for distillate', () => {
      const result = calculateSuctionSystem({
        ...baseInput,
        fluidType: 'distillate',
      });
      expect(result.fluidDensity).toBe(980); // mocked getDensityLiquid
    });
  });

  // ===========================================================================
  // Pipe Sizing
  // ===========================================================================
  describe('Pipe sizing', () => {
    it('should select a larger nozzle pipe than suction pipe', () => {
      const result = calculateSuctionSystem(baseInput);
      const nozzleNPS = parseNPSToNumber(result.nozzlePipe.nps);
      const suctionNPS = parseNPSToNumber(result.suctionPipe.nps);
      expect(nozzleNPS).toBeGreaterThan(suctionNPS);
    });

    it('should report nozzle velocity < suction velocity', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.nozzleVelocity).toBeLessThan(result.suctionVelocity);
    });

    it('should select different pipes for different velocity targets', () => {
      const result1 = calculateSuctionSystem({ ...baseInput, suctionVelocityTarget: 1.0 });
      const result2 = calculateSuctionSystem({ ...baseInput, suctionVelocityTarget: 1.5 });
      // Faster velocity → smaller pipe (or same with different actual velocity)
      expect(result2.suctionPipe.area_mm2).toBeLessThanOrEqual(result1.suctionPipe.area_mm2);
    });
  });

  // ===========================================================================
  // Fitting Auto-Selection
  // ===========================================================================
  describe('Fitting auto-selection', () => {
    it('should auto-select gate valve for NPS >= 4', () => {
      // Default flow rate with suction velocity 1.2 should give NPS 4+
      const result = calculateSuctionSystem(baseInput);
      const suctionNPS = parseNPSToNumber(result.suctionPipe.nps);
      if (suctionNPS >= 4) {
        expect(result.valveType).toBe('gate');
      } else {
        expect(result.valveType).toBe('ball');
      }
    });

    it('should auto-select bucket strainer for NPS >= 4', () => {
      const result = calculateSuctionSystem(baseInput);
      const suctionNPS = parseNPSToNumber(result.suctionPipe.nps);
      if (suctionNPS >= 4) {
        expect(result.strainerType).toBe('bucket_type');
      } else {
        expect(result.strainerType).toBe('y_type');
      }
    });

    it('should include TEE, elbow, and valve in fittings list', () => {
      const result = calculateSuctionSystem(baseInput);
      const fittingNames = result.fittings.map((f) => f.name);
      // Should have reducer, TEE, elbow, and valve
      expect(fittingNames.some((n) => n.includes('Reducer'))).toBe(true);
      expect(fittingNames.some((n) => n.includes('Tee'))).toBe(true);
      expect(fittingNames.some((n) => n.includes('Elbow'))).toBe(true);
      expect(fittingNames.some((n) => n.includes('Gate Valve') || n.includes('Ball Valve'))).toBe(
        true
      );
    });

    it('should include correct elbow count in fittings', () => {
      const result = calculateSuctionSystem({ ...baseInput, elbowCount: 3 });
      const elbowFitting = result.fittings.find((f) => f.name.includes('Elbow'));
      expect(elbowFitting?.count).toBe(3);
    });

    it('should omit elbows when count is 0', () => {
      const result = calculateSuctionSystem({ ...baseInput, elbowCount: 0 });
      const elbowFitting = result.fittings.find((f) => f.name.includes('Elbow'));
      expect(elbowFitting).toBeUndefined();
    });
  });

  // ===========================================================================
  // Reducer
  // ===========================================================================
  describe('Reducer K-factor', () => {
    it('should compute beta ratio from nozzle and suction pipe IDs', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.reducer.beta).toBeGreaterThan(0);
      expect(result.reducer.beta).toBeLessThan(1);
    });

    it('should compute K-factor using Crane TP-410 formula', () => {
      const result = calculateSuctionSystem(baseInput);
      const beta = result.reducer.beta;
      const expectedK = 0.5 * Math.pow(1 - beta * beta, 2);
      expect(result.reducer.kFactor).toBeCloseTo(expectedK, 6);
    });

    it('should include reducer loss in the pressure drop', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.reducer.loss).toBeGreaterThan(0);
      // Reducer loss should be in the fittings detail
      const reducerFitting = result.fittings.find((f) => f.name.includes('Reducer'));
      expect(reducerFitting).toBeDefined();
      expect(reducerFitting!.loss).toBe(result.reducer.loss);
    });
  });

  // ===========================================================================
  // Holdup Volume
  // ===========================================================================
  describe('Holdup volume', () => {
    it('should use nozzle pipe when holdupPipeDiameter is not specified', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.holdup.holdupPipeNPS).toBe(result.nozzlePipe.nps);
    });

    it('should use specified holdupPipeDiameter when provided', () => {
      const result = calculateSuctionSystem({
        ...baseInput,
        holdupPipeDiameter: '8',
      });
      expect(result.holdup.holdupPipeNPS).toBe('8');
    });

    it('should calculate height from residence time', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.holdup.heightFromResidenceTime).toBeGreaterThan(0);
    });

    it('should take max of residence time and min column height', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.holdup.governingHeight).toBe(
        Math.max(result.holdup.heightFromResidenceTime, result.holdup.heightFromMinColumn)
      );
    });

    it('should identify governing constraint correctly', () => {
      // With high residence time, it should govern
      const result = calculateSuctionSystem({
        ...baseInput,
        residenceTime: 120,
        minColumnHeight: 0.1,
      });
      expect(result.holdup.governingConstraint).toBe('residence_time');

      // With high min column, it should govern
      const result2 = calculateSuctionSystem({
        ...baseInput,
        residenceTime: 1,
        minColumnHeight: 5.0,
      });
      expect(result2.holdup.governingConstraint).toBe('min_column_height');
    });

    it('should calculate holdup volume in litres', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.holdup.holdupVolume).toBeGreaterThan(0);
    });

    it('should calculate actual residence time', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.holdup.actualResidenceTime).toBeGreaterThanOrEqual(baseInput.residenceTime);
    });
  });

  // ===========================================================================
  // Pressure Drop
  // ===========================================================================
  describe('Pressure drop', () => {
    it('should calculate clean and dirty strainer conditions', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.pressureDropClean.totalPressureDropMH2O).toBeGreaterThan(0);
      expect(result.pressureDropDirty.totalPressureDropMH2O).toBeGreaterThan(0);
    });

    it('should have higher friction with dirty strainer', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.pressureDropDirty.totalPressureDropMH2O).toBeGreaterThan(
        result.pressureDropClean.totalPressureDropMH2O
      );
    });

    it('should report strainer pressure drop in mbar', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.strainerPressureDrop.cleanLossMbar).toBeGreaterThan(0);
      expect(result.strainerPressureDrop.dirtyLossMbar).toBeGreaterThan(0);
      expect(result.strainerPressureDrop.dirtyLossMbar).toBeGreaterThan(
        result.strainerPressureDrop.cleanLossMbar
      );
    });

    it('should auto-select correct strainer type', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(['y_type', 'bucket_type']).toContain(result.strainerPressureDrop.strainerType);
      expect(result.strainerPressureDrop.strainerType).toBe(result.strainerType);
    });
  });

  // ===========================================================================
  // NPSHa Calculation
  // ===========================================================================
  describe('NPSHa calculation', () => {
    it('should compute NPSHa = Hs + Hp - Hvp - Hf', () => {
      const result = calculateSuctionSystem(baseInput);
      const clean = result.npshaClean;
      const expected =
        clean.staticHead + clean.pressureHead - clean.vaporPressureHead - clean.frictionLoss;
      expect(clean.npsha).toBeCloseTo(expected, 6);
    });

    it('should have clean NPSHa >= dirty NPSHa', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.npshaClean.npsha).toBeGreaterThanOrEqual(result.npshaDirty.npsha);
    });

    it('should calculate margin correctly', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.npshaClean.margin).toBeCloseTo(
        result.npshaClean.npsha - baseInput.pumpNPSHr,
        6
      );
    });

    it('should mark as adequate when margin >= safety margin', () => {
      const result = calculateSuctionSystem(baseInput);
      // In find_elevation mode, dirty strainer NPSHa should be exactly adequate
      // (elevation is calculated to satisfy this)
      expect(result.npshaDirty.isAdequate).toBe(true);
    });
  });

  // ===========================================================================
  // Required Elevation
  // ===========================================================================
  describe('Required elevation (find mode)', () => {
    it('should calculate positive required elevation', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.requiredElevation).toBeGreaterThan(0);
    });

    it('should provide elevation breakdown', () => {
      const result = calculateSuctionSystem(baseInput);
      expect(result.elevationBreakdown.holdupHeight).toBe(result.holdup.governingHeight);
      expect(result.elevationBreakdown.total).toBe(result.requiredElevation);
    });

    it('should ensure NPSHa is adequate at required elevation', () => {
      const result = calculateSuctionSystem(baseInput);
      // At the required elevation, dirty strainer NPSHa should be adequate
      expect(result.npshaDirty.isAdequate).toBe(true);
    });

    it('should increase with higher NPSHr', () => {
      const result1 = calculateSuctionSystem({ ...baseInput, pumpNPSHr: 1.0 });
      const result2 = calculateSuctionSystem({ ...baseInput, pumpNPSHr: 4.0 });
      expect(result2.requiredElevation).toBeGreaterThan(result1.requiredElevation);
    });

    it('should increase with higher safety margin', () => {
      const result1 = calculateSuctionSystem({ ...baseInput, safetyMargin: 0.5 });
      const result2 = calculateSuctionSystem({ ...baseInput, safetyMargin: 2.0 });
      expect(result2.requiredElevation).toBeGreaterThan(result1.requiredElevation);
    });
  });

  // ===========================================================================
  // Elevation Verification
  // ===========================================================================
  describe('Elevation verification (verify mode)', () => {
    it('should report adequate for high elevation', () => {
      const result = calculateSuctionSystem({
        ...baseInput,
        mode: 'verify_elevation',
        userElevation: 20.0, // Very generous
      });
      expect(result.elevationAdequate).toBe(true);
      expect(result.userElevation).toBe(20.0);
    });

    it('should report inadequate for insufficient elevation', () => {
      const result = calculateSuctionSystem({
        ...baseInput,
        mode: 'verify_elevation',
        userElevation: 0.1, // Way too low
      });
      expect(result.elevationAdequate).toBe(false);
    });

    it('should use user elevation as static head', () => {
      const elevation = 5.0;
      const result = calculateSuctionSystem({
        ...baseInput,
        mode: 'verify_elevation',
        userElevation: elevation,
      });
      expect(result.npshaClean.staticHead).toBe(elevation);
      expect(result.npshaDirty.staticHead).toBe(elevation);
    });
  });

  // ===========================================================================
  // Warnings
  // ===========================================================================
  describe('Warnings', () => {
    it('should warn on deep vacuum', () => {
      const result = calculateSuctionSystem({ ...baseInput, effectPressure: 40 });
      expect(result.warnings.some((w) => w.includes('Deep vacuum'))).toBe(true);
    });

    it('should warn when NPSHa margin is insufficient', () => {
      const result = calculateSuctionSystem({
        ...baseInput,
        mode: 'verify_elevation',
        userElevation: 0.1,
      });
      expect(
        result.warnings.some(
          (w) => w.includes('less than NPSHr') || w.includes('negative') || w.includes('margin')
        )
      ).toBe(true);
    });
  });

  // ===========================================================================
  // Integration
  // ===========================================================================
  describe('Integration — typical MED last effect', () => {
    it('should produce a complete result with all fields', () => {
      const result = calculateSuctionSystem(baseInput);

      // Fluid properties
      expect(result.saturationTemperature).toBeGreaterThan(0);
      expect(result.fluidDensity).toBeGreaterThan(900);
      expect(result.fluidViscosity).toBeGreaterThan(0);
      expect(result.vaporPressure).toBeGreaterThan(0);

      // Pipe sizing
      expect(result.nozzlePipe.nps).toBeTruthy();
      expect(result.suctionPipe.nps).toBeTruthy();
      expect(result.nozzleVelocity).toBeGreaterThan(0);
      expect(result.suctionVelocity).toBeGreaterThan(0);

      // Fittings
      expect(result.fittings.length).toBeGreaterThan(0);
      expect(result.reducer.beta).toBeGreaterThan(0);

      // Holdup
      expect(result.holdup.holdupVolume).toBeGreaterThan(0);
      expect(result.holdup.governingHeight).toBeGreaterThan(0);

      // NPSHa
      expect(result.npshaClean.npsha).toBeDefined();
      expect(result.npshaDirty.npsha).toBeDefined();

      // Elevation
      expect(result.requiredElevation).toBeGreaterThan(0);
    });

    it('should throw for invalid input', () => {
      expect(() => calculateSuctionSystem({ ...baseInput, effectPressure: -100 })).toThrow();
    });
  });
});

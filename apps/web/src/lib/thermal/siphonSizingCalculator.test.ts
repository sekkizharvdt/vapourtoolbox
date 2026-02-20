/**
 * Siphon Sizing Calculator Tests
 *
 * Tests for inter-effect siphon pipe sizing calculations.
 */

import {
  calculateSiphonSizing,
  validateSiphonInput,
  type SiphonSizingInput,
} from './siphonSizingCalculator';

// Mock pipeService
jest.mock('./pipeService', () => ({
  selectPipeByVelocity: jest.fn(
    (
      volumetricFlow: number,
      _targetVelocity: number,
      velocityLimits: { min: number; max: number }
    ) => {
      // Simulate pipe selection: pick pipe based on flow area at target velocity
      const targetArea = volumetricFlow / 1.0; // target 1 m/s
      const pipes = [
        {
          nps: '2',
          dn: '50',
          schedule: '40',
          od_mm: 60.33,
          wt_mm: 3.91,
          id_mm: 52.51,
          area_mm2: 2165.2,
          weight_kgm: 5.43,
        },
        {
          nps: '3',
          dn: '80',
          schedule: '40',
          od_mm: 88.9,
          wt_mm: 5.49,
          id_mm: 77.92,
          area_mm2: 4768.3,
          weight_kgm: 11.28,
        },
        {
          nps: '4',
          dn: '100',
          schedule: '40',
          od_mm: 114.3,
          wt_mm: 6.02,
          id_mm: 102.26,
          area_mm2: 8213.0,
          weight_kgm: 16.07,
        },
        {
          nps: '6',
          dn: '150',
          schedule: '40',
          od_mm: 168.28,
          wt_mm: 7.11,
          id_mm: 154.06,
          area_mm2: 18638.5,
          weight_kgm: 28.26,
        },
        {
          nps: '8',
          dn: '200',
          schedule: '40',
          od_mm: 219.08,
          wt_mm: 8.18,
          id_mm: 202.72,
          area_mm2: 32280.3,
          weight_kgm: 42.55,
        },
      ];
      const requiredAreaMm2 = targetArea * 1e6;
      const selected = pipes.find((p) => p.area_mm2 >= requiredAreaMm2) ?? pipes[pipes.length - 1]!;
      const actualVelocity = volumetricFlow / (selected!.area_mm2 / 1e6);
      let velocityStatus: 'OK' | 'HIGH' | 'LOW' = 'OK';
      if (actualVelocity > velocityLimits.max) velocityStatus = 'HIGH';
      else if (actualVelocity < velocityLimits.min) velocityStatus = 'LOW';
      return {
        ...selected!,
        displayName: `${selected!.nps}" Sch 40`,
        isExactMatch: false,
        actualVelocity,
        velocityStatus,
      };
    }
  ),
}));

// Mock pressureDropCalculator — return realistic but predictable values
jest.mock('./pressureDropCalculator', () => ({
  calculatePressureDrop: jest.fn((input: { pipeLength: number }) => ({
    velocity: 1.0,
    reynoldsNumber: 50000,
    flowRegime: 'turbulent' as const,
    frictionFactor: 0.02,
    straightPipeLoss: input.pipeLength * 0.005, // ~5 mm/m head loss
    fittingsLoss: 0.15,
    fittingsBreakdown: [],
    totalKFactor: 3.0,
    equivalentLength: 10,
    elevationHead: 0,
    totalPressureDropMH2O: input.pipeLength * 0.005 + 0.15,
    totalPressureDropBar: (input.pipeLength * 0.005 + 0.15) * 0.0981,
    totalPressureDropMbar: (input.pipeLength * 0.005 + 0.15) * 98.1,
    totalPressureDropKPa: (input.pipeLength * 0.005 + 0.15) * 9.81,
    pipe: {
      nps: '4',
      dn: '100',
      schedule: '40',
      od_mm: 114.3,
      wt_mm: 6.02,
      id_mm: 102.26,
      area_mm2: 8213.0,
      weight_kgm: 16.07,
    },
    warnings: [],
  })),
}));

describe('Siphon Sizing Calculator', () => {
  const baseInput: SiphonSizingInput = {
    upstreamPressure: 300,
    downstreamPressure: 250,
    pressureUnit: 'mbar_abs',
    fluidType: 'seawater',
    fluidTemperature: 65,
    salinity: 35000,
    flowRate: 100,
    elbowConfig: '2_elbows',
    horizontalDistance: 3,
    offsetDistance: 0,
    safetyFactor: 20,
  };

  describe('validateSiphonInput', () => {
    it('should return no errors for valid input', () => {
      const errors = validateSiphonInput(baseInput);
      expect(errors).toHaveLength(0);
    });

    it('should reject upstream pressure <= downstream pressure', () => {
      const errors = validateSiphonInput({
        ...baseInput,
        upstreamPressure: 200,
        downstreamPressure: 250,
      });
      expect(errors).toContain('Upstream pressure must be higher than downstream pressure');
    });

    it('should reject negative flow rate', () => {
      const errors = validateSiphonInput({ ...baseInput, flowRate: -5 });
      expect(errors).toContain('Flow rate must be positive');
    });

    it('should reject safety factor below 20%', () => {
      const errors = validateSiphonInput({ ...baseInput, safetyFactor: 10 });
      expect(errors).toContain('Safety factor must be at least 20%');
    });

    it('should reject missing offset distance for 3-elbow config', () => {
      const errors = validateSiphonInput({
        ...baseInput,
        elbowConfig: '3_elbows',
        offsetDistance: 0,
      });
      expect(errors).toContain('Offset distance must be positive for 3-elbow configuration');
    });

    it('should accept valid 3-elbow config', () => {
      const errors = validateSiphonInput({
        ...baseInput,
        elbowConfig: '3_elbows',
        offsetDistance: 1.5,
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('calculateSiphonSizing', () => {
    it('should calculate siphon sizing for seawater between effects', () => {
      const result = calculateSiphonSizing(baseInput);

      // Pipe should be selected
      expect(result.pipe).toBeDefined();
      expect(result.pipe.nps).toBeDefined();

      // Velocity should be in range
      expect(result.velocity).toBeGreaterThan(0);

      // Static head should be positive (upstream > downstream)
      expect(result.staticHead).toBeGreaterThan(0);

      // Minimum height should be greater than static head (includes friction + safety)
      expect(result.minimumHeight).toBeGreaterThan(result.staticHead);

      // Pressure difference
      expect(result.pressureDiffBar).toBeCloseTo(0.05, 3);
    });

    it('should produce higher minimum height for larger pressure differences', () => {
      const smallDeltaP = calculateSiphonSizing(baseInput);
      const largeDeltaP = calculateSiphonSizing({
        ...baseInput,
        upstreamPressure: 400,
        downstreamPressure: 200,
      });

      expect(largeDeltaP.minimumHeight).toBeGreaterThan(smallDeltaP.minimumHeight);
      expect(largeDeltaP.staticHead).toBeGreaterThan(smallDeltaP.staticHead);
    });

    it('should handle distillate with no flash when subcooled', () => {
      const result = calculateSiphonSizing({
        ...baseInput,
        fluidType: 'distillate',
        salinity: 0,
        fluidTemperature: 40, // Well below sat temp at 250 mbar (~65°C)
      });

      expect(result.flashOccurs).toBe(false);
      expect(result.flashVaporFraction).toBe(0);
      expect(result.flashVaporFlow).toBe(0);
      expect(result.liquidFlowAfterFlash).toBe(100);
    });

    it('should calculate flash vapor when fluid is superheated relative to downstream', () => {
      const result = calculateSiphonSizing({
        ...baseInput,
        fluidType: 'distillate',
        salinity: 0,
        fluidTemperature: 80, // Above sat temp at 250 mbar (~65°C)
        downstreamPressure: 250,
      });

      expect(result.flashOccurs).toBe(true);
      expect(result.flashVaporFraction).toBeGreaterThan(0);
      expect(result.flashVaporFraction).toBeLessThan(1);
      expect(result.flashVaporFlow).toBeGreaterThan(0);
      expect(result.liquidFlowAfterFlash).toBeLessThan(100);
      expect(result.flashVaporFlow + result.liquidFlowAfterFlash).toBeCloseTo(100, 1);
    });

    it('should handle 3-elbow configuration', () => {
      const twoElbow = calculateSiphonSizing(baseInput);
      const threeElbow = calculateSiphonSizing({
        ...baseInput,
        elbowConfig: '3_elbows',
        offsetDistance: 2,
      });

      expect(threeElbow.elbowCount).toBe(3);
      expect(twoElbow.elbowCount).toBe(2);
      // 3-elbow config has longer pipe and more fittings → more friction
      expect(threeElbow.totalPipeLength).toBeGreaterThan(twoElbow.totalPipeLength);
    });

    it('should apply safety factor correctly', () => {
      const result20 = calculateSiphonSizing({ ...baseInput, safetyFactor: 20 });
      const result30 = calculateSiphonSizing({ ...baseInput, safetyFactor: 30 });

      expect(result30.minimumHeight).toBeGreaterThan(result20.minimumHeight);
      expect(result30.safetyMargin).toBeGreaterThan(result20.safetyMargin);
    });

    it('should support different pressure units', () => {
      // 300 mbar = 0.3 bar = 30 kPa
      const mbarResult = calculateSiphonSizing(baseInput);
      const barResult = calculateSiphonSizing({
        ...baseInput,
        upstreamPressure: 0.3,
        downstreamPressure: 0.25,
        pressureUnit: 'bar_abs',
      });
      const kpaResult = calculateSiphonSizing({
        ...baseInput,
        upstreamPressure: 30,
        downstreamPressure: 25,
        pressureUnit: 'kpa_abs',
      });

      // All should give same static head
      expect(mbarResult.staticHead).toBeCloseTo(barResult.staticHead, 1);
      expect(mbarResult.staticHead).toBeCloseTo(kpaResult.staticHead, 1);
    });

    it('should warn on high flash vapor fraction', () => {
      const result = calculateSiphonSizing({
        ...baseInput,
        fluidType: 'distillate',
        salinity: 0,
        fluidTemperature: 100, // High temp → significant flash at 250 mbar
        downstreamPressure: 100, // Very low downstream pressure
      });

      if (result.flashVaporFraction > 0.05) {
        expect(result.warnings.some((w) => w.includes('flash vapor fraction'))).toBe(true);
      }
    });

    it('should throw on invalid input', () => {
      expect(() =>
        calculateSiphonSizing({
          ...baseInput,
          upstreamPressure: 200,
          downstreamPressure: 300,
        })
      ).toThrow();
    });
  });
});

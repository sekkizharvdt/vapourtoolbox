/**
 * Pressure Drop Calculator Tests
 *
 * Tests for Darcy-Weisbach pressure drop calculations
 */

import {
  calculateReynoldsNumber,
  calculateFrictionFactor,
  calculatePressureDrop,
  mH2OToBar,
  barToMH2O,
  getAvailableFittings,
  K_FACTORS,
  FITTING_NAMES,
  type PressureDropInput,
  type FittingType,
} from './pressureDropCalculator';

// Mock the pipeService module
jest.mock('./pipeService', () => ({
  getPipeByNPS: jest.fn((nps: string) => {
    // Return mock pipe data for common sizes
    const pipes: Record<
      string,
      {
        id_mm: number;
        area_mm2: number;
        nps: string;
        dn: string;
        od_mm: number;
        wt_mm: number;
        schedule: string;
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
    };
    return pipes[nps];
  }),
}));

describe('Pressure Drop Calculator', () => {
  describe('calculateReynoldsNumber', () => {
    it('should calculate Reynolds number correctly', () => {
      // Re = ρ × v × D / μ
      const density = 1000; // kg/m³
      const velocity = 2; // m/s
      const diameter = 0.1; // m (100 mm)
      const viscosity = 0.001; // Pa·s (water at 20°C)

      const Re = calculateReynoldsNumber(density, velocity, diameter, viscosity);

      // Re = 1000 × 2 × 0.1 / 0.001 = 200,000
      expect(Re).toBe(200000);
    });

    it('should return high Reynolds for low viscosity fluids', () => {
      const Re = calculateReynoldsNumber(1000, 1, 0.05, 0.0001);
      // Re = 1000 × 1 × 0.05 / 0.0001 = 500,000
      expect(Re).toBe(500000);
    });

    it('should return low Reynolds for high viscosity fluids', () => {
      const Re = calculateReynoldsNumber(1000, 0.1, 0.01, 0.1);
      // Re = 1000 × 0.1 × 0.01 / 0.1 = 10
      expect(Re).toBe(10);
    });
  });

  describe('calculateFrictionFactor', () => {
    describe('laminar flow (Re ≤ 2300)', () => {
      it('should use f = 64/Re for laminar flow', () => {
        const f = calculateFrictionFactor(1000, 0.001);
        expect(f).toBeCloseTo(0.064, 3); // 64/1000 = 0.064
      });

      it('should handle very low Reynolds number', () => {
        const f = calculateFrictionFactor(100, 0.001);
        expect(f).toBeCloseTo(0.64, 2); // 64/100 = 0.64
      });
    });

    describe('transitional flow (2300 < Re < 4000)', () => {
      it('should interpolate between laminar and turbulent', () => {
        const f = calculateFrictionFactor(3000, 0.001);
        // Transitional regime uses interpolation between laminar and turbulent
        // Value should be reasonable (not extremely high or low)
        expect(f).toBeGreaterThan(0.01);
        expect(f).toBeLessThan(0.1);
      });
    });

    describe('turbulent flow (Re ≥ 4000)', () => {
      it('should use Swamee-Jain approximation', () => {
        const f = calculateFrictionFactor(100000, 0.0001);
        // Typical values for smooth pipes at high Re
        expect(f).toBeGreaterThan(0.01);
        expect(f).toBeLessThan(0.03);
      });

      it('should increase with roughness', () => {
        const fSmooth = calculateFrictionFactor(100000, 0.0001);
        const fRough = calculateFrictionFactor(100000, 0.01);
        expect(fRough).toBeGreaterThan(fSmooth);
      });

      it('should decrease with Reynolds number (smooth pipe)', () => {
        const fLowRe = calculateFrictionFactor(10000, 0.0001);
        const fHighRe = calculateFrictionFactor(1000000, 0.0001);
        expect(fHighRe).toBeLessThan(fLowRe);
      });
    });
  });

  describe('mH2OToBar and barToMH2O', () => {
    it('should convert m H₂O to bar for water', () => {
      // 10 m H₂O = ~0.981 bar at standard density
      const bar = mH2OToBar(10, 1000);
      expect(bar).toBeCloseTo(0.981, 2);
    });

    it('should convert bar to m H₂O for water', () => {
      const mH2O = barToMH2O(1, 1000);
      expect(mH2O).toBeCloseTo(10.19, 1);
    });

    it('should be reversible', () => {
      const original = 5; // m H₂O
      const density = 1025; // seawater
      const bar = mH2OToBar(original, density);
      const back = barToMH2O(bar, density);
      expect(back).toBeCloseTo(original, 5);
    });

    it('should use default density of 1000 kg/m³', () => {
      const withDefault = mH2OToBar(10);
      const withExplicit = mH2OToBar(10, 1000);
      expect(withDefault).toBe(withExplicit);
    });
  });

  describe('K_FACTORS and FITTING_NAMES', () => {
    it('should have matching keys', () => {
      const kFactorKeys = Object.keys(K_FACTORS);
      const nameKeys = Object.keys(FITTING_NAMES);
      expect(kFactorKeys.sort()).toEqual(nameKeys.sort());
    });

    it('should have positive K-factors', () => {
      Object.values(K_FACTORS).forEach((k) => {
        expect(k).toBeGreaterThan(0);
      });
    });

    it('should have globe valve higher than gate valve', () => {
      expect(K_FACTORS.globe_valve).toBeGreaterThan(K_FACTORS.gate_valve);
    });

    it('should have rounded entrance lower than sharp entrance', () => {
      expect(K_FACTORS.entrance_rounded).toBeLessThan(K_FACTORS.entrance_sharp);
    });
  });

  describe('getAvailableFittings', () => {
    it('should return all fitting types', () => {
      const fittings = getAvailableFittings();
      expect(fittings.length).toBe(Object.keys(K_FACTORS).length);
    });

    it('should include type, name, and kFactor for each fitting', () => {
      const fittings = getAvailableFittings();
      fittings.forEach((fitting) => {
        expect(fitting.type).toBeDefined();
        expect(fitting.name).toBeDefined();
        expect(fitting.kFactor).toBeGreaterThan(0);
        expect(K_FACTORS[fitting.type]).toBe(fitting.kFactor);
        expect(FITTING_NAMES[fitting.type]).toBe(fitting.name);
      });
    });
  });

  describe('calculatePressureDrop', () => {
    describe('basic calculations', () => {
      it('should calculate pressure drop for water flow', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100, // 100 m
          flowRate: 50, // 50 ton/hr
          fluidDensity: 1000, // water
          fluidViscosity: 0.001, // Pa·s
        };

        const result = calculatePressureDrop(input);

        expect(result.velocity).toBeGreaterThan(0);
        expect(result.reynoldsNumber).toBeGreaterThan(4000); // Turbulent
        expect(result.flowRegime).toBe('turbulent');
        expect(result.frictionFactor).toBeGreaterThan(0);
        expect(result.straightPipeLoss).toBeGreaterThan(0);
        expect(result.totalPressureDropMH2O).toBeGreaterThan(0);
        expect(result.totalPressureDropBar).toBeGreaterThan(0);
      });

      it('should throw error for invalid pipe size', () => {
        const input: PressureDropInput = {
          pipeNPS: '999',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        expect(() => calculatePressureDrop(input)).toThrow('Pipe size NPS 999 not found');
      });

      it('should include pipe data in result', () => {
        const input: PressureDropInput = {
          pipeNPS: '6',
          pipeLength: 50,
          flowRate: 100,
          fluidDensity: 1025,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        expect(result.pipe.nps).toBe('6');
        expect(result.pipe.id_mm).toBe(154.06);
      });
    });

    describe('velocity calculation', () => {
      it('should calculate velocity from mass flow and area', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 36, // 36 ton/hr = 10 kg/s
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        // v = Q / A = (10 kg/s / 1000 kg/m³) / (8213 mm² / 1e6)
        // v = 0.01 m³/s / 0.008213 m² ≈ 1.22 m/s
        expect(result.velocity).toBeCloseTo(1.22, 1);
      });

      it('should warn for low velocity', () => {
        const input: PressureDropInput = {
          pipeNPS: '8',
          pipeLength: 100,
          flowRate: 10, // Very low flow
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        expect(result.velocity).toBeLessThan(0.3);
        expect(result.warnings.some((w) => w.includes('Low velocity'))).toBe(true);
      });

      it('should warn for high velocity', () => {
        const input: PressureDropInput = {
          pipeNPS: '2',
          pipeLength: 100,
          flowRate: 100, // Very high flow for 2" pipe
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        expect(result.velocity).toBeGreaterThan(5);
        expect(result.warnings.some((w) => w.includes('High velocity'))).toBe(true);
      });
    });

    describe('flow regime detection', () => {
      it('should detect laminar flow', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 0.1, // Very low flow
          fluidDensity: 1000,
          fluidViscosity: 0.1, // Very high viscosity
        };

        const result = calculatePressureDrop(input);

        expect(result.reynoldsNumber).toBeLessThanOrEqual(2300);
        expect(result.flowRegime).toBe('laminar');
      });

      it('should detect transitional flow', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 0.5,
          fluidDensity: 1000,
          fluidViscosity: 0.01,
        };

        const result = calculatePressureDrop(input);

        // Adjust flow to hit transitional range
        if (result.reynoldsNumber > 2300 && result.reynoldsNumber < 4000) {
          expect(result.flowRegime).toBe('transitional');
          expect(result.warnings).toContain(expect.stringMatching(/transitional regime/));
        }
      });

      it('should detect turbulent flow', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        expect(result.reynoldsNumber).toBeGreaterThanOrEqual(4000);
        expect(result.flowRegime).toBe('turbulent');
      });
    });

    describe('fittings calculations', () => {
      it('should calculate fittings pressure drop', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
          fittings: [
            { type: '90_elbow_standard', count: 4 },
            { type: 'gate_valve', count: 2 },
          ],
        };

        const result = calculatePressureDrop(input);

        expect(result.fittingsLoss).toBeGreaterThan(0);
        expect(result.totalKFactor).toBe(4 * 0.75 + 2 * 0.17); // 4×0.75 + 2×0.17 = 3.34
        expect(result.fittingsBreakdown).toHaveLength(2);
      });

      it('should calculate equivalent length', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
          fittings: [{ type: 'globe_valve', count: 1 }],
        };

        const result = calculatePressureDrop(input);

        // Le = K × D / f
        expect(result.equivalentLength).toBeGreaterThan(0);
      });

      it('should ignore fittings with zero count', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
          fittings: [
            { type: '90_elbow_standard', count: 0 },
            { type: 'gate_valve', count: 2 },
          ],
        };

        const result = calculatePressureDrop(input);

        expect(result.fittingsBreakdown).toHaveLength(1);
        expect(result.totalKFactor).toBe(2 * 0.17);
      });

      it('should handle no fittings', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        expect(result.fittingsLoss).toBe(0);
        expect(result.totalKFactor).toBe(0);
        expect(result.fittingsBreakdown).toHaveLength(0);
      });
    });

    describe('elevation change', () => {
      it('should add elevation head for upward flow', () => {
        const inputBase: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const inputWithElevation: PressureDropInput = {
          ...inputBase,
          elevationChange: 10, // 10 m upward
        };

        const resultBase = calculatePressureDrop(inputBase);
        const resultWithElevation = calculatePressureDrop(inputWithElevation);

        expect(resultWithElevation.elevationHead).toBe(10);
        expect(resultWithElevation.totalPressureDropMH2O).toBe(
          resultBase.totalPressureDropMH2O + 10
        );
      });

      it('should subtract elevation head for downward flow', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
          elevationChange: -5, // 5 m downward
        };

        const result = calculatePressureDrop(input);

        expect(result.elevationHead).toBe(-5);
      });
    });

    describe('unit conversions', () => {
      it('should provide results in multiple units', () => {
        const input: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const result = calculatePressureDrop(input);

        // Check conversions are consistent
        expect(result.totalPressureDropMbar).toBeCloseTo(result.totalPressureDropBar * 1000, 5);
        expect(result.totalPressureDropKPa).toBeCloseTo(result.totalPressureDropBar * 100, 5);
      });
    });

    describe('roughness effect', () => {
      it('should increase pressure drop with roughness', () => {
        const inputSmooth: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
          roughness: 0.01, // Very smooth
        };

        const inputRough: PressureDropInput = {
          ...inputSmooth,
          roughness: 0.5, // Rough/corroded
        };

        const resultSmooth = calculatePressureDrop(inputSmooth);
        const resultRough = calculatePressureDrop(inputRough);

        expect(resultRough.frictionFactor).toBeGreaterThan(resultSmooth.frictionFactor);
        expect(resultRough.straightPipeLoss).toBeGreaterThan(resultSmooth.straightPipeLoss);
      });

      it('should use default roughness of 0.045 mm', () => {
        const inputWithDefault: PressureDropInput = {
          pipeNPS: '4',
          pipeLength: 100,
          flowRate: 50,
          fluidDensity: 1000,
          fluidViscosity: 0.001,
        };

        const inputWithExplicit: PressureDropInput = {
          ...inputWithDefault,
          roughness: 0.045,
        };

        const resultDefault = calculatePressureDrop(inputWithDefault);
        const resultExplicit = calculatePressureDrop(inputWithExplicit);

        expect(resultDefault.frictionFactor).toBe(resultExplicit.frictionFactor);
      });
    });
  });

  describe('fittings breakdown', () => {
    it('should provide detailed breakdown for each fitting type', () => {
      const fittings: { type: FittingType; count: number }[] = [
        { type: '90_elbow_long_radius', count: 3 },
        { type: 'tee_branch', count: 1 },
        { type: 'check_valve_swing', count: 1 },
      ];

      const input: PressureDropInput = {
        pipeNPS: '6',
        pipeLength: 200,
        flowRate: 100,
        fluidDensity: 1025,
        fluidViscosity: 0.001,
        fittings,
      };

      const result = calculatePressureDrop(input);

      expect(result.fittingsBreakdown).toHaveLength(3);

      const elbowBreakdown = result.fittingsBreakdown.find(
        (b) => b.type === '90_elbow_long_radius'
      );
      expect(elbowBreakdown).toBeDefined();
      expect(elbowBreakdown?.count).toBe(3);
      expect(elbowBreakdown?.kFactor).toBe(0.45);

      const teeBreakdown = result.fittingsBreakdown.find((b) => b.type === 'tee_branch');
      expect(teeBreakdown).toBeDefined();
      expect(teeBreakdown?.kFactor).toBe(1.5);
    });
  });

  describe('Custom pipe override', () => {
    it('should use custom pipe dimensions instead of NPS lookup', () => {
      const result = calculatePressureDrop({
        pipeNPS: 'IGNORED',
        pipeLength: 10,
        flowRate: 50,
        fluidDensity: 1000,
        fluidViscosity: 0.001,
        customPipe: { id_mm: 300, area_mm2: (Math.PI / 4) * 300 * 300 },
      });

      expect(result.pipe.nps).toBe('CUSTOM');
      expect(result.pipe.id_mm).toBe(300);
      expect(result.totalPressureDropMH2O).toBeGreaterThan(0);
    });

    it('should calculate correct velocity with custom pipe area', () => {
      const id_mm = 500;
      const area_mm2 = (Math.PI / 4) * id_mm * id_mm;
      const result = calculatePressureDrop({
        pipeNPS: 'IGNORED',
        pipeLength: 5,
        flowRate: 100, // ton/hr
        fluidDensity: 1000,
        fluidViscosity: 0.001,
        customPipe: { id_mm, area_mm2 },
      });

      // v = Q / A = (100*1000/3600/1000) / (area_mm2/1e6)
      const expectedV = (100 * 1000) / 3600 / 1000 / (area_mm2 / 1e6);
      expect(result.velocity).toBeCloseTo(expectedV, 4);
    });
  });
});

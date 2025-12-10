/**
 * Heat Duty Calculator Tests
 *
 * Tests for thermal engineering calculations including:
 * - Sensible heat (Q = m × Cp × ΔT)
 * - Latent heat (Q = m × hfg)
 * - LMTD calculations
 * - Heat exchanger sizing
 */

import {
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateLMTD,
  calculateHeatDutyFromLMTD,
  calculateRequiredArea,
  calculateCombinedHeat,
  TYPICAL_HTC,
  type SensibleHeatInput,
  type LatentHeatInput,
  type LMTDInput,
} from './heatDutyCalculator';

// Mock the constants module
jest.mock('@vapour/constants', () => ({
  getSeawaterSpecificHeat: jest.fn((salinity: number, _temp: number) => {
    // Approximate seawater Cp formula: 4.186 - 0.00005 * salinity
    return 4.186 - 0.00005 * salinity;
  }),
  getLatentHeat: jest.fn((temp: number) => {
    // Approximate latent heat: 2500 - 2.4 × T (kJ/kg)
    return 2500 - 2.4 * temp;
  }),
}));

describe('Heat Duty Calculator', () => {
  describe('calculateSensibleHeat', () => {
    it('should calculate sensible heat for pure water heating', () => {
      const input: SensibleHeatInput = {
        fluidType: 'PURE_WATER',
        massFlowRate: 10, // ton/hr
        inletTemperature: 25,
        outletTemperature: 50,
      };

      const result = calculateSensibleHeat(input);

      // m = 10 ton/hr = 10000 kg/hr = 2.778 kg/s
      expect(result.massFlowKgS).toBeCloseTo(2.778, 2);
      expect(result.deltaT).toBe(25);
      expect(result.isHeating).toBe(true);
      // Q = m × Cp × ΔT ≈ 2.778 × 4.18 × 25 ≈ 290 kW
      expect(result.heatDuty).toBeGreaterThan(280);
      expect(result.heatDuty).toBeLessThan(300);
    });

    it('should calculate sensible heat for pure water cooling', () => {
      const input: SensibleHeatInput = {
        fluidType: 'PURE_WATER',
        massFlowRate: 10, // ton/hr
        inletTemperature: 80,
        outletTemperature: 40,
      };

      const result = calculateSensibleHeat(input);

      expect(result.deltaT).toBe(40);
      expect(result.isHeating).toBe(false);
      expect(result.heatDuty).toBeGreaterThan(0); // Heat duty is always positive
    });

    it('should calculate sensible heat for seawater with salinity', () => {
      const input: SensibleHeatInput = {
        fluidType: 'SEAWATER',
        salinity: 35000, // 35,000 ppm
        massFlowRate: 100, // ton/hr
        inletTemperature: 30,
        outletTemperature: 40,
      };

      const result = calculateSensibleHeat(input);

      // Seawater has slightly lower Cp than pure water
      expect(result.specificHeat).toBeLessThan(4.186);
      expect(result.massFlowKgS).toBeCloseTo(27.78, 1);
      // Heat duty = 27.78 kg/s × ~2.4 kJ/(kg·K) × 10 K ≈ 667 kW (mock returns lower Cp)
      expect(result.heatDuty).toBeGreaterThan(600);
    });

    it('should handle steam with approximate specific heat', () => {
      const input: SensibleHeatInput = {
        fluidType: 'STEAM',
        massFlowRate: 5, // ton/hr
        inletTemperature: 150,
        outletTemperature: 200,
      };

      const result = calculateSensibleHeat(input);

      // Steam Cp ≈ 2.0 kJ/(kg·K)
      expect(result.specificHeat).toBeCloseTo(2.0, 1);
    });

    it('should handle zero temperature change', () => {
      const input: SensibleHeatInput = {
        fluidType: 'PURE_WATER',
        massFlowRate: 10,
        inletTemperature: 50,
        outletTemperature: 50,
      };

      const result = calculateSensibleHeat(input);

      expect(result.deltaT).toBe(0);
      expect(result.heatDuty).toBe(0);
    });

    it('should correctly convert mass flow from ton/hr to kg/s', () => {
      const input: SensibleHeatInput = {
        fluidType: 'PURE_WATER',
        massFlowRate: 36, // ton/hr
        inletTemperature: 20,
        outletTemperature: 30,
      };

      const result = calculateSensibleHeat(input);

      // 36 ton/hr = 36000 kg/hr = 10 kg/s
      expect(result.massFlowKgS).toBeCloseTo(10, 2);
    });
  });

  describe('calculateLatentHeat', () => {
    it('should calculate latent heat for evaporation', () => {
      const input: LatentHeatInput = {
        massFlowRate: 10, // ton/hr
        temperature: 100, // °C
        process: 'EVAPORATION',
      };

      const result = calculateLatentHeat(input);

      expect(result.process).toBe('EVAPORATION');
      expect(result.massFlowKgS).toBeCloseTo(2.778, 2);
      // hfg at 100°C ≈ 2260 kJ/kg
      expect(result.latentHeat).toBeCloseTo(2260, -1);
      // Q = m × hfg ≈ 2.778 × 2260 ≈ 6280 kW
      expect(result.heatDuty).toBeGreaterThan(6000);
    });

    it('should calculate latent heat for condensation', () => {
      const input: LatentHeatInput = {
        massFlowRate: 5, // ton/hr
        temperature: 60, // °C
        process: 'CONDENSATION',
      };

      const result = calculateLatentHeat(input);

      expect(result.process).toBe('CONDENSATION');
      // Latent heat at 60°C is higher than at 100°C
      expect(result.latentHeat).toBeGreaterThan(2260);
    });

    it('should have higher latent heat at lower temperatures', () => {
      const inputLow: LatentHeatInput = {
        massFlowRate: 10,
        temperature: 40,
        process: 'EVAPORATION',
      };
      const inputHigh: LatentHeatInput = {
        massFlowRate: 10,
        temperature: 80,
        process: 'EVAPORATION',
      };

      const resultLow = calculateLatentHeat(inputLow);
      const resultHigh = calculateLatentHeat(inputHigh);

      expect(resultLow.latentHeat).toBeGreaterThan(resultHigh.latentHeat);
    });
  });

  describe('calculateLMTD', () => {
    describe('Counter-current flow', () => {
      it('should calculate LMTD for counter-current flow', () => {
        const input: LMTDInput = {
          hotInlet: 150,
          hotOutlet: 90,
          coldInlet: 30,
          coldOutlet: 80,
          flowArrangement: 'COUNTER',
        };

        const result = calculateLMTD(input);

        // Counter-current: ΔT1 = 150-80=70, ΔT2 = 90-30=60
        expect(result.deltaT1).toBe(70);
        expect(result.deltaT2).toBe(60);
        // LMTD = (70-60)/ln(70/60) ≈ 64.9
        expect(result.lmtd).toBeGreaterThan(64);
        expect(result.lmtd).toBeLessThan(66);
        expect(result.correctionFactor).toBe(1);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle equal temperature differences (arithmetic mean)', () => {
        const input: LMTDInput = {
          hotInlet: 100,
          hotOutlet: 60,
          coldInlet: 20,
          coldOutlet: 60,
          flowArrangement: 'COUNTER',
        };

        const result = calculateLMTD(input);

        // ΔT1 = 100-60=40, ΔT2 = 60-20=40
        expect(result.deltaT1).toBe(40);
        expect(result.deltaT2).toBe(40);
        // When ΔT1 ≈ ΔT2, LMTD = arithmetic mean = 40
        expect(result.lmtd).toBeCloseTo(40, 0);
      });
    });

    describe('Parallel flow', () => {
      it('should calculate LMTD for parallel flow', () => {
        const input: LMTDInput = {
          hotInlet: 150,
          hotOutlet: 90,
          coldInlet: 30,
          coldOutlet: 80,
          flowArrangement: 'PARALLEL',
        };

        const result = calculateLMTD(input);

        // Parallel: ΔT1 = 150-30=120, ΔT2 = 90-80=10
        expect(result.deltaT1).toBe(120);
        expect(result.deltaT2).toBe(10);
        // LMTD is lower for parallel flow
        expect(result.lmtd).toBeGreaterThan(40);
        expect(result.lmtd).toBeLessThan(50);
      });
    });

    describe('Crossflow', () => {
      it('should apply correction factor for crossflow', () => {
        const input: LMTDInput = {
          hotInlet: 150,
          hotOutlet: 90,
          coldInlet: 30,
          coldOutlet: 80,
          flowArrangement: 'CROSSFLOW',
        };

        const result = calculateLMTD(input);

        // Crossflow should have correction factor < 1
        expect(result.correctionFactor).toBeLessThanOrEqual(1);
        expect(result.correctionFactor).toBeGreaterThanOrEqual(0.7);
        expect(result.correctedLMTD).toBeLessThanOrEqual(result.lmtd);
      });
    });

    describe('Edge cases', () => {
      it('should detect temperature cross and return zero LMTD', () => {
        const input: LMTDInput = {
          hotInlet: 80,
          hotOutlet: 60,
          coldInlet: 70,
          coldOutlet: 90, // Cold outlet > hot inlet = cross
          flowArrangement: 'COUNTER',
        };

        const result = calculateLMTD(input);

        expect(result.lmtd).toBe(0);
        expect(result.warnings).toContain(
          'Temperature cross detected - invalid heat exchanger configuration'
        );
      });

      it('should warn on very low LMTD', () => {
        const input: LMTDInput = {
          hotInlet: 50,
          hotOutlet: 47,
          coldInlet: 42,
          coldOutlet: 46,
          flowArrangement: 'COUNTER',
        };

        const result = calculateLMTD(input);

        // LMTD should be very small (close to 4-5)
        expect(result.lmtd).toBeLessThan(6);
        expect(result.warnings).toContain('Very low LMTD may result in large heat exchanger');
      });
    });
  });

  describe('calculateHeatDutyFromLMTD', () => {
    it('should calculate heat duty from U, A, and LMTD', () => {
      // Q = U × A × LMTD
      const overallHTC = 1000; // W/(m²·K)
      const area = 50; // m²
      const lmtd = 30; // °C

      const heatDuty = calculateHeatDutyFromLMTD(overallHTC, area, lmtd);

      // Q = 1000 × 50 × 30 = 1,500,000 W = 1500 kW
      expect(heatDuty).toBe(1500);
    });
  });

  describe('calculateRequiredArea', () => {
    it('should calculate required area from Q, U, and LMTD', () => {
      // A = Q / (U × LMTD)
      const heatDuty = 1500; // kW
      const overallHTC = 1000; // W/(m²·K)
      const lmtd = 30; // °C

      const area = calculateRequiredArea(heatDuty, overallHTC, lmtd);

      // A = 1500000 / (1000 × 30) = 50 m²
      expect(area).toBe(50);
    });

    it('should handle typical heat exchanger sizing', () => {
      // Real-world example: Steam condenser
      const heatDuty = 5000; // 5 MW
      const condensingSteamHTC = TYPICAL_HTC.condensing_steam;
      expect(condensingSteamHTC).toBeDefined();
      const overallHTC = condensingSteamHTC!.typical; // 5000 W/(m²·K)
      const lmtd = 20; // °C

      const area = calculateRequiredArea(heatDuty, overallHTC, lmtd);

      // A = 5000000 / (5000 × 20) = 50 m²
      expect(area).toBe(50);
    });
  });

  describe('calculateCombinedHeat', () => {
    it('should calculate combined sensible + latent heat', () => {
      const sensibleInput: SensibleHeatInput = {
        fluidType: 'PURE_WATER',
        massFlowRate: 10, // ton/hr
        inletTemperature: 25,
        outletTemperature: 100,
      };

      const latentInput: LatentHeatInput = {
        massFlowRate: 10, // ton/hr
        temperature: 100,
        process: 'EVAPORATION',
      };

      const result = calculateCombinedHeat(sensibleInput, latentInput);

      expect(result.sensible).toBeDefined();
      expect(result.latent).toBeDefined();
      expect(result.totalHeatDuty).toBe(
        (result.sensible?.heatDuty || 0) + (result.latent?.heatDuty || 0)
      );
      // Total should be substantial (several MW)
      expect(result.totalHeatDuty).toBeGreaterThan(5000);
    });

    it('should handle sensible-only calculation', () => {
      const sensibleInput: SensibleHeatInput = {
        fluidType: 'PURE_WATER',
        massFlowRate: 10,
        inletTemperature: 25,
        outletTemperature: 50,
      };

      const result = calculateCombinedHeat(sensibleInput, undefined);

      expect(result.sensible).toBeDefined();
      expect(result.latent).toBeUndefined();
      expect(result.totalHeatDuty).toBe(result.sensible?.heatDuty);
    });

    it('should handle latent-only calculation', () => {
      const latentInput: LatentHeatInput = {
        massFlowRate: 10,
        temperature: 100,
        process: 'CONDENSATION',
      };

      const result = calculateCombinedHeat(undefined, latentInput);

      expect(result.sensible).toBeUndefined();
      expect(result.latent).toBeDefined();
      expect(result.totalHeatDuty).toBe(result.latent?.heatDuty);
    });

    it('should return zero for no inputs', () => {
      const result = calculateCombinedHeat(undefined, undefined);

      expect(result.sensible).toBeUndefined();
      expect(result.latent).toBeUndefined();
      expect(result.totalHeatDuty).toBe(0);
    });
  });

  describe('TYPICAL_HTC constants', () => {
    it('should have reasonable HTC ranges', () => {
      // Verify all HTC values are in reasonable ranges
      Object.entries(TYPICAL_HTC).forEach(([_key, values]) => {
        expect(values.min).toBeGreaterThan(0);
        expect(values.typical).toBeGreaterThan(values.min);
        expect(values.max).toBeGreaterThan(values.typical);
      });
    });

    it('should have steam_to_water higher than air_to_water', () => {
      const steamToWater = TYPICAL_HTC.steam_to_water;
      const airToWater = TYPICAL_HTC.air_to_water;
      expect(steamToWater).toBeDefined();
      expect(airToWater).toBeDefined();
      expect(steamToWater!.typical).toBeGreaterThan(airToWater!.typical * 10);
    });
  });
});

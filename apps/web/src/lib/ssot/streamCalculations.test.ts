/**
 * Stream Calculations Tests
 *
 * Tests for thermodynamic property calculations based on fluid type
 */

import {
  inferFluidType,
  calculateDensity,
  calculateEnthalpy,
  calculateSpecificHeat,
  calculateViscosity,
  calculateThermalConductivity,
  calculateEntropy,
  calculateBoilingPointElevation,
  calculateStreamProperties,
  enrichStreamInput,
  type StreamCalculationInput,
} from './streamCalculations';
import type { ProcessStreamInput, FluidType } from '@vapour/types';

// Mock the constants module
jest.mock('@vapour/constants', () => ({
  // Seawater properties
  getSeawaterDensity: jest.fn((tds: number, temp: number) => {
    // Approximate formula: ρ = 1000 + 0.78 × S - 0.0068 × T²
    const salinity = tds / 1000; // ppm to g/kg
    return 1000 + 0.78 * salinity - 0.0068 * temp * temp;
  }),
  getSeawaterEnthalpy: jest.fn((tds: number, temp: number) => {
    // Approximate formula: h = Cp × T (kJ/kg)
    const salinity = tds / 1000;
    const Cp = 4.186 - 0.00005 * salinity;
    return Cp * temp;
  }),
  getSeawaterSpecificHeat: jest.fn((tds: number, _temp: number) => {
    // Approximate formula: Cp = 4.186 - 0.00005 × S
    const salinity = tds / 1000;
    return 4.186 - 0.00005 * salinity;
  }),
  getSeawaterViscosity: jest.fn((tds: number, temp: number) => {
    // Approximate formula: μ ≈ 0.001 × exp(-0.025 × T)
    const salinity = tds / 1000;
    return 0.001 * Math.exp(-0.025 * temp) * (1 + 0.002 * salinity);
  }),
  getSeawaterThermalConductivity: jest.fn((tds: number, temp: number) => {
    // Approximate formula: k ≈ 0.57 + 0.002 × T
    const salinity = tds / 1000;
    return 0.57 + 0.002 * temp - 0.0001 * salinity;
  }),
  getBoilingPointElevation: jest.fn((tds: number, _temp: number) => {
    // Approximate formula: BPE ≈ 0.018 × S
    const salinity = tds / 1000;
    return 0.018 * salinity;
  }),
  // Steam saturation properties
  getDensityVapor: jest.fn((temp: number) => {
    // Approximate: ρ ≈ 0.6 kg/m³ at 100°C
    return 0.6 * Math.exp(0.02 * (temp - 100));
  }),
  getEnthalpyVapor: jest.fn((temp: number) => {
    // Approximate: h ≈ 2676 kJ/kg at 100°C
    return 2676 + 2.0 * (temp - 100);
  }),
  // Pressure-aware steam properties
  getRegion: jest.fn((pressureBar: number, temp: number) => {
    // Simplified region detection
    const satTemp = 100 + 28 * Math.log(pressureBar); // Approximate saturation temp
    if (temp < satTemp - 5) return 1; // Subcooled
    if (temp > satTemp + 5) return 2; // Superheated
    return 4; // Saturation
  }),
  getDensityAtPT: jest.fn((pressureBar: number, temp: number) => {
    // Approximate steam density
    const tempK = temp + 273.15;
    return (pressureBar * 100000 * 0.018) / (8.314 * tempK);
  }),
  getEnthalpy: jest.fn((pressureBar: number, temp: number) => {
    // Approximate steam enthalpy
    return 2676 + 2.0 * (temp - 100) + 10 * Math.log(pressureBar);
  }),
  getSteamProperties: jest.fn((pressureBar: number, _temp: number) => ({
    specificHeat: 2.0 + 0.1 * pressureBar,
    entropy: 7.0 - 0.5 * Math.log(pressureBar),
  })),
  getSpecificHeatSubcooled: jest.fn((_pressureBar: number, _temp: number) => 4.2),
  getSpecificHeatSuperheated: jest.fn((_pressureBar: number, _temp: number) => 2.0),
  getEntropySubcooled: jest.fn((_pressureBar: number, temp: number) => 1.0 + 0.003 * temp),
  getEntropySuperheated: jest.fn((_pressureBar: number, temp: number) => 7.0 + 0.002 * temp),
}));

describe('Stream Calculations', () => {
  describe('inferFluidType', () => {
    it('should detect sea water from SW prefix', () => {
      expect(inferFluidType('SW-001')).toBe('SEA WATER');
      expect(inferFluidType('sw-intake')).toBe('SEA WATER');
    });

    it('should detect brine from B prefix', () => {
      expect(inferFluidType('B-001')).toBe('BRINE WATER');
      expect(inferFluidType('b-reject')).toBe('BRINE WATER');
    });

    it('should detect distillate from D prefix', () => {
      expect(inferFluidType('D-001')).toBe('DISTILLATE WATER');
      expect(inferFluidType('d-product')).toBe('DISTILLATE WATER');
    });

    it('should detect steam from S prefix', () => {
      expect(inferFluidType('S-001')).toBe('STEAM');
      expect(inferFluidType('s-main')).toBe('STEAM');
    });

    it('should detect NCG from NCG prefix', () => {
      expect(inferFluidType('NCG-001')).toBe('NCG');
      expect(inferFluidType('ncg-vent')).toBe('NCG');
    });

    it('should detect feed water from FW prefix', () => {
      expect(inferFluidType('FW-001')).toBe('FEED WATER');
      expect(inferFluidType('fw-supply')).toBe('FEED WATER');
    });

    it('should default to sea water for unknown prefixes', () => {
      expect(inferFluidType('X-001')).toBe('SEA WATER');
      expect(inferFluidType('unknown')).toBe('SEA WATER');
    });

    it('should handle whitespace', () => {
      expect(inferFluidType('  SW-001  ')).toBe('SEA WATER');
    });
  });

  describe('calculateDensity', () => {
    describe('seawater and brine', () => {
      it('should calculate seawater density with TDS', () => {
        const density = calculateDensity('SEA WATER', 25, 35000); // 35,000 ppm
        expect(density).toBeGreaterThan(1020);
        expect(density).toBeLessThan(1030);
      });

      it('should calculate brine density with high TDS', () => {
        const density = calculateDensity('BRINE WATER', 40, 70000); // 70,000 ppm
        expect(density).toBeGreaterThan(1040);
      });

      it('should throw error if TDS is missing for seawater', () => {
        expect(() => calculateDensity('SEA WATER', 25)).toThrow('TDS is required');
      });

      it('should throw error if TDS is missing for brine', () => {
        expect(() => calculateDensity('BRINE WATER', 40)).toThrow('TDS is required');
      });
    });

    describe('distillate and feed water', () => {
      it('should calculate distillate density (pure water)', () => {
        const density = calculateDensity('DISTILLATE WATER', 25);
        // Pure water at 25°C is approximately 997 kg/m³
        expect(density).toBeGreaterThan(990);
        expect(density).toBeLessThan(1005);
      });

      it('should calculate feed water density (pure water)', () => {
        const density = calculateDensity('FEED WATER', 80);
        expect(density).toBeGreaterThan(950);
        expect(density).toBeLessThan(980);
      });
    });

    describe('steam', () => {
      it('should calculate steam density at given pressure', () => {
        const density = calculateDensity('STEAM', 150, undefined, 2000); // 2 bar(a)
        expect(density).toBeGreaterThan(0);
        expect(density).toBeLessThan(5);
      });

      it('should use default pressure if not provided', () => {
        const density = calculateDensity('STEAM', 100);
        expect(density).toBeGreaterThan(0);
      });
    });

    describe('NCG', () => {
      it('should calculate NCG density using ideal gas law', () => {
        const density = calculateDensity('NCG', 25, undefined, 1013); // ~1 bar(a)
        // Air at 25°C, 1 bar ≈ 1.18 kg/m³
        expect(density).toBeGreaterThan(1);
        expect(density).toBeLessThan(1.5);
      });
    });

    it('should throw error for unknown fluid type', () => {
      expect(() => calculateDensity('UNKNOWN' as FluidType, 25)).toThrow('Unknown fluid type');
    });
  });

  describe('calculateEnthalpy', () => {
    describe('seawater and brine', () => {
      it('should calculate seawater enthalpy', () => {
        const enthalpy = calculateEnthalpy('SEA WATER', 50, 35000);
        // h ≈ Cp × T ≈ 4.1 × 50 ≈ 205 kJ/kg
        expect(enthalpy).toBeGreaterThan(180);
        expect(enthalpy).toBeLessThan(220);
      });

      it('should throw error if TDS is missing', () => {
        expect(() => calculateEnthalpy('SEA WATER', 50)).toThrow('TDS is required');
      });
    });

    describe('distillate and feed water', () => {
      it('should calculate distillate enthalpy (pure water)', () => {
        const enthalpy = calculateEnthalpy('DISTILLATE WATER', 80);
        // h ≈ 4.18 × 80 ≈ 334 kJ/kg
        expect(enthalpy).toBeGreaterThan(300);
        expect(enthalpy).toBeLessThan(360);
      });
    });

    describe('steam', () => {
      it('should calculate steam enthalpy at given pressure', () => {
        const enthalpy = calculateEnthalpy('STEAM', 150, undefined, 2000);
        // Superheated steam enthalpy is typically > 2700 kJ/kg
        expect(enthalpy).toBeGreaterThan(2600);
      });
    });

    describe('NCG', () => {
      it('should calculate NCG enthalpy using ideal gas approximation', () => {
        const enthalpy = calculateEnthalpy('NCG', 100);
        // h ≈ Cp × T ≈ 1.0 × 100 = 100 kJ/kg
        expect(enthalpy).toBe(100);
      });
    });
  });

  describe('calculateSpecificHeat', () => {
    it('should return Cp for seawater', () => {
      const Cp = calculateSpecificHeat('SEA WATER', 25, 35000);
      expect(Cp).toBeGreaterThan(3.8);
      expect(Cp).toBeLessThan(4.2);
    });

    it('should return Cp for pure water', () => {
      const Cp = calculateSpecificHeat('DISTILLATE WATER', 25);
      expect(Cp).toBeCloseTo(4.186, 2);
    });

    it('should return undefined for seawater without TDS', () => {
      const Cp = calculateSpecificHeat('SEA WATER', 25);
      expect(Cp).toBeUndefined();
    });

    it('should return Cp for steam', () => {
      const Cp = calculateSpecificHeat('STEAM', 150, undefined, 2000);
      expect(Cp).toBeGreaterThan(1.5);
      expect(Cp).toBeLessThan(5);
    });

    it('should return 1.0 for NCG', () => {
      const Cp = calculateSpecificHeat('NCG', 100);
      expect(Cp).toBe(1.0);
    });
  });

  describe('calculateViscosity', () => {
    it('should return viscosity for seawater', () => {
      const viscosity = calculateViscosity('SEA WATER', 25, 35000);
      // Seawater viscosity at 25°C ≈ 0.001 Pa·s
      expect(viscosity).toBeGreaterThan(0.0001);
      expect(viscosity).toBeLessThan(0.002);
    });

    it('should return undefined for seawater without TDS', () => {
      const viscosity = calculateViscosity('SEA WATER', 25);
      expect(viscosity).toBeUndefined();
    });

    it('should return viscosity for pure water', () => {
      const viscosity = calculateViscosity('DISTILLATE WATER', 25);
      expect(viscosity).toBeGreaterThan(0.0001);
      expect(viscosity).toBeLessThan(0.002);
    });

    it('should return viscosity for steam', () => {
      const viscosity = calculateViscosity('STEAM', 150);
      expect(viscosity).toBeGreaterThan(10e-6);
      expect(viscosity).toBeLessThan(30e-6);
    });

    it('should return viscosity for NCG', () => {
      const viscosity = calculateViscosity('NCG', 25);
      expect(viscosity).toBeGreaterThan(15e-6);
      expect(viscosity).toBeLessThan(25e-6);
    });
  });

  describe('calculateThermalConductivity', () => {
    it('should return thermal conductivity for seawater', () => {
      const k = calculateThermalConductivity('SEA WATER', 25, 35000);
      // Seawater k at 25°C ≈ 0.6 W/(m·K)
      expect(k).toBeGreaterThan(0.5);
      expect(k).toBeLessThan(0.7);
    });

    it('should return undefined for seawater without TDS', () => {
      const k = calculateThermalConductivity('SEA WATER', 25);
      expect(k).toBeUndefined();
    });

    it('should return thermal conductivity for pure water', () => {
      const k = calculateThermalConductivity('DISTILLATE WATER', 50);
      expect(k).toBeGreaterThan(0.5);
      expect(k).toBeLessThan(0.8);
    });

    it('should return undefined for steam', () => {
      const k = calculateThermalConductivity('STEAM', 150);
      expect(k).toBeUndefined();
    });

    it('should return undefined for NCG', () => {
      const k = calculateThermalConductivity('NCG', 25);
      expect(k).toBeUndefined();
    });
  });

  describe('calculateEntropy', () => {
    it('should return entropy for steam', () => {
      const entropy = calculateEntropy('STEAM', 150, 2000);
      expect(entropy).toBeGreaterThan(5);
      expect(entropy).toBeLessThan(10);
    });

    it('should return undefined for non-steam fluids', () => {
      expect(calculateEntropy('SEA WATER', 50, 35000)).toBeUndefined();
      expect(calculateEntropy('DISTILLATE WATER', 50)).toBeUndefined();
      expect(calculateEntropy('NCG', 50)).toBeUndefined();
    });
  });

  describe('calculateBoilingPointElevation', () => {
    it('should return BPE for seawater', () => {
      const bpe = calculateBoilingPointElevation('SEA WATER', 70, 35000);
      // BPE ≈ 0.6°C for 35 g/kg salinity
      expect(bpe).toBeGreaterThan(0.4);
      expect(bpe).toBeLessThan(1.0);
    });

    it('should return BPE for brine', () => {
      const bpe = calculateBoilingPointElevation('BRINE WATER', 70, 70000);
      // Higher salinity = higher BPE
      expect(bpe).toBeGreaterThan(1.0);
    });

    it('should return undefined without TDS', () => {
      expect(calculateBoilingPointElevation('SEA WATER', 70)).toBeUndefined();
    });

    it('should return undefined for non-saline fluids', () => {
      expect(calculateBoilingPointElevation('DISTILLATE WATER', 70)).toBeUndefined();
      expect(calculateBoilingPointElevation('STEAM', 100)).toBeUndefined();
      expect(calculateBoilingPointElevation('NCG', 50)).toBeUndefined();
    });
  });

  describe('calculateStreamProperties', () => {
    it('should calculate all properties for seawater', () => {
      const input: StreamCalculationInput = {
        fluidType: 'SEA WATER',
        temperature: 30,
        pressureMbar: 1013,
        flowRateKgS: 100,
        tds: 35000,
      };

      const result = calculateStreamProperties(input);

      expect(result.density).toBeGreaterThan(1020);
      expect(result.enthalpy).toBeGreaterThan(100);
      expect(result.flowRateKgHr).toBe(360000); // 100 kg/s × 3600
      expect(result.pressureBar).toBeCloseTo(1.013, 3);
      expect(result.specificHeat).toBeDefined();
      expect(result.viscosity).toBeDefined();
      expect(result.thermalConductivity).toBeDefined();
      expect(result.boilingPointElevation).toBeDefined();
      expect(result.steamRegion).toBeUndefined();
    });

    it('should calculate all properties for steam', () => {
      const input: StreamCalculationInput = {
        fluidType: 'STEAM',
        temperature: 150,
        pressureMbar: 2000,
        flowRateKgS: 10,
      };

      const result = calculateStreamProperties(input);

      expect(result.density).toBeGreaterThan(0);
      expect(result.enthalpy).toBeGreaterThan(2600);
      expect(result.flowRateKgHr).toBe(36000);
      expect(result.pressureBar).toBe(2);
      expect(result.specificHeat).toBeDefined();
      expect(result.steamRegion).toBeDefined();
      expect(result.entropy).toBeDefined();
      expect(result.boilingPointElevation).toBeUndefined();
    });

    it('should calculate properties for NCG', () => {
      const input: StreamCalculationInput = {
        fluidType: 'NCG',
        temperature: 50,
        pressureMbar: 1013,
        flowRateKgS: 0.5,
      };

      const result = calculateStreamProperties(input);

      expect(result.density).toBeGreaterThan(1);
      expect(result.enthalpy).toBe(50); // Cp × T = 1 × 50
      expect(result.flowRateKgHr).toBe(1800);
      expect(result.specificHeat).toBe(1.0);
      expect(result.viscosity).toBeDefined();
    });
  });

  describe('enrichStreamInput', () => {
    function createTestStreamInput(
      overrides: Partial<ProcessStreamInput> = {}
    ): ProcessStreamInput {
      return {
        lineTag: 'TEST-001',
        fluidType: 'SEA WATER',
        description: 'Test stream',
        temperature: 30,
        pressureMbar: 1013,
        flowRateKgS: 100,
        tds: 35000,
        ...overrides,
      };
    }

    it('should enrich stream input with calculated values', () => {
      const input = createTestStreamInput();

      const enriched = enrichStreamInput(input);

      expect(enriched.flowRateKgHr).toBe(360000);
      expect(enriched.pressureBar).toBeCloseTo(1.013, 3);
      expect(enriched.density).toBeGreaterThan(1020);
      expect(enriched.enthalpy).toBeDefined();
      expect(enriched.specificHeat).toBeDefined();
      expect(enriched.viscosity).toBeDefined();
      expect(enriched.thermalConductivity).toBeDefined();
      expect(enriched.boilingPointElevation).toBeDefined();
    });

    it('should return input unchanged if temperature is missing', () => {
      const input = createTestStreamInput({ temperature: undefined });

      const enriched = enrichStreamInput(input);

      expect(enriched).toEqual(input);
    });

    it('should return input unchanged if pressure is missing', () => {
      const input = createTestStreamInput({ pressureMbar: undefined });

      const enriched = enrichStreamInput(input);

      expect(enriched).toEqual(input);
    });

    it('should return input unchanged if flow rate is missing', () => {
      const input = createTestStreamInput({ flowRateKgS: undefined });

      const enriched = enrichStreamInput(input);

      expect(enriched).toEqual(input);
    });

    it('should enrich steam stream with steamRegion', () => {
      const input = createTestStreamInput({
        fluidType: 'STEAM',
        temperature: 200,
        pressureMbar: 3000,
        tds: undefined,
      });

      const enriched = enrichStreamInput(input);

      expect(enriched.steamRegion).toBeDefined();
      expect(['saturation', 'subcooled', 'superheated']).toContain(enriched.steamRegion);
    });

    it('should handle calculation errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Missing TDS for seawater should trigger error
      const input = createTestStreamInput({ tds: undefined });

      const enriched = enrichStreamInput(input);

      // Should return input unchanged on error
      expect(enriched).toEqual(input);

      consoleSpy.mockRestore();
    });
  });

  describe('unit conversions', () => {
    it('should correctly convert kg/s to kg/hr', () => {
      const input: StreamCalculationInput = {
        fluidType: 'DISTILLATE WATER',
        temperature: 25,
        pressureMbar: 1013,
        flowRateKgS: 1,
      };

      const result = calculateStreamProperties(input);

      expect(result.flowRateKgHr).toBe(3600);
    });

    it('should correctly convert mbar to bar', () => {
      const input: StreamCalculationInput = {
        fluidType: 'DISTILLATE WATER',
        temperature: 25,
        pressureMbar: 2500,
        flowRateKgS: 1,
      };

      const result = calculateStreamProperties(input);

      expect(result.pressureBar).toBe(2.5);
    });
  });
});

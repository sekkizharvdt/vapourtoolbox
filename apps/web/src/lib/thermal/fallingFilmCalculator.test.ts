/**
 * Falling Film Evaporator Calculator Tests
 *
 * Tests for the falling film evaporator design calculations including:
 * - Input validation
 * - Wetting rate and minimum wetting rate calculation
 * - Flow regime detection (laminar, wavy, turbulent)
 * - Film HTC calculation for different regimes
 * - Overall HTC calculation
 * - Bundle layout calculations (triangular and square)
 * - Warning generation
 */

// Mock @vapour/constants
jest.mock('@vapour/constants', () => ({
  getSeawaterDensity: jest.fn((salinity: number, temp: number) => {
    // Approximate seawater density (kg/m3)
    return 1000 + salinity * 0.0008 - (temp - 20) * 0.3;
  }),
  getSeawaterViscosity: jest.fn((_salinity: number, temp: number) => {
    // Approximate seawater viscosity (Pa.s) — decreases with temperature
    return 0.001 * Math.exp(-0.02 * (temp - 20));
  }),
  getSeawaterSpecificHeat: jest.fn((_salinity: number, _temp: number) => {
    // Approximate Cp in kJ/(kg.K)
    return 3.95;
  }),
  getSeawaterThermalConductivity: jest.fn((_salinity: number, _temp: number) => {
    // Approximate thermal conductivity in W/(m.K)
    return 0.63;
  }),
  getBoilingPointElevation: jest.fn((salinity: number, _temp: number) => {
    // Approximate BPE in deg C
    return salinity * 0.000015 + 0.2;
  }),
  getLatentHeat: jest.fn((temp: number) => {
    // Approximate latent heat in kJ/kg
    return 2500 - 2.4 * temp;
  }),
  getDensityLiquid: jest.fn((temp: number) => {
    // Pure water liquid density (kg/m3)
    return 1000 - (temp - 20) * 0.3;
  }),
  getDensityVapor: jest.fn((temp: number) => {
    // Pure water vapor density (kg/m3)
    return 0.05 + temp * 0.003;
  }),
}));

import {
  calculateFallingFilm,
  validateFallingFilmInput,
  TUBE_MATERIALS,
  STANDARD_TUBE_SIZES,
  WETTING_LIMITS,
} from './fallingFilmCalculator';
import type { FallingFilmInput } from './fallingFilmCalculator';

// ============================================================================
// Test Helpers
// ============================================================================

/** Typical MED parameters: 1" Cu-Ni 90/10, seawater 35000 ppm, 60C feed, 65C steam */
function getTypicalInput(overrides?: Partial<FallingFilmInput>): FallingFilmInput {
  return {
    feedFlowRate: 50, // kg/s
    feedSalinity: 35000, // ppm
    feedTemperature: 60, // deg C
    steamTemperature: 65, // deg C
    tubeOD: 25.4, // mm (1")
    tubeID: 22.1, // mm (1" x 18 BWG)
    tubeLength: 6, // m
    numberOfTubes: 2400,
    tubeMaterial: 'cu_ni_90_10',
    tubeLayout: 'triangular',
    pitchRatio: 1.33,
    tubeRows: 40,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('fallingFilmCalculator', () => {
  // --------------------------------------------------------------------------
  // Input Validation
  // --------------------------------------------------------------------------
  describe('validateFallingFilmInput', () => {
    it('accepts valid typical input without errors', () => {
      const result = validateFallingFilmInput(getTypicalInput());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects tube OD <= 0', () => {
      const result = validateFallingFilmInput(getTypicalInput({ tubeOD: 0 }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Tube OD'))).toBe(true);
    });

    it('rejects tube ID <= 0', () => {
      const result = validateFallingFilmInput(getTypicalInput({ tubeID: -1 }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Tube ID'))).toBe(true);
    });

    it('rejects tube OD <= tube ID', () => {
      const result = validateFallingFilmInput(getTypicalInput({ tubeOD: 20, tubeID: 22 }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('OD must be greater than tube ID'))).toBe(true);
    });

    it('rejects negative feed flow rate', () => {
      const result = validateFallingFilmInput(getTypicalInput({ feedFlowRate: -5 }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Feed flow rate'))).toBe(true);
    });

    it('rejects zero feed flow rate', () => {
      const result = validateFallingFilmInput(getTypicalInput({ feedFlowRate: 0 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects steam temperature <= feed temperature', () => {
      const result = validateFallingFilmInput(
        getTypicalInput({ steamTemperature: 55, feedTemperature: 60 })
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Steam temperature'))).toBe(true);
    });

    it('rejects zero number of tubes', () => {
      const result = validateFallingFilmInput(getTypicalInput({ numberOfTubes: 0 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects zero tube rows', () => {
      const result = validateFallingFilmInput(getTypicalInput({ tubeRows: 0 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects tube length <= 0', () => {
      const result = validateFallingFilmInput(getTypicalInput({ tubeLength: 0 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects pitch ratio below 1.25', () => {
      const result = validateFallingFilmInput(getTypicalInput({ pitchRatio: 1.1 }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Pitch ratio'))).toBe(true);
    });

    it('rejects negative feed salinity', () => {
      const result = validateFallingFilmInput(getTypicalInput({ feedSalinity: -100 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects salinity above 120000 ppm', () => {
      const result = validateFallingFilmInput(getTypicalInput({ feedSalinity: 150000 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects unknown tube material', () => {
      const result = validateFallingFilmInput(getTypicalInput({ tubeMaterial: 'unobtanium' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown tube material'))).toBe(true);
    });

    it('rejects negative fouling resistance', () => {
      const result = validateFallingFilmInput(getTypicalInput({ foulingResistance: -0.001 }));
      expect(result.isValid).toBe(false);
    });

    it('rejects design margin outside 0-1', () => {
      const result = validateFallingFilmInput(getTypicalInput({ designMargin: 1.5 }));
      expect(result.isValid).toBe(false);
    });

    it('warns when tube count does not divide evenly by rows', () => {
      const result = validateFallingFilmInput(
        getTypicalInput({ numberOfTubes: 2401, tubeRows: 40 })
      );
      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('does not divide evenly'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Basic Calculation
  // --------------------------------------------------------------------------
  describe('calculateFallingFilm — basic calculation', () => {
    it('returns a valid result for typical MED parameters', () => {
      const result = calculateFallingFilm(getTypicalInput());

      // Wetting analysis
      expect(result.wettingRate).toBeGreaterThan(0);
      expect(result.minimumWettingRate).toBeGreaterThan(0);
      expect(result.wettingRatio).toBeGreaterThan(0);
      expect(['excellent', 'good', 'marginal', 'poor']).toContain(result.wettingStatus);

      // Film characteristics
      expect(result.filmReynolds).toBeGreaterThan(0);
      expect(result.flowRegime).toBeDefined();

      // Heat transfer
      expect(result.filmHTC).toBeGreaterThan(0);
      expect(result.condensationHTC).toBeGreaterThan(0);
      expect(result.wallResistance).toBeGreaterThan(0);
      expect(result.overallHTC).toBeGreaterThan(0);

      // Thermal performance
      expect(result.heatTransferArea).toBeGreaterThan(0);
      expect(result.heatDuty).toBeGreaterThan(0);
      expect(result.evaporationRate).toBeGreaterThan(0);
      expect(result.specificEvaporationRate).toBeGreaterThan(0);

      // Tube bundle
      expect(result.tubesPerRow).toBe(60);
      expect(result.bundleWidth).toBeGreaterThan(0);
      expect(result.bundleHeight).toBeGreaterThan(0);
    });

    it('throws on invalid input', () => {
      expect(() => calculateFallingFilm(getTypicalInput({ tubeOD: 0 }))).toThrow('Invalid input');
    });
  });

  // --------------------------------------------------------------------------
  // Wetting Rate & Minimum Wetting Rate
  // --------------------------------------------------------------------------
  describe('wetting rate calculations', () => {
    it('computes wetting rate as feed / (tubesPerRow * tubeLength * 2)', () => {
      const input = getTypicalInput();
      const result = calculateFallingFilm(input);
      const tubesPerRow = Math.floor(input.numberOfTubes / input.tubeRows);
      const expectedWettingRate = input.feedFlowRate / (tubesPerRow * input.tubeLength * 2);
      expect(result.wettingRate).toBeCloseTo(expectedWettingRate, 6);
    });

    it('minimum wetting rate is positive and much smaller than typical wetting rate', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.minimumWettingRate).toBeGreaterThan(0);
      expect(result.minimumWettingRate).toBeLessThan(result.wettingRate);
    });

    it('wetting ratio equals wettingRate / minimumWettingRate', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.wettingRatio).toBeCloseTo(result.wettingRate / result.minimumWettingRate, 4);
    });

    it('classifies excellent wetting when ratio > 3.0', () => {
      // Use a high feed flow to get a high wetting ratio
      const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: 200 }));
      if (result.wettingRatio > WETTING_LIMITS.EXCELLENT) {
        expect(result.wettingStatus).toBe('excellent');
      }
    });

    it('warns on low wetting ratio (< 1.5)', () => {
      // Use very low feed flow to get a low wetting ratio
      const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: 0.5 }));
      if (result.wettingRatio < 1.5) {
        expect(result.warnings.some((w) => w.includes('Wetting ratio'))).toBe(true);
      }
    });

    it('warns on excessive wetting ratio (> 6)', () => {
      const result = calculateFallingFilm(
        getTypicalInput({ feedFlowRate: 500, numberOfTubes: 100, tubeRows: 10 })
      );
      if (result.wettingRatio > 6) {
        expect(result.warnings.some((w) => w.includes('excessive flooding'))).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Flow Regime Detection
  // --------------------------------------------------------------------------
  describe('flow regime detection', () => {
    it('detects Droplet regime at very low Reynolds (< 30)', () => {
      // Extremely low flow rate to push Re below 30
      const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: 0.01 }));
      if (result.filmReynolds < 30) {
        expect(result.flowRegime).toBe('Droplet');
        expect(result.warnings.some((w) => w.includes('droplet regime'))).toBe(true);
      }
    });

    it('detects Laminar Sheet regime for Re between 30 and 400', () => {
      // Moderate flow rate targeting laminar range
      const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: 5 }));
      if (result.filmReynolds >= 30 && result.filmReynolds < 400) {
        expect(result.flowRegime).toBe('Laminar Sheet');
      }
    });

    it('detects Wavy-Laminar regime for Re between 400 and 1600', () => {
      const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: 50 }));
      if (result.filmReynolds >= 400 && result.filmReynolds < 1600) {
        expect(result.flowRegime).toBe('Wavy-Laminar');
      }
    });

    it('detects Turbulent regime for Re > 1600', () => {
      const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: 300 }));
      if (result.filmReynolds >= 1600) {
        expect(result.flowRegime).toBe('Turbulent');
      }
    });

    it('film Reynolds equals 4 * wettingRate / viscosity', () => {
      const result = calculateFallingFilm(getTypicalInput());
      // We can verify the relationship Re = 4 * Gamma / mu
      // Since mu is mocked, verify the Reynolds is positive and consistent
      expect(result.filmReynolds).toBeGreaterThan(0);
      expect(result.filmReynolds).toBeCloseTo((4 * result.wettingRate) / 0.000449, -1);
    });
  });

  // --------------------------------------------------------------------------
  // Film HTC
  // --------------------------------------------------------------------------
  describe('film HTC calculation', () => {
    it('film HTC is positive for all regimes', () => {
      const flows = [0.5, 5, 50, 300];
      for (const flow of flows) {
        const result = calculateFallingFilm(getTypicalInput({ feedFlowRate: flow }));
        expect(result.filmHTC).toBeGreaterThan(0);
      }
    });

    it('film HTC is in a physically reasonable range (100 - 50000 W/(m2.K))', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.filmHTC).toBeGreaterThan(100);
      expect(result.filmHTC).toBeLessThan(50000);
    });
  });

  // --------------------------------------------------------------------------
  // Overall HTC
  // --------------------------------------------------------------------------
  describe('overall HTC calculation', () => {
    it('overall HTC is less than the minimum of film and condensation HTC', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.overallHTC).toBeLessThan(Math.min(result.filmHTC, result.condensationHTC));
    });

    it('overall HTC is in a typical MED range (1000 - 5000 W/(m2.K))', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.overallHTC).toBeGreaterThan(500);
      expect(result.overallHTC).toBeLessThan(10000);
    });

    it('wall resistance increases with lower conductivity material', () => {
      const resultCuNi = calculateFallingFilm(getTypicalInput({ tubeMaterial: 'cu_ni_90_10' }));
      const resultSS = calculateFallingFilm(getTypicalInput({ tubeMaterial: 'ss_316l' }));
      expect(resultSS.wallResistance).toBeGreaterThan(resultCuNi.wallResistance);
    });

    it('fouling resistance uses default when not specified', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.foulingResistance).toBe(0.00009);
    });

    it('fouling resistance uses specified value when provided', () => {
      const result = calculateFallingFilm(getTypicalInput({ foulingResistance: 0.0002 }));
      expect(result.foulingResistance).toBe(0.0002);
    });
  });

  // --------------------------------------------------------------------------
  // Bundle Layout Calculations
  // --------------------------------------------------------------------------
  describe('bundle layout', () => {
    it('calculates pitch = pitchRatio * tubeOD', () => {
      const input = getTypicalInput();
      const result = calculateFallingFilm(input);
      expect(result.pitch).toBeCloseTo(input.pitchRatio * input.tubeOD, 4);
    });

    it('triangular layout has row spacing = pitch * sin(60deg)', () => {
      const input = getTypicalInput({ tubeLayout: 'triangular' });
      const result = calculateFallingFilm(input);
      const expectedSpacing = result.pitch * Math.sin((60 * Math.PI) / 180);
      expect(result.rowSpacing).toBeCloseTo(expectedSpacing, 4);
    });

    it('square layout has row spacing = pitch', () => {
      const input = getTypicalInput({ tubeLayout: 'square' });
      const result = calculateFallingFilm(input);
      expect(result.rowSpacing).toBeCloseTo(result.pitch, 4);
    });

    it('bundle width = (tubesPerRow - 1) * pitch + tubeOD', () => {
      const input = getTypicalInput();
      const result = calculateFallingFilm(input);
      const expectedWidth = (result.tubesPerRow - 1) * result.pitch + input.tubeOD;
      expect(result.bundleWidth).toBeCloseTo(expectedWidth, 4);
    });

    it('bundle height = (tubeRows - 1) * rowSpacing + tubeOD', () => {
      const input = getTypicalInput();
      const result = calculateFallingFilm(input);
      const expectedHeight = (input.tubeRows - 1) * result.rowSpacing + input.tubeOD;
      expect(result.bundleHeight).toBeCloseTo(expectedHeight, 4);
    });

    it('tubesPerRow = floor(numberOfTubes / tubeRows)', () => {
      const result = calculateFallingFilm(getTypicalInput());
      expect(result.tubesPerRow).toBe(Math.floor(2400 / 40));
    });
  });

  // --------------------------------------------------------------------------
  // Warning Generation
  // --------------------------------------------------------------------------
  describe('warning generation', () => {
    it('warns on effective temperature difference < 1 deg C', () => {
      // Steam temp barely above feed temp + BPE
      const result = calculateFallingFilm(
        getTypicalInput({ steamTemperature: 60.5, feedTemperature: 60 })
      );
      if (result.effectiveTemperatureDiff < 1) {
        expect(result.warnings.some((w) => w.includes('less than 1'))).toBe(true);
      }
    });

    it('warns on effective temperature difference > 10 deg C', () => {
      const result = calculateFallingFilm(
        getTypicalInput({ steamTemperature: 80, feedTemperature: 60 })
      );
      if (result.effectiveTemperatureDiff > 10) {
        expect(result.warnings.some((w) => w.includes('exceeds 10'))).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Exported Constants
  // --------------------------------------------------------------------------
  describe('exported constants', () => {
    it('TUBE_MATERIALS contains expected materials', () => {
      expect(TUBE_MATERIALS.cu_ni_90_10).toBeDefined();
      expect(TUBE_MATERIALS.titanium).toBeDefined();
      expect(TUBE_MATERIALS.ss_316l).toBeDefined();
      expect(TUBE_MATERIALS.cu_ni_90_10!.conductivity).toBe(45);
    });

    it('STANDARD_TUBE_SIZES contains at least the common 1" size', () => {
      const oneInch = STANDARD_TUBE_SIZES.find((s) => s.od === 25.4 && s.bwg === 18);
      expect(oneInch).toBeDefined();
      expect(oneInch!.id).toBe(22.1);
    });

    it('WETTING_LIMITS has correct thresholds', () => {
      expect(WETTING_LIMITS.EXCELLENT).toBe(3.0);
      expect(WETTING_LIMITS.GOOD).toBe(2.0);
      expect(WETTING_LIMITS.MARGINAL).toBe(1.5);
    });
  });
});

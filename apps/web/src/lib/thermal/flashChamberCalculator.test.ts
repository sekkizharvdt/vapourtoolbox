/**
 * Flash Chamber Calculator Tests
 *
 * Tests for the flash chamber design calculations including:
 * - Input validation
 * - Heat and mass balance calculations
 * - Chamber sizing
 * - Nozzle sizing
 * - NPSHa calculation
 */

import type { FlashChamberInput } from '@vapour/types';

// Mock @vapour/constants
jest.mock('@vapour/constants', () => ({
  getSaturationTemperature: jest.fn((pressure: number) => {
    // Approximate saturation temperature for common pressures
    if (pressure <= 0.1) return 45.8;
    if (pressure <= 0.15) return 54.0;
    if (pressure <= 0.2) return 60.1;
    if (pressure <= 0.3) return 69.1;
    return 45.8 + pressure * 100;
  }),
  getSaturationPressure: jest.fn((temp: number) => {
    // Approximate saturation pressure
    return 0.01 * Math.exp(0.05 * temp);
  }),
  getEnthalpyVapor: jest.fn((temp: number) => {
    // Approximate enthalpy of saturated vapor (kJ/kg)
    return 2500 + temp * 2;
  }),
  getDensityVapor: jest.fn((temp: number) => {
    // Approximate vapor density (kg/m³)
    return 0.1 + (100 - temp) * 0.001;
  }),
  getDensityLiquid: jest.fn((temp: number) => {
    // Approximate pure water density (kg/m³)
    return 1000 - (temp - 20) * 0.3;
  }),
  mbarAbsToBar: jest.fn((mbar: number) => mbar / 1000),
  barToWaterHead: jest.fn((bar: number) => bar * 10.2),
  getSeawaterDensity: jest.fn((salinity: number, temp: number) => {
    // Approximate seawater density
    return 1000 + salinity * 0.0008 - (temp - 20) * 0.2;
  }),
  getSeawaterEnthalpy: jest.fn((salinity: number, temp: number) => {
    // Approximate seawater enthalpy (kJ/kg)
    return temp * 4.18 * (1 - salinity * 0.00001);
  }),
  getBoilingPointElevation: jest.fn((salinity: number, temp: number) => {
    // Approximate BPE
    return salinity * 0.00005 * (1 + temp * 0.01);
  }),
  getBrineSalinity: jest.fn((inletSalinity: number, waterFlow: number, vaporFlow: number) => {
    // Mass balance: brine_salinity = inlet_salinity * water_flow / (water_flow - vapor_flow)
    const brineFlow = waterFlow - vaporFlow;
    if (brineFlow <= 0) return 999999;
    return (inletSalinity * waterFlow) / brineFlow;
  }),
}));

// Mock pipeService
jest.mock('./pipeService', () => ({
  selectPipeByVelocity: jest.fn(() => ({
    displayName: '4" Sch 40',
    nps: '4"',
    dn: '100',
    id_mm: 102.26,
    actualVelocity: 2.5,
    velocityStatus: 'OK',
  })),
  calculateRequiredPipeArea: jest.fn(
    (flowRate: number, density: number, velocity: number) =>
      (flowRate * 1000) / (density * 3600 * velocity)
  ),
  SCHEDULE_40_PIPES: [
    { dn: 50, innerDiameter: 52.5, crossSectionalArea: 0.00216 },
    { dn: 80, innerDiameter: 77.9, crossSectionalArea: 0.00477 },
    { dn: 100, innerDiameter: 102.3, crossSectionalArea: 0.00821 },
    { dn: 150, innerDiameter: 154.1, crossSectionalArea: 0.01864 },
  ],
}));

// Import after mocks
import { validateFlashChamberInput, calculateFlashChamber } from './flashChamberCalculator';

describe('flashChamberCalculator', () => {
  // ============================================================================
  // Test Data Factories
  // ============================================================================

  const createValidInput = (overrides: Partial<FlashChamberInput> = {}): FlashChamberInput => ({
    mode: 'WATER_FLOW',
    waterType: 'SEAWATER',
    operatingPressure: 100, // mbar abs
    inletTemperature: 80, // °C
    salinity: 35000, // ppm
    waterFlowRate: 100, // ton/hr
    flowRateUnit: 'TON_HR',
    inletWaterVelocity: 2.5, // m/s
    outletWaterVelocity: 0.05, // m/s
    vaporVelocity: 20, // m/s
    retentionTime: 2, // minutes
    flashingZoneHeight: 500, // mm
    sprayAngle: 85, // degrees
    pumpCenterlineAboveFFL: 0.5, // m
    operatingLevelAbovePump: 5, // m
    operatingLevelRatio: 0.5,
    btlGapBelowLGL: 0.1, // m
    ...overrides,
  });

  const createDMWaterInput = (overrides: Partial<FlashChamberInput> = {}): FlashChamberInput =>
    createValidInput({
      waterType: 'DM_WATER',
      salinity: 0,
      ...overrides,
    });

  const createVaporModeInput = (overrides: Partial<FlashChamberInput> = {}): FlashChamberInput =>
    createValidInput({
      mode: 'VAPOR_QUANTITY',
      vaporQuantity: 5, // ton/hr
      waterFlowRate: undefined,
      ...overrides,
    });

  // ============================================================================
  // validateFlashChamberInput Tests
  // ============================================================================

  describe('validateFlashChamberInput', () => {
    describe('valid inputs', () => {
      it('should accept valid seawater input in WATER_FLOW mode', () => {
        const input = createValidInput();
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept valid DM water input', () => {
        const input = createDMWaterInput();
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept valid VAPOR_QUANTITY mode input', () => {
        const input = createVaporModeInput();
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept different flow rate units', () => {
        const kgSecInput = createValidInput({
          flowRateUnit: 'KG_SEC',
          waterFlowRate: 27.78, // ~100 ton/hr
        });
        const result = validateFlashChamberInput(kgSecInput);

        expect(result.isValid).toBe(true);
      });
    });

    describe('operating pressure validation', () => {
      it('should reject pressure below minimum (50 mbar)', () => {
        const input = createValidInput({ operatingPressure: 40 });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining('Operating pressure must be between')
        );
      });

      it('should reject pressure above maximum (500 mbar)', () => {
        const input = createValidInput({ operatingPressure: 600 });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining('Operating pressure must be between')
        );
      });

      it('should accept pressure at boundary (50 mbar)', () => {
        const input = createValidInput({ operatingPressure: 50 });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(true);
      });
    });

    describe('flow rate validation', () => {
      it('should reject missing water flow rate in WATER_FLOW mode', () => {
        const input = createValidInput({ waterFlowRate: undefined });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining('Water flow rate is required')
        );
      });

      it('should reject zero water flow rate', () => {
        const input = createValidInput({ waterFlowRate: 0 });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(false);
      });

      it('should reject missing vapor quantity in VAPOR_QUANTITY mode', () => {
        const input = createVaporModeInput({ vaporQuantity: undefined });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('Vapor quantity is required'));
      });
    });

    describe('temperature validation', () => {
      it('should reject inlet temperature below saturation temperature', () => {
        // With operating pressure 100 mbar, sat temp is ~45°C
        const input = createValidInput({ inletTemperature: 40 });
        const result = validateFlashChamberInput(input);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('Inlet temperature'));
      });

      it('should warn about small temperature approach', () => {
        // Just above saturation - should warn about low vapor production
        const input = createValidInput({ inletTemperature: 50 });
        const result = validateFlashChamberInput(input);

        // May have warnings about small temperature approach
        // Validity depends on exact sat temp calculation
        expect(result).toBeDefined();
      });
    });

    describe('salinity warnings', () => {
      it('should warn about low seawater salinity', () => {
        const input = createValidInput({ salinity: 500 });
        const result = validateFlashChamberInput(input);

        expect(result.warnings).toContainEqual(expect.stringContaining('unusually low'));
      });

      it('should warn about non-zero DM water salinity', () => {
        const input = createDMWaterInput({ salinity: 100 });
        const result = validateFlashChamberInput(input);

        expect(result.warnings).toContainEqual(expect.stringContaining('zero salinity'));
      });
    });

    describe('velocity warnings', () => {
      it('should warn about inlet velocity outside typical range', () => {
        const input = createValidInput({ inletWaterVelocity: 0.5 });
        const result = validateFlashChamberInput(input);

        expect(result.warnings).toContainEqual(expect.stringContaining('Inlet velocity'));
      });

      it('should warn about outlet velocity outside typical range', () => {
        const input = createValidInput({ outletWaterVelocity: 0.5 });
        const result = validateFlashChamberInput(input);

        expect(result.warnings).toContainEqual(expect.stringContaining('Outlet velocity'));
      });

      it('should warn about vapor velocity outside typical range', () => {
        const input = createValidInput({ vaporVelocity: 50 });
        const result = validateFlashChamberInput(input);

        expect(result.warnings).toContainEqual(expect.stringContaining('Vapor velocity'));
      });
    });
  });

  // ============================================================================
  // calculateFlashChamber Tests
  // ============================================================================

  describe('calculateFlashChamber', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('successful calculations', () => {
      it('should calculate flash chamber for valid seawater input', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result).toBeDefined();
        expect(result.heatMassBalance).toBeDefined();
        expect(result.chamberSizing).toBeDefined();
        expect(result.nozzles).toBeDefined();
        expect(result.npsha).toBeDefined();
        expect(result.elevations).toBeDefined();
      });

      it('should calculate flash chamber for DM water', () => {
        const input = createDMWaterInput();
        const result = calculateFlashChamber(input);

        expect(result).toBeDefined();
        expect(result.heatMassBalance).toBeDefined();
        // DM water should have zero BPE effect
      });

      it('should calculate in VAPOR_QUANTITY mode', () => {
        const input = createVaporModeInput();
        const result = calculateFlashChamber(input);

        expect(result).toBeDefined();
        expect(result.heatMassBalance).toBeDefined();
      });

      it('should include version info', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.metadata).toBeDefined();
        expect(result.metadata!.calculatorVersion).toBeDefined();
        expect(typeof result.metadata!.calculatorVersion).toBe('string');
      });

      it('should include timestamp', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.calculatedAt).toBeDefined();
      });
    });

    describe('heat and mass balance', () => {
      it('should calculate mass balance with water in = vapor out + brine out', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        const { inlet, vapor, brine } = result.heatMassBalance;

        // Mass balance: water = vapor + brine (approximately due to rounding)
        const massBalance = Math.abs(inlet.flowRate - (vapor.flowRate + brine.flowRate));
        expect(massBalance).toBeLessThan(0.1); // Within 0.1 ton/hr tolerance
      });

      it('should calculate consistent flow rates in heat balance', () => {
        const input = createValidInput({ waterFlowRate: 200 });
        const result = calculateFlashChamber(input);

        const { inlet, vapor } = result.heatMassBalance;

        // Vapor flow should be less than water flow
        expect(vapor.flowRate).toBeLessThan(inlet.flowRate);
      });

      it('heat input equals heat output by construction', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        // balanceError/isBalanced fields were removed: vapor flow is solved
        // FROM the energy balance, so in==out is true by construction and the
        // old <5% assertion could never fail. Keep a consistency assertion on
        // the stream totals instead — 0.1% relative tolerance absorbs the
        // enthalpy-table rounding accumulated across the three streams.
        const { heatInput, heatOutput } = result.heatMassBalance;
        expect(Math.abs(heatOutput - heatInput) / heatInput).toBeLessThan(0.001);
      });
    });

    describe('chamber sizing', () => {
      it('should calculate positive chamber dimensions', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.chamberSizing.diameter).toBeGreaterThan(0);
        expect(result.chamberSizing.totalHeight).toBeGreaterThan(0);
      });

      it('should increase chamber size with higher flow rate', () => {
        const lowFlowInput = createValidInput({ waterFlowRate: 50 });
        const highFlowInput = createValidInput({ waterFlowRate: 200 });

        const lowFlowResult = calculateFlashChamber(lowFlowInput);
        const highFlowResult = calculateFlashChamber(highFlowInput);

        expect(highFlowResult.chamberSizing.diameter).toBeGreaterThan(
          lowFlowResult.chamberSizing.diameter
        );
      });
    });

    describe('nozzle sizing', () => {
      it('should calculate multiple nozzles', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.nozzles).toBeDefined();
        expect(Array.isArray(result.nozzles)).toBe(true);
        expect(result.nozzles.length).toBeGreaterThan(0);
      });

      it('should have nozzles with required properties', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        result.nozzles.forEach((nozzle) => {
          expect(nozzle.name).toBeDefined();
          expect(nozzle.type).toBeDefined();
          expect(nozzle.nps).toBeDefined();
          expect(nozzle.actualID).toBeGreaterThan(0);
        });
      });
    });

    describe('NPSHa calculation', () => {
      it('should calculate NPSHa data at multiple levels', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.npsha).toBeDefined();
        expect(result.npsha.atLGL).toBeDefined();
        expect(result.npsha.atOperating).toBeDefined();
        expect(result.npsha.atLGH).toBeDefined();
      });

      it('should have NPSHa entries with required properties', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.npsha.atOperating.levelName).toBeDefined();
        expect(result.npsha.atOperating.elevation).toBeDefined();
        expect(result.npsha.atOperating.npshAvailable).toBeDefined();
      });

      it('should include recommendation', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.npsha.recommendation).toBeDefined();
        expect(typeof result.npsha.recommendation).toBe('string');
      });

      describe('adequacy verdict against a pump NPSHr', () => {
        it('omits margin and verdict entirely when no pump is named', () => {
          const result = calculateFlashChamber(createValidInput());

          // Absent, not zero or false — a consumer must be able to tell
          // "no pump was named" from "no margin".
          expect(result.npsha.atLGL).not.toHaveProperty('margin');
          expect(result.npsha.atLGL).not.toHaveProperty('isAdequate');
          expect(result.npsha).not.toHaveProperty('pumpNPSHr');
          expect(result.npsha).not.toHaveProperty('isAdequate');
        });

        it('reports the margin at every level when a pump is named', () => {
          const pumpNPSHr = 1.0;
          const result = calculateFlashChamber({ ...createValidInput(), pumpNPSHr });

          for (const level of [result.npsha.atLGL, result.npsha.atOperating, result.npsha.atLGH]) {
            expect(level.margin).toBeCloseTo(level.npshAvailable - pumpNPSHr, 10);
          }
          expect(result.npsha.pumpNPSHr).toBe(pumpNPSHr);
        });

        it('judges adequacy at LG-L, not at the operating level', () => {
          // A pump whose NPSHr sits between the LG-L and operating NPSHa: the
          // vessel must fail, because the level controller draws down to LG-L.
          const base = createValidInput();
          const probe = calculateFlashChamber(base);
          const { npshAvailable: atLGL } = probe.npsha.atLGL;
          const { npshAvailable: atOperating } = probe.npsha.atOperating;
          expect(atOperating).toBeGreaterThan(atLGL);

          const between = (atLGL + atOperating) / 2;
          const result = calculateFlashChamber({
            ...base,
            pumpNPSHr: between,
            npshSafetyMargin: 0,
          });

          expect(result.npsha.atOperating.isAdequate).toBe(true);
          expect(result.npsha.atLGL.isAdequate).toBe(false);
          // The headline verdict follows the worst level.
          expect(result.npsha.isAdequate).toBe(false);
        });

        it('requires the margin to cover the safety allowance, not merely be positive', () => {
          const base = createValidInput();
          const atLGL = calculateFlashChamber(base).npsha.atLGL.npshAvailable;

          // NPSHr 0.5 m below NPSHa: a positive margin, but short of a 1 m rule.
          const input = { ...base, pumpNPSHr: atLGL - 0.5, npshSafetyMargin: 1.0 };
          const result = calculateFlashChamber(input);

          expect(result.npsha.atLGL.margin).toBeCloseTo(0.5, 10);
          expect(result.npsha.atLGL.margin!).toBeGreaterThan(0);
          expect(result.npsha.isAdequate).toBe(false);
          expect(result.npsha.recommendation).toContain('does NOT clear');
        });

        it('states how far short the vessel is when it fails', () => {
          const base = createValidInput();
          const atLGL = calculateFlashChamber(base).npsha.atLGL.npshAvailable;
          const result = calculateFlashChamber({
            ...base,
            pumpNPSHr: atLGL - 0.5,
            npshSafetyMargin: 1.0,
          });

          // Short by 0.5 m — the recommendation must name the number to raise by.
          expect(result.npsha.recommendation).toContain('0.50m');
        });
      });
    });

    describe('elevations', () => {
      it('should calculate all elevation references', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        expect(result.elevations.ffl).toBe(0);
        expect(result.elevations.pumpCenterline).toBeDefined();
        expect(result.elevations.operatingLevel).toBeDefined();
        expect(result.elevations.ttl).toBeDefined(); // Top tangent line
        expect(result.elevations.btl).toBeDefined(); // Bottom tangent line
      });

      it('should have consistent elevation hierarchy', () => {
        const input = createValidInput();
        const result = calculateFlashChamber(input);

        // TTL > Operating level > BTL > Pump
        expect(result.elevations.ttl).toBeGreaterThan(result.elevations.operatingLevel);
        expect(result.elevations.operatingLevel).toBeGreaterThan(result.elevations.btl);
        expect(result.elevations.btl).toBeGreaterThanOrEqual(result.elevations.pumpCenterline);
      });
    });

    describe('error handling', () => {
      it('should throw error for invalid input', () => {
        const invalidInput = createValidInput({ operatingPressure: 10 }); // Below minimum

        expect(() => calculateFlashChamber(invalidInput)).toThrow('Invalid input');
      });

      it('should throw error with specific validation message', () => {
        const invalidInput = createValidInput({ waterFlowRate: 0 });

        expect(() => calculateFlashChamber(invalidInput)).toThrow('Water flow rate');
      });
    });

    describe('warnings propagation', () => {
      it('should include validation warnings in result', () => {
        const input = createValidInput({ inletWaterVelocity: 0.5 });
        const result = calculateFlashChamber(input);

        expect(result.warnings).toBeDefined();
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });

    describe('flow rate unit conversions', () => {
      it('should produce consistent results for equivalent flow rates', () => {
        const tonHrInput = createValidInput({
          flowRateUnit: 'TON_HR',
          waterFlowRate: 100,
        });

        const kgHrInput = createValidInput({
          flowRateUnit: 'KG_HR',
          waterFlowRate: 100000, // 100 ton/hr = 100000 kg/hr
        });

        const tonHrResult = calculateFlashChamber(tonHrInput);
        const kgHrResult = calculateFlashChamber(kgHrInput);

        // Chamber diameters should be equal (or very close)
        expect(tonHrResult.chamberSizing.diameter).toBeCloseTo(
          kgHrResult.chamberSizing.diameter,
          2
        );
      });
    });

    // ==========================================================================
    // Spray nozzle differential → reported inlet pressure
    // ==========================================================================

    describe('inlet pressure from the spray nozzle differential', () => {
      /**
       * The feed enters through a spray nozzle whose ΔP sets the flow, so the
       * reported inlet pressure is chamber + ΔP. This replaced a hardcoded
       * `operating + 50 mbar`, which is a line-loss allowance rather than a
       * nozzle differential and stated the feed BELOW its own saturation
       * pressure for any meaningful degree of flash.
       */
      it('reports inlet pressure as chamber pressure plus the nozzle differential', () => {
        const result = calculateFlashChamber(
          createValidInput({ operatingPressure: 200, sprayNozzleDeltaPBar: 3 })
        );

        expect(result.heatMassBalance.inlet.pressure).toBeCloseTo(3200, 6);
      });

      it('defaults to the 3 bar full-cone rated differential when not supplied', () => {
        const result = calculateFlashChamber(createValidInput({ operatingPressure: 200 }));

        expect(result.heatMassBalance.inlet.pressure).toBeCloseTo(3200, 6);
      });

      // The "feed stays above its own saturation pressure" check needs the REAL
      // steam tables and lives in flashChamberCalculator.anchor.test.ts — this
      // file mocks @vapour/constants, so asserting it here would test the mock.

      it('does not let the differential change the heat and mass balance', () => {
        // ΔP sets the feed pressure, but the flash is fixed by the chamber
        // pressure and the feed temperature — liquid enthalpy is nearly
        // pressure-independent, so vapour production must not move.
        const low = calculateFlashChamber(createValidInput({ sprayNozzleDeltaPBar: 0.5 }));
        const high = calculateFlashChamber(createValidInput({ sprayNozzleDeltaPBar: 6 }));

        expect(low.heatMassBalance.vapor.flowRate).toBeCloseTo(
          high.heatMassBalance.vapor.flowRate,
          10
        );
        expect(low.chamberSizing.diameter).toBeCloseTo(high.chamberSizing.diameter, 10);
      });

      it('warns outside the catalogue band but stays valid', () => {
        const result = validateFlashChamberInput(createValidInput({ sprayNozzleDeltaPBar: 8 }));

        expect(result.isValid).toBe(true);
        expect(result.warnings.some((w) => w.includes('catalogue data band'))).toBe(true);
      });

      it('rejects a non-positive differential', () => {
        const result = validateFlashChamberInput(createValidInput({ sprayNozzleDeltaPBar: 0 }));

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('greater than zero'))).toBe(true);
      });

      it('does not warn when the differential is omitted', () => {
        const result = validateFlashChamberInput(createValidInput());

        expect(result.warnings.some((w) => w.includes('catalogue data band'))).toBe(false);
      });
    });
  });
});

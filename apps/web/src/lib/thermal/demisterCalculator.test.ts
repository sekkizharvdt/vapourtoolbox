/**
 * Demister / Mist Eliminator Sizing Calculator Tests
 *
 * Tests for:
 * - Souders-Brown sizing (K-factor, velocity, area, geometry)
 * - Velocity-based pressure drop calculation
 * - Brine carryover estimation (entrainment, efficiency, distillate TDS)
 * - Input validation
 * - Edge cases and warning generation
 */

import type { DemisterInput, CarryoverInput } from './demisterCalculator';

import {
  calculateDemisterSizing,
  calculateCarryoverComparison,
  estimatePrimaryEntrainment,
  calculateDemisterEfficiency,
  DEMISTER_K_FACTORS,
  DEMISTER_PRESSURE_DROP,
  DEMISTER_EFFICIENCY,
  DEFAULT_PAD_THICKNESS,
  DP_MODEL,
} from './demisterCalculator';

describe('demisterCalculator', () => {
  // ============================================================================
  // Test Data Factories
  // ============================================================================

  const createValidInput = (overrides: Partial<DemisterInput> = {}): DemisterInput => ({
    vaporMassFlow: 2.5, // kg/s
    vaporDensity: 0.05, // kg/m³ — typical low-pressure steam
    liquidDensity: 990, // kg/m³ — water/brine
    demisterType: 'wire_mesh',
    orientation: 'horizontal',
    designMargin: 0.8,
    geometry: 'circular',
    ...overrides,
  });

  const createCarryoverInput = (overrides: Partial<CarryoverInput> = {}): CarryoverInput => ({
    brineSalinity: 70000, // ppm — typical MED brine
    ...overrides,
  });

  // ============================================================================
  // Souders-Brown Sizing
  // ============================================================================

  describe('Souders-Brown sizing', () => {
    it('should calculate sizing for valid wire mesh input', () => {
      const input = createValidInput();
      const result = calculateDemisterSizing(input);

      expect(result.kFactor).toBe(DEMISTER_K_FACTORS.wire_mesh.horizontal);
      expect(result.maxVelocity).toBeGreaterThan(0);
      expect(result.designVelocity).toBeCloseTo(result.maxVelocity * 0.8, 6);
      expect(result.vaporVolumetricFlow).toBeCloseTo(2.5 / 0.05, 6);
      expect(result.requiredArea).toBeGreaterThan(0);
      expect(result.vesselDiameter).toBeDefined();
      expect(result.vesselDiameter).toBeGreaterThan(0);
    });

    it('should use correct K factor for each type and orientation', () => {
      const types = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'] as const;
      const orientations = ['horizontal', 'vertical'] as const;

      for (const type of types) {
        for (const orient of orientations) {
          const result = calculateDemisterSizing(
            createValidInput({ demisterType: type, orientation: orient })
          );
          expect(result.kFactor).toBe(DEMISTER_K_FACTORS[type][orient]);
        }
      }
    });

    it('should apply Souders-Brown formula correctly', () => {
      const input = createValidInput();
      const result = calculateDemisterSizing(input);

      const expectedK = DEMISTER_K_FACTORS.wire_mesh.horizontal;
      const expectedVmax = expectedK * Math.sqrt((990 - 0.05) / 0.05);
      const expectedVdesign = expectedVmax * 0.8;

      expect(result.maxVelocity).toBeCloseTo(expectedVmax, 6);
      expect(result.designVelocity).toBeCloseTo(expectedVdesign, 6);
    });

    it('should calculate circular vessel diameter from area', () => {
      const input = createValidInput({ geometry: 'circular' });
      const result = calculateDemisterSizing(input);

      const expectedDiameter = Math.sqrt((4 * result.requiredArea) / Math.PI);
      expect(result.vesselDiameter).toBeCloseTo(expectedDiameter, 6);
      expect(result.rectangleHeight).toBeUndefined();
    });

    it('should calculate rectangular height from area and width', () => {
      const input = createValidInput({
        geometry: 'rectangular',
        rectangleWidth: 2.0,
      });
      const result = calculateDemisterSizing(input);

      expect(result.rectangleHeight).toBeCloseTo(result.requiredArea / 2.0, 6);
      expect(result.vesselDiameter).toBeUndefined();
    });

    it('should not set rectangleHeight if width is missing', () => {
      const input = createValidInput({ geometry: 'rectangular' });
      const result = calculateDemisterSizing(input);

      expect(result.rectangleHeight).toBeUndefined();
    });

    it('should increase required area with higher flow rate', () => {
      const lowFlow = calculateDemisterSizing(createValidInput({ vaporMassFlow: 1.0 }));
      const highFlow = calculateDemisterSizing(createValidInput({ vaporMassFlow: 5.0 }));

      expect(highFlow.requiredArea).toBeGreaterThan(lowFlow.requiredArea);
    });

    it('should decrease required area with higher design margin', () => {
      // Higher margin = higher design velocity = smaller area needed
      const lowMargin = calculateDemisterSizing(createValidInput({ designMargin: 0.6 }));
      const highMargin = calculateDemisterSizing(createValidInput({ designMargin: 0.9 }));

      expect(highMargin.requiredArea).toBeLessThan(lowMargin.requiredArea);
    });
  });

  // ============================================================================
  // Loading Status
  // ============================================================================

  describe('loading status', () => {
    it('should report ok for typical design margins', () => {
      const result = calculateDemisterSizing(createValidInput({ designMargin: 0.8 }));
      expect(result.loadingStatus).toBe('ok');
    });

    it('should report high for margins above 90%', () => {
      const result = calculateDemisterSizing(createValidInput({ designMargin: 0.95 }));
      expect(result.loadingStatus).toBe('high');
    });

    it('should report low for margins below 40%', () => {
      const result = calculateDemisterSizing(createValidInput({ designMargin: 0.3 }));
      expect(result.loadingStatus).toBe('low');
    });

    it('should report loading fraction equal to design margin', () => {
      const result = calculateDemisterSizing(createValidInput({ designMargin: 0.75 }));
      expect(result.loadingFraction).toBe(0.75);
    });
  });

  // ============================================================================
  // Pressure Drop
  // ============================================================================

  describe('pressure drop', () => {
    it('should calculate velocity-based pressure drop', () => {
      const result = calculateDemisterSizing(createValidInput());

      expect(result.pressureDrop).toBeGreaterThan(0);
      expect(result.padThickness).toBe(DEFAULT_PAD_THICKNESS.wire_mesh);
    });

    it('should use custom pad thickness when provided', () => {
      const result = calculateDemisterSizing(createValidInput({ padThickness: 200 }));

      expect(result.padThickness).toBe(200);
    });

    it('should increase pressure drop with higher velocity', () => {
      const lowVelocity = calculateDemisterSizing(createValidInput({ designMargin: 0.5 }));
      const highVelocity = calculateDemisterSizing(createValidInput({ designMargin: 0.95 }));

      expect(highVelocity.pressureDrop).toBeGreaterThan(lowVelocity.pressureDrop);
    });

    it('should increase pressure drop with thicker pad', () => {
      const thin = calculateDemisterSizing(createValidInput({ padThickness: 100 }));
      const thick = calculateDemisterSizing(createValidInput({ padThickness: 300 }));

      expect(thick.pressureDrop).toBeGreaterThan(thin.pressureDrop);
    });

    it('should scale pressure drop linearly with pad thickness', () => {
      const t1 = calculateDemisterSizing(createValidInput({ padThickness: 150 }));
      const t2 = calculateDemisterSizing(createValidInput({ padThickness: 300 }));

      // ΔP ∝ t, so doubling thickness should double ΔP
      expect(t2.pressureDrop).toBeCloseTo(t1.pressureDrop * 2, 3);
    });

    it('should include reference pressure drop range', () => {
      const result = calculateDemisterSizing(createValidInput());

      expect(result.pressureDropRange).toEqual(DEMISTER_PRESSURE_DROP.wire_mesh);
    });

    it('should use different default thicknesses for different types', () => {
      const wireMesh = calculateDemisterSizing(createValidInput({ demisterType: 'wire_mesh' }));
      const vane = calculateDemisterSizing(createValidInput({ demisterType: 'vane' }));

      expect(wireMesh.padThickness).toBe(150);
      expect(vane.padThickness).toBe(50);
    });
  });

  // ============================================================================
  // Brine Carryover Estimation
  // ============================================================================

  describe('brine carryover', () => {
    it('should not include carryover when not requested', () => {
      const result = calculateDemisterSizing(createValidInput());
      expect(result.carryover).toBeUndefined();
    });

    it('should calculate carryover when enabled', () => {
      const result = calculateDemisterSizing(
        createValidInput({ carryover: createCarryoverInput() })
      );

      expect(result.carryover).toBeDefined();
      expect(result.carryover!.primaryEntrainment).toBeGreaterThan(0);
      expect(result.carryover!.demisterEfficiency).toBeGreaterThan(0);
      expect(result.carryover!.demisterEfficiency).toBeLessThanOrEqual(1);
      expect(result.carryover!.netCarryover).toBeGreaterThan(0);
      expect(result.carryover!.carryoverMassFlow).toBeGreaterThan(0);
      expect(result.carryover!.distillateTDS).toBeGreaterThan(0);
    });

    it('should use estimated entrainment when not provided', () => {
      const result = calculateDemisterSizing(
        createValidInput({ carryover: createCarryoverInput() })
      );

      expect(result.carryover!.primaryEntrainmentSource).toBe('estimated');
    });

    it('should use user-provided entrainment when specified', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          carryover: createCarryoverInput({ primaryEntrainment: 0.01 }),
        })
      );

      expect(result.carryover!.primaryEntrainmentSource).toBe('user');
      expect(result.carryover!.primaryEntrainment).toBe(0.01);
    });

    it('should calculate distillate TDS = netCarryover × brineSalinity', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          carryover: createCarryoverInput({
            brineSalinity: 70000,
            primaryEntrainment: 0.01, // 1%
          }),
        })
      );

      const expectedTDS = result.carryover!.netCarryover * 70000;
      expect(result.carryover!.distillateTDS).toBeCloseTo(expectedTDS, 6);
    });

    it('should calculate netCarryover = primaryEntrainment × (1 - efficiency)', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          carryover: createCarryoverInput({ primaryEntrainment: 0.01 }),
        })
      );

      const expectedNet = 0.01 * (1 - result.carryover!.demisterEfficiency);
      expect(result.carryover!.netCarryover).toBeCloseTo(expectedNet, 10);
    });

    it('should calculate carryoverMassFlow = netCarryover × vaporMassFlow', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          vaporMassFlow: 3.0,
          carryover: createCarryoverInput({ primaryEntrainment: 0.01 }),
        })
      );

      const expectedMassFlow = result.carryover!.netCarryover * 3.0;
      expect(result.carryover!.carryoverMassFlow).toBeCloseTo(expectedMassFlow, 10);
    });

    it('should assess excellent quality for low TDS', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          designMargin: 0.7, // lower loading → less entrainment
          carryover: createCarryoverInput({
            brineSalinity: 35000,
            primaryEntrainment: 0.001, // very low
          }),
        })
      );

      // With 0.1% entrainment and ~99.5% efficiency → net ≈ 0.0005%
      // TDS ≈ 0.000005 × 35000 = 0.175 ppm
      expect(result.carryover!.distillateTDS).toBeLessThan(5);
      expect(result.carryover!.qualityAssessment).toBe('excellent');
    });

    it('should assess poor quality for high TDS', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          designMargin: 0.95, // high loading
          demisterType: 'vane', // lower efficiency
          carryover: createCarryoverInput({
            brineSalinity: 120000,
            primaryEntrainment: 0.05, // 5% — very high
          }),
        })
      );

      // High entrainment + degraded efficiency → poor quality
      expect(result.carryover!.distillateTDS).toBeGreaterThan(25);
      expect(result.carryover!.qualityAssessment).toBe('poor');
    });

    it('should warn about high loading affecting carryover', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          designMargin: 0.95,
          carryover: createCarryoverInput(),
        })
      );

      expect(result.carryover!.warnings).toContainEqual(expect.stringContaining('90%'));
    });

    it('should warn about low loading affecting carryover', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          designMargin: 0.3,
          carryover: createCarryoverInput(),
        })
      );

      expect(result.carryover!.warnings).toContainEqual(expect.stringContaining('40%'));
    });

    it('should warn about very high brine salinity', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          carryover: createCarryoverInput({ brineSalinity: 150000 }),
        })
      );

      expect(result.carryover!.warnings).toContainEqual(expect.stringContaining('100,000 ppm'));
    });

    it('should produce higher carryover with vane vs wire mesh', () => {
      const wireMesh = calculateDemisterSizing(
        createValidInput({
          demisterType: 'wire_mesh',
          carryover: createCarryoverInput({ primaryEntrainment: 0.01 }),
        })
      );
      const vane = calculateDemisterSizing(
        createValidInput({
          demisterType: 'vane',
          carryover: createCarryoverInput({ primaryEntrainment: 0.01 }),
        })
      );

      // Wire mesh has higher nominal efficiency than vane
      expect(wireMesh.carryover!.demisterEfficiency).toBeGreaterThan(
        vane.carryover!.demisterEfficiency
      );
      expect(wireMesh.carryover!.netCarryover).toBeLessThan(vane.carryover!.netCarryover);
    });

    it('should handle zero brine salinity', () => {
      const result = calculateDemisterSizing(
        createValidInput({
          carryover: createCarryoverInput({ brineSalinity: 0 }),
        })
      );

      expect(result.carryover!.distillateTDS).toBe(0);
      expect(result.carryover!.qualityAssessment).toBe('excellent');
    });
  });

  // ============================================================================
  // Demister Efficiency Model
  // ============================================================================

  describe('calculateDemisterEfficiency', () => {
    it('should return nominal efficiency at typical loading', () => {
      const efficiency = calculateDemisterEfficiency('wire_mesh', 0.8);
      expect(efficiency).toBe(DEMISTER_EFFICIENCY.wire_mesh.nominal);
    });

    it('should return nominal efficiency at boundary (40–90%)', () => {
      expect(calculateDemisterEfficiency('wire_mesh', 0.4)).toBe(
        DEMISTER_EFFICIENCY.wire_mesh.nominal
      );
      expect(calculateDemisterEfficiency('wire_mesh', 0.9)).toBe(
        DEMISTER_EFFICIENCY.wire_mesh.nominal
      );
    });

    it('should degrade efficiency below 40% loading', () => {
      const low = calculateDemisterEfficiency('wire_mesh', 0.2);
      const nominal = calculateDemisterEfficiency('wire_mesh', 0.8);

      expect(low).toBeLessThan(nominal);
      expect(low).toBeGreaterThan(0); // still positive
    });

    it('should degrade efficiency above 90% loading', () => {
      const high = calculateDemisterEfficiency('wire_mesh', 1.1);
      const nominal = calculateDemisterEfficiency('wire_mesh', 0.8);

      expect(high).toBeLessThan(nominal);
      expect(high).toBeGreaterThan(0);
    });

    it('should never go below 30% of nominal', () => {
      const veryHigh = calculateDemisterEfficiency('wire_mesh', 2.0);
      const nominal = DEMISTER_EFFICIENCY.wire_mesh.nominal;

      expect(veryHigh).toBeGreaterThanOrEqual(nominal * 0.3);
    });
  });

  // ============================================================================
  // Primary Entrainment Estimation
  // ============================================================================

  describe('estimatePrimaryEntrainment', () => {
    it('should increase with loading fraction', () => {
      const low = estimatePrimaryEntrainment(0.4);
      const mid = estimatePrimaryEntrainment(0.8);
      const high = estimatePrimaryEntrainment(1.0);

      expect(mid).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(mid);
    });

    it('should return reasonable values at design loading', () => {
      const e = estimatePrimaryEntrainment(0.8);
      // Typical: 0.1–2% at 80% loading
      expect(e).toBeGreaterThan(0.001);
      expect(e).toBeLessThan(0.05);
    });

    it('should return very low values at low loading', () => {
      const e = estimatePrimaryEntrainment(0.3);
      expect(e).toBeLessThan(0.001);
    });

    it('should handle near-zero loading gracefully', () => {
      const e = estimatePrimaryEntrainment(0.01);
      expect(e).toBeGreaterThan(0);
      expect(isFinite(e)).toBe(true);
    });
  });

  // ============================================================================
  // Input Validation
  // ============================================================================

  describe('input validation', () => {
    it('should throw for zero vapor mass flow', () => {
      expect(() => calculateDemisterSizing(createValidInput({ vaporMassFlow: 0 }))).toThrow(
        'Vapor mass flow must be positive'
      );
    });

    it('should throw for negative vapor mass flow', () => {
      expect(() => calculateDemisterSizing(createValidInput({ vaporMassFlow: -1 }))).toThrow(
        'Vapor mass flow must be positive'
      );
    });

    it('should throw for zero vapor density', () => {
      expect(() => calculateDemisterSizing(createValidInput({ vaporDensity: 0 }))).toThrow(
        'Vapor density must be positive'
      );
    });

    it('should throw when liquid density <= vapor density', () => {
      expect(() =>
        calculateDemisterSizing(createValidInput({ vaporDensity: 1000, liquidDensity: 500 }))
      ).toThrow('Liquid density must be greater than vapor density');
    });

    it('should throw for design margin > 1', () => {
      expect(() => calculateDemisterSizing(createValidInput({ designMargin: 1.5 }))).toThrow(
        'Design margin must be between 0 and 1'
      );
    });

    it('should throw for design margin <= 0', () => {
      expect(() => calculateDemisterSizing(createValidInput({ designMargin: 0 }))).toThrow(
        'Design margin must be between 0 and 1'
      );
    });

    it('should throw for negative pad thickness', () => {
      expect(() => calculateDemisterSizing(createValidInput({ padThickness: -10 }))).toThrow(
        'Pad thickness must be positive'
      );
    });

    it('should throw for negative brine salinity', () => {
      expect(() =>
        calculateDemisterSizing(createValidInput({ carryover: { brineSalinity: -100 } }))
      ).toThrow('Brine salinity must be non-negative');
    });

    it('should throw for entrainment out of range', () => {
      expect(() =>
        calculateDemisterSizing(
          createValidInput({
            carryover: { brineSalinity: 70000, primaryEntrainment: 1.5 },
          })
        )
      ).toThrow('Primary entrainment must be between 0 and 1');
    });
  });

  // ============================================================================
  // Constants Integrity
  // ============================================================================

  describe('constants', () => {
    it('should have K factors for all 4 types and both orientations', () => {
      const types = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'] as const;
      for (const type of types) {
        expect(DEMISTER_K_FACTORS[type].horizontal).toBeGreaterThan(0);
        expect(DEMISTER_K_FACTORS[type].vertical).toBeGreaterThan(0);
        // Horizontal K should be >= vertical K
        expect(DEMISTER_K_FACTORS[type].horizontal).toBeGreaterThanOrEqual(
          DEMISTER_K_FACTORS[type].vertical
        );
      }
    });

    it('should have pressure drop ranges for all types', () => {
      const types = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'] as const;
      for (const type of types) {
        expect(DEMISTER_PRESSURE_DROP[type].min).toBeGreaterThan(0);
        expect(DEMISTER_PRESSURE_DROP[type].max).toBeGreaterThan(DEMISTER_PRESSURE_DROP[type].min);
      }
    });

    it('should have efficiency data for all types', () => {
      const types = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'] as const;
      for (const type of types) {
        expect(DEMISTER_EFFICIENCY[type].nominal).toBeGreaterThan(0.9);
        expect(DEMISTER_EFFICIENCY[type].nominal).toBeLessThanOrEqual(1);
        expect(DEMISTER_EFFICIENCY[type].minDroplet_um).toBeGreaterThan(0);
      }
    });

    it('should have DP model coefficients for all types', () => {
      const types = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'] as const;
      for (const type of types) {
        expect(DP_MODEL[type].C).toBeGreaterThan(0);
        expect(DP_MODEL[type].n).toBeGreaterThan(0);
        expect(DP_MODEL[type].tRef_mm).toBeGreaterThan(0);
      }
    });

    it('should have default pad thickness for all types', () => {
      const types = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'] as const;
      for (const type of types) {
        expect(DEFAULT_PAD_THICKNESS[type]).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Carryover Comparison
  // ============================================================================

  describe('calculateCarryoverComparison', () => {
    it('should return 5 rows (no demister + 4 types)', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);
      expect(rows).toHaveLength(5);
    });

    it('should have "No Demister" as the first row', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);
      const first = rows[0]!;
      expect(first.label).toBe('No Demister');
      expect(first.type).toBeNull();
      expect(first.efficiency).toBe(0);
    });

    it('should show worst TDS for no demister', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);
      const noDemister = rows[0]!;

      // No demister: TDS = entrainment × salinity
      expect(noDemister.distillateTDS).toBeCloseTo(0.005 * 70000, 6);

      // All demister types should have lower TDS
      for (const row of rows.slice(1)) {
        expect(row.distillateTDS).toBeLessThan(noDemister.distillateTDS);
      }
    });

    it('should include all 4 demister types', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);
      const types = rows.slice(1).map((r) => r.type);

      expect(types).toContain('wire_mesh');
      expect(types).toContain('wire_mesh_hc');
      expect(types).toContain('vane');
      expect(types).toContain('structured');
    });

    it('should rank structured packing as highest efficiency', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);
      const structured = rows.find((r) => r.type === 'structured')!;

      for (const row of rows) {
        if (row.type !== null && row.type !== 'structured') {
          expect(structured.efficiency).toBeGreaterThanOrEqual(row.efficiency);
        }
      }
    });

    it('should have minDroplet_um for demister types and null for no-demister', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);

      expect(rows[0]!.minDroplet_um).toBeNull();
      for (const row of rows.slice(1)) {
        expect(row.minDroplet_um).toBeGreaterThan(0);
      }
    });

    it('should produce zero TDS when salinity is zero', () => {
      const rows = calculateCarryoverComparison(0.005, 0, 0.8);

      for (const row of rows) {
        expect(row.distillateTDS).toBe(0);
        expect(row.qualityAssessment).toBe('excellent');
      }
    });

    it('should have quality assessment for every row', () => {
      const rows = calculateCarryoverComparison(0.005, 70000, 0.8);
      const validAssessments = ['excellent', 'good', 'marginal', 'poor'];

      for (const row of rows) {
        expect(validAssessments).toContain(row.qualityAssessment);
      }
    });
  });
});

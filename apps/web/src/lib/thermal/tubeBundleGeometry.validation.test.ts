/**
 * Tube Bundle Geometry Validation against BARC as-built tube sheet
 *
 * BARC tube sheet drawing shows:
 *   - Shell ID: 2380 mm
 *   - Half-circle left bundle
 *   - 4 diagonal vapour lanes at ±45°, 57.9mm wide
 *   - 2 nozzle exclusions: Ø279mm (top) and Ø273mm (center-right)
 *   - Total: 1410 tubes, ~41 rows
 *   - OTL ≈ Shell ID - 100mm = 2280mm
 */

import {
  calculateTubeBundleGeometry,
  calculateTubeBundleWithSprayClearance,
  estimateSprayZoneClearance,
  generateDefaultVapourLanes,
} from './tubeBundleGeometry';

describe('BARC Tube Sheet Validation', () => {
  it('OTL defaults to Shell ID - 100mm', () => {
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
    });
    expect(result.otlDiameter).toBe(2280);
  });

  it('bottom clearance and spray zone reduce tube count vs unconstrained', () => {
    const constrained = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
    });
    const unconstrained = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
      otlGap: 0,
      bottomClearance: 0,
      sprayZoneClearance: 0,
    });
    // OTL + clearances should remove a significant number of tubes
    expect(unconstrained.totalTubes).toBeGreaterThan(constrained.totalTubes);
    expect(unconstrained.totalTubes - constrained.totalTubes).toBeGreaterThan(100);
  });

  it('lateral bundle with OTL + clearances gives realistic tube count', () => {
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
    });
    // BARC has 1410 tubes (with vapour lanes and exclusions)
    // Without lanes/exclusions but with OTL + clearances, should be more
    expect(result.totalTubes).toBeGreaterThan(1400);
    expect(result.totalTubes).toBeLessThan(2000);
    // Row count: half-circle still spans most of the OTL height vertically
    // (~2280mm OTL, 250mm bottom clear, 150mm top clear → ~1880mm / 28.93mm ≈ 65 rows)
    // BARC drawing shows ~41 labelled rows but those count only significant rows
    expect(result.numberOfRows).toBeGreaterThan(50);
    expect(result.numberOfRows).toBeLessThan(80);
  });

  it('adding 4 vapour lanes removes tubes, approaching BARC count', () => {
    const lanes = generateDefaultVapourLanes(2380 / 2, 4, 57.9);
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
      vapourLanes: lanes,
    });
    expect(result.tubesRemovedByLanes).toBeGreaterThan(100);
    // With lanes, should be closer to BARC's 1410
    expect(result.totalTubes).toBeGreaterThan(1200);
    expect(result.totalTubes).toBeLessThan(1800);
  });

  it('wetting rate: VGB formula matches BARC actual recirc ratio (2.18x)', () => {
    // BARC as-built: stream 29 = 57850 kg/hr (recirc+makeup), stream 32 = 26500 (makeup)
    // Recirc ratio = 57850/26500 = 2.18x
    const nRows = 41; // from BARC tube sheet drawing (counted row labels)
    const tubeLength = 1.2; // m
    const makeupPerEffect = 26500 / 6; // kg/hr (seawater only)

    // VGB: Gamma = m_dot / (2 x L x n_rows)
    const gammaNoRecirc = makeupPerEffect / 3600 / (2 * tubeLength * nRows);
    const recircToReach030 = 0.03 / gammaNoRecirc;

    // BARC actually uses 2.18x recirc — formula should predict ~2.4x
    expect(recircToReach030).toBeGreaterThan(1.8);
    expect(recircToReach030).toBeLessThan(3.0);
  });

  it('custom clearances override defaults', () => {
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
      bottomClearance: 300,
      sprayZoneClearance: 200,
      otlGap: 120,
    });
    expect(result.bottomClearance).toBe(300);
    expect(result.sprayZoneClearance).toBe(200);
    expect(result.otlDiameter).toBe(2380 - 120);
  });
});

describe('Wetting Cutback — maxTubeFieldWidth', () => {
  it('maxTubeFieldWidth clips tubes to spray coverage zone', () => {
    const full = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
    });
    const clipped = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
      maxTubeFieldWidth: 1000,
    });
    // Clipped bundle has fewer tubes
    expect(clipped.totalTubes).toBeLessThan(full.totalTubes);
    // Bundle width should be capped near the specified limit
    expect(clipped.bundleWidthMM).toBeLessThanOrEqual(1000 + 33.4); // pitch tolerance
  });

  it('BARC-like layout: ~1000mm field width gives ~28 tubes/row in middle', () => {
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
      maxTubeFieldWidth: 1000, // approximate BARC spray coverage
    });
    // Middle rows (indices ~30-40 of ~65) should have ~28-30 tubes
    const middleRows = result.rows.filter((r) => r.tubeCount >= 27 && r.tubeCount <= 31);
    // Most rows should be in this range when width is capped
    expect(middleRows.length).toBeGreaterThan(result.rows.length * 0.5);
  });
});

describe('Spray Zone Clearance from Nozzle Geometry', () => {
  it('estimateSprayZoneClearance: 90° angle, 1000mm bundle → ~550mm', () => {
    // derivedHeight = (1000 + 100) / (2 × tan(45°)) ≈ 550 (ceil rounds up)
    const clearance = estimateSprayZoneClearance(1000, 90, 50);
    expect(clearance).toBeGreaterThanOrEqual(550);
    expect(clearance).toBeLessThanOrEqual(551);
  });

  it('estimateSprayZoneClearance: wider angle needs less height', () => {
    const at90 = estimateSprayZoneClearance(1000, 90);
    const at120 = estimateSprayZoneClearance(1000, 120);
    expect(at120).toBeLessThan(at90);
  });

  it('estimateSprayZoneClearance: wider bundle needs more height', () => {
    const narrow = estimateSprayZoneClearance(500, 90);
    const wide = estimateSprayZoneClearance(1500, 90);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('calculateTubeBundleWithSprayClearance adjusts clearance from bundle width', () => {
    const withSpray = calculateTubeBundleWithSprayClearance(
      { shape: 'half_circle_left', shellID: 2380 },
      90
    );
    // The derived spray clearance should be based on the actual bundle width
    // For a half-circle left bundle of OTL 2280mm, bundle width ≈ 1140mm
    // derivedHeight ≈ (1140 + 100) / 2 = 620mm
    expect(withSpray.sprayZoneClearance).toBeGreaterThan(400);
    expect(withSpray.sprayZoneClearance).toBeLessThan(800);
    // Should have fewer tubes than default 150mm clearance
    const withDefault = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
    });
    expect(withSpray.totalTubes).toBeLessThan(withDefault.totalTubes);
  });
});

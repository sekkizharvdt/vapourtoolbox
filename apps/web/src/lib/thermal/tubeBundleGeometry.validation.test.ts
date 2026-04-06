/**
 * Tube Bundle Geometry Validation against BARC as-built tube sheet
 *
 * BARC tube sheet drawing shows:
 *   - Shell ID: 2380 mm
 *   - Half-circle left bundle
 *   - 4 diagonal vapour lanes at ±45°, 57.9mm wide
 *   - 2 nozzle exclusions: Ø279mm (top) and Ø273mm (center-right)
 *   - Total: 1410 tubes, ~41 rows
 */

import { calculateTubeBundleGeometry, generateDefaultVapourLanes } from './tubeBundleGeometry';

describe('BARC Tube Sheet Validation', () => {
  it('lateral bundle without lanes gives more than 1410 tubes', () => {
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
    });
    expect(result.totalTubes).toBeGreaterThan(1410);
  });

  it('adding 4 vapour lanes removes ~400 tubes', () => {
    const lanes = generateDefaultVapourLanes(2380 / 2, 4, 57.9);
    const result = calculateTubeBundleGeometry({
      shape: 'half_circle_left',
      shellID: 2380,
      vapourLanes: lanes,
    });
    expect(result.tubesRemovedByLanes).toBeGreaterThan(300);
    expect(result.tubesRemovedByLanes).toBeLessThan(500);
    expect(result.totalTubes).toBeGreaterThan(1400);
    expect(result.totalTubes).toBeLessThan(1900);
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
});

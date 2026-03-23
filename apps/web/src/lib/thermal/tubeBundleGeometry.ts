/**
 * Tube Bundle Geometry Engine
 *
 * Shared module for counting and laying out horizontal tubes within various
 * boundary shapes using equilateral-triangular pitch. Supports:
 *   - Full-circle bundles (standard shell-and-tube)
 *   - Half-circle (lateral) bundles with diagonal vapour lanes
 *   - Rectangular (central) bundles within a cylindrical shell
 *   - Custom user-defined bundles
 *
 * Geometry reference (from tube hole marking detail):
 *   Tube OD:          25.4 mm (default)
 *   Tube hole:        28.4 mm (for rubber grommet)
 *   Triangular pitch: 33.4 mm (centre-to-centre)
 *   Row spacing:      28.93 mm (pitch × sin 60°)
 *   Edge clearance:   4.6 mm (CL of tube sheet to tube hole centre)
 *   Ligament:         1.7 mm (tube hole edge to tube sheet edge)
 */

import { MED_TUBE_GEOMETRY } from '@vapour/constants';

// ============================================================================
// Types
// ============================================================================

/** A single tube position in the bundle */
export interface TubePosition {
  /** Column index within the row */
  col: number;
  /** Row index (0 = topmost) */
  row: number;
  /** X position of tube centre in mm (relative to bundle origin) */
  x: number;
  /** Y position of tube centre in mm (relative to bundle origin) */
  y: number;
}

/** Per-row summary */
export interface RowInfo {
  /** Row index (0 = topmost) */
  row: number;
  /** Y position of tube centres in this row (mm) */
  y: number;
  /** Number of tubes in this row */
  tubeCount: number;
  /** Whether this is a staggered (offset) row */
  isStaggered: boolean;
}

/** Diagonal vapour lane specification */
export interface VapourLane {
  /** Angle in degrees from horizontal (typically 45°) */
  angleDeg: number;
  /** Width of the lane measured perpendicular to its direction, in mm */
  width: number;
  /** X position of the lane's reference point (centre of the lane at y=0) */
  xRef: number;
}

/** Circular exclusion zone (e.g. nozzle penetration) */
export interface ExclusionZone {
  /** Centre X in mm */
  cx: number;
  /** Centre Y in mm */
  cy: number;
  /** Exclusion diameter in mm */
  diameter: number;
}

/** Bundle boundary shape */
export type BundleShape = 'full_circle' | 'half_circle_left' | 'half_circle_right' | 'rectangle';

/** Input for the tube bundle geometry calculator */
export interface TubeBundleGeometryInput {
  /** Bundle boundary shape */
  shape: BundleShape;

  /** Shell inner diameter in mm (for circle/half-circle shapes) */
  shellID?: number;

  /** Bundle width in mm (for rectangle shape) */
  bundleWidth?: number;
  /** Bundle height in mm (for rectangle shape) */
  bundleHeight?: number;

  // --- Tube geometry (defaults from MED_TUBE_GEOMETRY) ---
  /** Tube outer diameter in mm */
  tubeOD?: number;
  /** Tube hole diameter in mm (for grommet) */
  tubeHoleDiameter?: number;
  /** Triangular pitch in mm */
  pitch?: number;
  /** Edge clearance in mm (CL of tube sheet to first tube hole centre) */
  edgeClearance?: number;

  // --- Optional features ---
  /** Diagonal vapour escape lanes */
  vapourLanes?: VapourLane[];
  /** Nozzle penetration exclusion zones */
  exclusionZones?: ExclusionZone[];
}

/** Result of tube bundle geometry calculation */
export interface TubeBundleGeometryResult {
  /** Total number of tubes */
  totalTubes: number;
  /** Row-by-row summary */
  rows: RowInfo[];
  /** All tube positions */
  tubes: TubePosition[];
  /** Total heat transfer area in m² (per unit tube length in m) */
  areaPerMeter: number;
  /** Bundle bounding box width in mm */
  bundleWidthMM: number;
  /** Bundle bounding box height in mm */
  bundleHeightMM: number;
  /** Number of rows */
  numberOfRows: number;
  /** Tubes removed by vapour lanes */
  tubesRemovedByLanes: number;
  /** Tubes removed by exclusion zones */
  tubesRemovedByExclusions: number;
  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a tube centre at (x, y) falls inside the given boundary.
 * Coordinates are relative to the centre of the shell (for circular shapes)
 * or the bottom-left corner (for rectangles).
 */
function isInsideBoundary(
  x: number,
  y: number,
  shape: BundleShape,
  shellRadius: number,
  bundleWidth: number,
  bundleHeight: number,
  tubeHoleRadius: number,
  edgeClearance: number
): boolean {
  switch (shape) {
    case 'full_circle': {
      // Tube hole must fit within the shell (with edge clearance)
      const maxR = shellRadius - edgeClearance - tubeHoleRadius;
      return x * x + y * y <= maxR * maxR;
    }
    case 'half_circle_left': {
      // Left half: x <= 0, within circular boundary
      const maxR = shellRadius - edgeClearance - tubeHoleRadius;
      if (x > tubeHoleRadius) return false; // must be on left side (allow tubes near centreline)
      return x * x + y * y <= maxR * maxR;
    }
    case 'half_circle_right': {
      // Right half: x >= 0, within circular boundary
      const maxR = shellRadius - edgeClearance - tubeHoleRadius;
      if (x < -tubeHoleRadius) return false;
      return x * x + y * y <= maxR * maxR;
    }
    case 'rectangle': {
      // Rectangle centred at origin
      const hw = bundleWidth / 2 - edgeClearance - tubeHoleRadius;
      const hh = bundleHeight / 2 - edgeClearance - tubeHoleRadius;
      return Math.abs(x) <= hw && Math.abs(y) <= hh;
    }
    default:
      return false;
  }
}

/**
 * Check if a tube at (x, y) falls inside a diagonal vapour lane.
 * The lane is an infinite strip at the given angle, centred on xRef at y=0.
 */
function isInVapourLane(x: number, y: number, lane: VapourLane, tubeHoleRadius: number): boolean {
  const angleRad = (lane.angleDeg * Math.PI) / 180;
  // Direction vector along the lane
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  // Perpendicular distance from the lane centreline
  const perpDist = Math.abs((x - lane.xRef) * dy - y * dx);
  // Tube hole must clear the lane (half-width + hole radius)
  return perpDist < lane.width / 2 + tubeHoleRadius;
}

/**
 * Check if a tube at (x, y) falls inside an exclusion zone.
 */
function isInExclusionZone(
  x: number,
  y: number,
  zone: ExclusionZone,
  tubeHoleRadius: number
): boolean {
  const dx = x - zone.cx;
  const dy = y - zone.cy;
  const minDist = zone.diameter / 2 + tubeHoleRadius;
  return dx * dx + dy * dy < minDist * minDist;
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate tube positions for a bundle within the specified boundary.
 *
 * Uses equilateral-triangular pitch layout. Even rows are un-shifted,
 * odd rows are shifted by pitch/2 in the X direction.
 *
 * @param input Bundle geometry parameters
 * @returns Tube positions, row summaries, and area
 */
export function calculateTubeBundleGeometry(
  input: TubeBundleGeometryInput
): TubeBundleGeometryResult {
  const warnings: string[] = [];

  // Resolve defaults from MED_TUBE_GEOMETRY
  const tubeOD = input.tubeOD ?? 25.4;
  const tubeHoleDia = input.tubeHoleDiameter ?? MED_TUBE_GEOMETRY.tubeHoleDiameter;
  const pitch = input.pitch ?? MED_TUBE_GEOMETRY.pitch;
  const edgeClearance = input.edgeClearance ?? MED_TUBE_GEOMETRY.edgeClearance;
  const tubeHoleRadius = tubeHoleDia / 2;

  // Row spacing for equilateral triangular pitch
  const rowSpacing = pitch * Math.sin((60 * Math.PI) / 180); // pitch × sin(60°)

  // Shell/boundary dimensions
  const shellID = input.shellID ?? 0;
  const shellRadius = shellID / 2;
  const bWidth = input.bundleWidth ?? 0;
  const bHeight = input.bundleHeight ?? 0;

  // Validate
  if (
    (input.shape === 'full_circle' ||
      input.shape === 'half_circle_left' ||
      input.shape === 'half_circle_right') &&
    shellID <= 0
  ) {
    throw new Error('Shell ID must be > 0 for circular bundle shapes');
  }
  if (input.shape === 'rectangle' && (bWidth <= 0 || bHeight <= 0)) {
    throw new Error('Bundle width and height must be > 0 for rectangular shape');
  }

  // Determine the vertical extent of tube positions
  let yMin: number;
  let yMax: number;
  if (input.shape === 'rectangle') {
    yMin = -(bHeight / 2 - edgeClearance - tubeHoleRadius);
    yMax = bHeight / 2 - edgeClearance - tubeHoleRadius;
  } else {
    const maxR = shellRadius - edgeClearance - tubeHoleRadius;
    yMin = -maxR;
    yMax = maxR;
  }

  // Generate rows from yMin to yMax
  const allTubes: TubePosition[] = [];
  const rowInfos: RowInfo[] = [];
  let tubesRemovedByLanes = 0;
  let tubesRemovedByExclusions = 0;

  // Start from the top (yMax) and go down by rowSpacing
  let rowIndex = 0;
  for (let y = yMax; y >= yMin; y -= rowSpacing) {
    const isStaggered = rowIndex % 2 === 1;
    const xOffset = isStaggered ? pitch / 2 : 0;

    // Determine horizontal extent for this row
    let xMin: number;
    let xMax: number;
    if (input.shape === 'rectangle') {
      xMin = -(bWidth / 2 - edgeClearance - tubeHoleRadius);
      xMax = bWidth / 2 - edgeClearance - tubeHoleRadius;
    } else {
      // For circular shapes, compute the horizontal chord at this y
      const maxR = shellRadius - edgeClearance - tubeHoleRadius;
      const chord = maxR * maxR - y * y;
      if (chord < 0) {
        rowIndex++;
        continue;
      }
      const halfChord = Math.sqrt(chord);

      if (input.shape === 'half_circle_left') {
        xMin = -halfChord;
        xMax = Math.min(halfChord, tubeHoleRadius); // allow tubes near centreline
      } else if (input.shape === 'half_circle_right') {
        xMin = Math.max(-halfChord, -tubeHoleRadius);
        xMax = halfChord;
      } else {
        xMin = -halfChord;
        xMax = halfChord;
      }
    }

    // Generate tube positions along this row
    const rowTubes: TubePosition[] = [];
    let col = 0;

    // Start from xMin, snap to pitch grid
    const startX = Math.ceil((xMin - xOffset) / pitch) * pitch + xOffset;

    for (let x = startX; x <= xMax; x += pitch) {
      // Check boundary
      if (
        !isInsideBoundary(
          x,
          y,
          input.shape,
          shellRadius,
          bWidth,
          bHeight,
          tubeHoleRadius,
          edgeClearance
        )
      ) {
        continue;
      }

      // Check vapour lanes
      let inLane = false;
      if (input.vapourLanes) {
        for (const lane of input.vapourLanes) {
          if (isInVapourLane(x, y, lane, tubeHoleRadius)) {
            inLane = true;
            tubesRemovedByLanes++;
            break;
          }
        }
      }
      if (inLane) continue;

      // Check exclusion zones
      let inExclusion = false;
      if (input.exclusionZones) {
        for (const zone of input.exclusionZones) {
          if (isInExclusionZone(x, y, zone, tubeHoleRadius)) {
            inExclusion = true;
            tubesRemovedByExclusions++;
            break;
          }
        }
      }
      if (inExclusion) continue;

      rowTubes.push({ col, row: rowIndex, x, y });
      col++;
    }

    if (rowTubes.length > 0) {
      rowInfos.push({
        row: rowIndex,
        y,
        tubeCount: rowTubes.length,
        isStaggered,
      });
      allTubes.push(...rowTubes);
    }

    rowIndex++;
  }

  // Calculate bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const t of allTubes) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }
  const bundleWidthMM = allTubes.length > 0 ? maxX - minX + tubeOD : 0;
  const bundleHeightMM = allTubes.length > 0 ? maxY - minY + tubeOD : 0;

  // Area per meter of tube length
  const areaPerMeter = allTubes.length * Math.PI * (tubeOD / 1000); // m² per m of tube length

  if (allTubes.length === 0) {
    warnings.push('No tubes fit within the specified boundary. Check dimensions.');
  }

  // Drainage clearance check for circular shells (lateral bundles)
  // Minimum 250mm clearance below the lowest tube row for brine collection
  if (
    (input.shape === 'half_circle_left' ||
      input.shape === 'half_circle_right' ||
      input.shape === 'full_circle') &&
    shellID > 0 &&
    allTubes.length > 0
  ) {
    const shellRadius = shellID / 2;
    const lowestTubeY = minY - tubeOD / 2; // bottom edge of lowest tube
    const drainageClearance = shellRadius + lowestTubeY; // distance from shell bottom to lowest tube
    if (drainageClearance < 250) {
      warnings.push(
        `Drainage clearance below bundle is ${Math.round(drainageClearance)}mm (minimum 250mm recommended for brine collection).`
      );
    }
  }

  return {
    totalTubes: allTubes.length,
    rows: rowInfos,
    tubes: allTubes,
    areaPerMeter,
    bundleWidthMM,
    bundleHeightMM,
    numberOfRows: rowInfos.length,
    tubesRemovedByLanes,
    tubesRemovedByExclusions,
    warnings,
  };
}

/**
 * Calculate heat transfer surface area for the bundle given tube length.
 *
 * @param totalTubes Number of tubes
 * @param tubeOD Tube outer diameter in mm
 * @param tubeLength Tube length in m
 * @returns Surface area in m²
 */
export function calculateBundleArea(
  totalTubes: number,
  tubeOD: number,
  tubeLength: number
): number {
  return totalTubes * Math.PI * (tubeOD / 1000) * tubeLength;
}

/**
 * Generate default vapour lanes matching the reference lateral bundle drawing.
 * The drawing shows diagonal cuts at approximately 45° through the tube field,
 * creating vapour escape passages.
 *
 * @param shellRadius Shell inner radius in mm
 * @param numberOfLanes Number of diagonal lanes (typically 3-5)
 * @param laneWidth Width of each lane in mm (typically 50-80 mm)
 * @returns Array of VapourLane specifications
 */
export function generateDefaultVapourLanes(
  shellRadius: number,
  numberOfLanes: number = 4,
  laneWidth: number = 60
): VapourLane[] {
  const lanes: VapourLane[] = [];
  const bundleHeight = shellRadius * 2 * 0.8; // approximate usable height
  const spacing = bundleHeight / (numberOfLanes + 1);

  for (let i = 1; i <= numberOfLanes; i++) {
    // Distribute lanes evenly, alternating +45° and -45°
    const yOffset = -bundleHeight / 2 + i * spacing;
    lanes.push({
      angleDeg: i % 2 === 0 ? 45 : -45,
      width: laneWidth,
      xRef: yOffset * 0.3, // slight x offset to stagger lanes
    });
  }

  return lanes;
}

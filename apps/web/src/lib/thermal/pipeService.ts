/**
 * Pipe Service for Thermal Desalination Module
 *
 * Provides utilities to query and select pipe sizes from the existing
 * materials database (ASME B36.10 compliant data).
 *
 * Uses Schedule 40 pipes by default for flash chamber nozzle sizing.
 */

import { collection, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { Material } from '@vapour/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Expected structure of pipe variant data from Firestore
 * This represents the pipe-specific fields stored in the materials database
 */
interface PipeMaterialVariant {
  nps: string;
  dn: string;
  schedule?: string;
  scheduleType?: string;
  od_mm: number;
  wt_mm: number;
  weight_kgm?: number;
}

/**
 * Type guard to check if a value is a valid PipeMaterialVariant
 */
function isPipeMaterialVariant(value: unknown): value is PipeMaterialVariant {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.nps === 'string' &&
    typeof v.dn === 'string' &&
    typeof v.od_mm === 'number' &&
    typeof v.wt_mm === 'number'
  );
}

/**
 * Safely extract pipe variants from material data
 */
function extractPipeVariants(variants: unknown): PipeMaterialVariant[] {
  if (!Array.isArray(variants)) return [];
  return variants.filter(isPipeMaterialVariant);
}

/**
 * Pipe variant with calculated dimensions
 */
export interface PipeVariant {
  /** Nominal Pipe Size (e.g., "1/2", "3/4", "1", "2") */
  nps: string;

  /** Metric nominal diameter (e.g., "15", "50", "100") */
  dn: string;

  /** Schedule (e.g., "40", "80") */
  schedule: string;

  /** Schedule type alias (e.g., "STD", "XS") */
  scheduleType?: string;

  /** Outer diameter in mm */
  od_mm: number;

  /** Wall thickness in mm */
  wt_mm: number;

  /** Inner diameter in mm (calculated: OD - 2*WT) */
  id_mm: number;

  /** Cross-sectional flow area in mm² */
  area_mm2: number;

  /** Weight per meter in kg/m */
  weight_kgm: number;
}

/**
 * Selected pipe result with sizing information
 */
export interface SelectedPipe extends PipeVariant {
  /** Display name for UI (e.g., "2 inch Sch 40") */
  displayName: string;

  /** Whether this is an exact match or next larger size */
  isExactMatch: boolean;
}

// ============================================================================
// Pipe Data Cache
// ============================================================================

/**
 * Cached pipe data to avoid repeated Firestore queries
 */
let cachedSchedule40Pipes: PipeVariant[] | null = null;

/**
 * Clear the pipe cache (useful for testing or data updates)
 */
export function clearPipeCache(): void {
  cachedSchedule40Pipes = null;
}

// ============================================================================
// Standard NPS Order
// ============================================================================

/**
 * Standard NPS sizes in order (for proper sorting)
 */
const NPS_ORDER = [
  '1/8',
  '1/4',
  '3/8',
  '1/2',
  '3/4',
  '1',
  '1-1/4',
  '1-1/2',
  '2',
  '2-1/2',
  '3',
  '3-1/2',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '14',
  '16',
  '18',
  '20',
  '22',
  '24',
  '26',
  '28',
  '30',
  '32',
  '34',
  '36',
  '42',
  '48',
];

/**
 * Get NPS sort index for ordering
 */
function getNPSSortIndex(nps: string): number {
  const index = NPS_ORDER.indexOf(nps);
  return index >= 0 ? index : 999;
}

// ============================================================================
// Pipe Query Functions
// ============================================================================

/**
 * Fetch Schedule 40 pipes from Firestore materials database
 *
 * @param db - Firestore instance
 * @returns Array of Schedule 40 pipe variants sorted by size
 */
export async function getSchedule40Pipes(db: Firestore): Promise<PipeVariant[]> {
  // Return cached data if available
  if (cachedSchedule40Pipes) {
    return cachedSchedule40Pipes;
  }

  // Query pipe materials from Firestore
  const materialsRef = collection(db, COLLECTIONS.MATERIALS);
  const q = query(
    materialsRef,
    where('category', '==', 'PIPES_CARBON_STEEL'),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(q);

  const pipes: PipeVariant[] = [];

  snapshot.forEach((doc) => {
    const material = doc.data() as Material;

    // Process variants to extract Schedule 40 pipes
    if (material.variants && Array.isArray(material.variants)) {
      // Material variants are stored with pipe-specific fields
      const pipeVariants = extractPipeVariants(material.variants);

      pipeVariants.forEach((v) => {
        // Only include Schedule 40 (or STD which is equivalent)
        if (v.schedule === '40' || v.scheduleType === 'STD') {
          const od_mm = v.od_mm;
          const wt_mm = v.wt_mm;
          const id_mm = od_mm - 2 * wt_mm;
          const area_mm2 = Math.PI * Math.pow(id_mm / 2, 2);

          pipes.push({
            nps: v.nps,
            dn: v.dn,
            schedule: '40',
            scheduleType: v.scheduleType,
            od_mm,
            wt_mm,
            id_mm,
            area_mm2,
            weight_kgm: v.weight_kgm || 0,
          });
        }
      });
    }
  });

  // Sort by NPS size
  pipes.sort((a, b) => getNPSSortIndex(a.nps) - getNPSSortIndex(b.nps));

  // Remove duplicates (same NPS)
  const uniquePipes: PipeVariant[] = [];
  const seenNPS = new Set<string>();

  for (const pipe of pipes) {
    if (!seenNPS.has(pipe.nps)) {
      seenNPS.add(pipe.nps);
      uniquePipes.push(pipe);
    }
  }

  // Cache the result
  cachedSchedule40Pipes = uniquePipes;

  return uniquePipes;
}

/**
 * Static Schedule 40 pipe data as fallback
 * Used when Firestore data is not available or for offline calculations
 */
export const SCHEDULE_40_PIPES: PipeVariant[] = [
  {
    nps: '1/2',
    dn: '15',
    schedule: '40',
    od_mm: 21.34,
    wt_mm: 2.77,
    id_mm: 15.8,
    area_mm2: 196.1,
    weight_kgm: 1.27,
  },
  {
    nps: '3/4',
    dn: '20',
    schedule: '40',
    od_mm: 26.67,
    wt_mm: 2.87,
    id_mm: 20.93,
    area_mm2: 344.3,
    weight_kgm: 1.68,
  },
  {
    nps: '1',
    dn: '25',
    schedule: '40',
    od_mm: 33.4,
    wt_mm: 3.38,
    id_mm: 26.64,
    area_mm2: 557.4,
    weight_kgm: 2.5,
  },
  {
    nps: '1-1/4',
    dn: '32',
    schedule: '40',
    od_mm: 42.16,
    wt_mm: 3.56,
    id_mm: 35.04,
    area_mm2: 964.5,
    weight_kgm: 3.38,
  },
  {
    nps: '1-1/2',
    dn: '40',
    schedule: '40',
    od_mm: 48.26,
    wt_mm: 3.68,
    id_mm: 40.9,
    area_mm2: 1313.9,
    weight_kgm: 4.05,
  },
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
    nps: '2-1/2',
    dn: '65',
    schedule: '40',
    od_mm: 73.03,
    wt_mm: 5.16,
    id_mm: 62.71,
    area_mm2: 3088.0,
    weight_kgm: 8.62,
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
    nps: '5',
    dn: '125',
    schedule: '40',
    od_mm: 141.3,
    wt_mm: 6.55,
    id_mm: 128.2,
    area_mm2: 12908.6,
    weight_kgm: 21.76,
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
  {
    nps: '10',
    dn: '250',
    schedule: '40',
    od_mm: 273.05,
    wt_mm: 9.27,
    id_mm: 254.51,
    area_mm2: 50870.5,
    weight_kgm: 60.29,
  },
  {
    nps: '12',
    dn: '300',
    schedule: '40',
    od_mm: 323.85,
    wt_mm: 9.53,
    id_mm: 304.79,
    area_mm2: 72966.3,
    weight_kgm: 73.78,
  },
  {
    nps: '14',
    dn: '350',
    schedule: '40',
    od_mm: 355.6,
    wt_mm: 9.53,
    id_mm: 336.54,
    area_mm2: 88929.1,
    weight_kgm: 81.25,
  },
  {
    nps: '16',
    dn: '400',
    schedule: '40',
    od_mm: 406.4,
    wt_mm: 9.53,
    id_mm: 387.34,
    area_mm2: 117854.4,
    weight_kgm: 93.17,
  },
  {
    nps: '18',
    dn: '450',
    schedule: '40',
    od_mm: 457.2,
    wt_mm: 9.53,
    id_mm: 438.14,
    area_mm2: 150796.1,
    weight_kgm: 105.09,
  },
  {
    nps: '20',
    dn: '500',
    schedule: '40',
    od_mm: 508.0,
    wt_mm: 9.53,
    id_mm: 488.94,
    area_mm2: 187754.4,
    weight_kgm: 117.01,
  },
  {
    nps: '24',
    dn: '600',
    schedule: '40',
    od_mm: 609.6,
    wt_mm: 9.53,
    id_mm: 590.54,
    area_mm2: 273820.6,
    weight_kgm: 140.85,
  },
];

// ============================================================================
// Pipe Selection Functions
// ============================================================================

/**
 * Select the appropriate pipe size based on required flow area
 *
 * Selects the smallest standard pipe that meets or exceeds the required area.
 *
 * @param requiredArea - Required flow area in mm²
 * @param availablePipes - Array of available pipe variants (or null to use static data)
 * @returns Selected pipe with display name
 */
export function selectPipeSize(
  requiredArea: number,
  availablePipes?: PipeVariant[] | null
): SelectedPipe {
  const pipes = availablePipes || SCHEDULE_40_PIPES;

  // Find the smallest pipe that meets the required area
  for (const pipe of pipes) {
    if (pipe.area_mm2 >= requiredArea) {
      return {
        ...pipe,
        displayName: `${pipe.nps}" Sch 40`,
        isExactMatch: pipe.area_mm2 === requiredArea,
      };
    }
  }

  // If no pipe is large enough, return the largest available
  const largestPipe = pipes[pipes.length - 1];
  if (!largestPipe) {
    throw new Error('No pipes available for selection');
  }
  return {
    ...largestPipe,
    displayName: `${largestPipe.nps}" Sch 40 (MAX)`,
    isExactMatch: false,
  };
}

/**
 * Select pipe size based on velocity constraints
 *
 * @param volumetricFlow - Volumetric flow rate in m³/s
 * @param targetVelocity - Target velocity in m/s
 * @param velocityLimits - Min and max acceptable velocities
 * @param availablePipes - Array of available pipe variants
 * @returns Selected pipe with actual velocity
 */
export function selectPipeByVelocity(
  volumetricFlow: number,
  targetVelocity: number,
  velocityLimits: { min: number; max: number },
  availablePipes?: PipeVariant[] | null
): SelectedPipe & { actualVelocity: number; velocityStatus: 'OK' | 'HIGH' | 'LOW' } {
  const pipes = availablePipes || SCHEDULE_40_PIPES;

  // Calculate required area from target velocity
  // A = Q / v (where Q is in m³/s and v is in m/s, A is in m²)
  const requiredAreaM2 = volumetricFlow / targetVelocity;
  const requiredAreaMM2 = requiredAreaM2 * 1e6;

  // Select pipe
  const selectedPipe = selectPipeSize(requiredAreaMM2, pipes);

  // Calculate actual velocity with selected pipe
  const actualAreaM2 = selectedPipe.area_mm2 / 1e6;
  const actualVelocity = volumetricFlow / actualAreaM2;

  // Determine velocity status
  let velocityStatus: 'OK' | 'HIGH' | 'LOW' = 'OK';
  if (actualVelocity > velocityLimits.max) {
    velocityStatus = 'HIGH';
  } else if (actualVelocity < velocityLimits.min) {
    velocityStatus = 'LOW';
  }

  return {
    ...selectedPipe,
    actualVelocity,
    velocityStatus,
  };
}

/**
 * Calculate flow area required for given flow rate and velocity
 *
 * @param massFlow - Mass flow rate in ton/hr
 * @param density - Fluid density in kg/m³
 * @param velocity - Target velocity in m/s
 * @returns Required flow area in mm²
 */
export function calculateRequiredArea(massFlow: number, density: number, velocity: number): number {
  // Convert ton/hr to m³/s
  // massFlow (ton/hr) = massFlow * 1000 (kg/hr) / density (kg/m³) / 3600 (s/hr)
  const volumetricFlow = (massFlow * 1000) / (density * 3600); // m³/s

  // Area = Q / v (m² to mm²)
  const areaM2 = volumetricFlow / velocity;
  return areaM2 * 1e6; // Convert to mm²
}

/**
 * Calculate velocity through a pipe
 *
 * @param massFlow - Mass flow rate in ton/hr
 * @param density - Fluid density in kg/m³
 * @param pipe - Pipe variant
 * @returns Velocity in m/s
 */
export function calculateVelocity(massFlow: number, density: number, pipe: PipeVariant): number {
  // Convert ton/hr to m³/s
  const volumetricFlow = (massFlow * 1000) / (density * 3600); // m³/s

  // Convert area from mm² to m²
  const areaM2 = pipe.area_mm2 / 1e6;

  // v = Q / A
  return volumetricFlow / areaM2;
}

/**
 * Get pipe by NPS size
 *
 * @param nps - Nominal Pipe Size (e.g., "2", "4", "6")
 * @param availablePipes - Array of available pipe variants
 * @returns Pipe variant or undefined if not found
 */
export function getPipeByNPS(
  nps: string,
  availablePipes?: PipeVariant[] | null
): PipeVariant | undefined {
  const pipes = availablePipes || SCHEDULE_40_PIPES;
  return pipes.find((p) => p.nps === nps);
}

/**
 * Get pipe by DN size
 *
 * @param dn - Metric nominal diameter (e.g., "50", "100", "150")
 * @param availablePipes - Array of available pipe variants
 * @returns Pipe variant or undefined if not found
 */
export function getPipeByDN(
  dn: string,
  availablePipes?: PipeVariant[] | null
): PipeVariant | undefined {
  const pipes = availablePipes || SCHEDULE_40_PIPES;
  return pipes.find((p) => p.dn === dn);
}

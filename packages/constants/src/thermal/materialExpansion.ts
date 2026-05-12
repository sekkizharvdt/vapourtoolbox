/**
 * Thermal Expansion & Mechanical Properties of Engineering Materials
 *
 * Tabulated temperature-dependent properties for the materials commonly used
 * in thermal desalination equipment (shells, piping, tube bundles):
 *   - Carbon steel (mild steel / ASTM A106 Gr B)
 *   - Stainless steel 304 / 304L
 *   - Aluminium 5052-O (annealed)
 *   - Titanium SB 338 Grade 2 (CP Ti Gr 2)
 *
 * For each material:
 *   - alphaMean : mean coefficient of linear thermal expansion from 20°C to T,
 *                 in units of 10⁻⁶ /°C. This is the ASM Handbook convention —
 *                 total expansion δ/L = alphaMean(T) × (T − 20).
 *   - E         : Young's modulus in GPa.
 *   - sigmaY    : yield strength in MPa (where available).
 *
 * Sources:
 *   - ASM Handbook Vol. 2 (Properties of Nonferrous Alloys) and Vol. 1
 *     (Properties of Steels) — temperature-dependent E and α tables.
 *   - Perry's Chemical Engineers' Handbook, 9th ed., Section 28
 *     (Materials of Construction).
 *   - ASME B31.3 Appendix C (Tables C-1 and C-6) for cross-check of α data.
 *
 * Convention: positive α → elongation on heating. Linear interpolation between
 * tabulated points; extrapolation is clamped to the table range.
 */

// ============================================================================
// Types
// ============================================================================

export interface MaterialThermalDataPoint {
  /** Temperature in °C */
  T: number;
  /**
   * Mean coefficient of linear thermal expansion from 20°C to T,
   * in 10⁻⁶ /°C. Total expansion δ/L = alphaMean × (T − 20).
   */
  alphaMean: number;
  /** Young's modulus in GPa */
  E: number;
  /** Yield strength (0.2% offset) in MPa. Optional — present for design checks. */
  sigmaY?: number;
}

export interface MaterialThermalProperties {
  /** Internal key (matches TUBE_CONDUCTIVITY keys where applicable) */
  key: string;
  /** Display label */
  label: string;
  /** Grade / spec / temper description */
  description: string;
  /** Reference temperature for alphaMean (always 20°C in ASM convention) */
  referenceTemperature: number;
  /** Temperature range covered by the tabulated data (°C) */
  validRange: { min: number; max: number };
  /** Tabulated property data, sorted by T ascending */
  data: MaterialThermalDataPoint[];
  /** Source reference */
  source: string;
}

// ============================================================================
// Material Database
// ============================================================================

export const MATERIAL_THERMAL_PROPERTIES: Record<string, MaterialThermalProperties> = {
  carbon_steel: {
    key: 'carbon_steel',
    label: 'Carbon Steel',
    description: 'Mild steel / ASTM A106 Gr B (typical for piping & shells)',
    referenceTemperature: 20,
    validRange: { min: 20, max: 600 },
    data: [
      { T: 20, alphaMean: 11.0, E: 207, sigmaY: 240 },
      { T: 100, alphaMean: 11.7, E: 203, sigmaY: 220 },
      { T: 200, alphaMean: 12.1, E: 198, sigmaY: 200 },
      { T: 300, alphaMean: 12.6, E: 191, sigmaY: 180 },
      { T: 400, alphaMean: 13.0, E: 184, sigmaY: 155 },
      { T: 500, alphaMean: 13.5, E: 174, sigmaY: 125 },
      { T: 600, alphaMean: 13.9, E: 162, sigmaY: 95 },
    ],
    source: 'ASM Handbook Vol. 1; ASME B31.3 Table C-1',
  },

  stainless_304: {
    key: 'stainless_304',
    label: 'Stainless Steel 304 / 304L',
    description: 'Austenitic SS — AISI 304/304L (UNS S30400/S30403)',
    referenceTemperature: 20,
    validRange: { min: 20, max: 600 },
    data: [
      { T: 20, alphaMean: 16.0, E: 193, sigmaY: 205 },
      { T: 100, alphaMean: 17.2, E: 192, sigmaY: 170 },
      { T: 200, alphaMean: 17.8, E: 183, sigmaY: 145 },
      { T: 300, alphaMean: 18.4, E: 173, sigmaY: 130 },
      { T: 400, alphaMean: 18.7, E: 167, sigmaY: 120 },
      { T: 500, alphaMean: 19.0, E: 158, sigmaY: 115 },
      { T: 600, alphaMean: 19.2, E: 148, sigmaY: 110 },
    ],
    source: 'ASM Handbook Vol. 1; ASME B31.3 Table C-1',
  },

  aluminium_5052: {
    key: 'aluminium_5052',
    label: 'Aluminium 5052-O',
    description: 'Annealed Al-Mg alloy (UNS A95052) — common MED tube material',
    referenceTemperature: 20,
    validRange: { min: 20, max: 300 },
    data: [
      { T: 20, alphaMean: 23.7, E: 70.3, sigmaY: 90 },
      { T: 100, alphaMean: 23.8, E: 67.6, sigmaY: 85 },
      { T: 150, alphaMean: 24.1, E: 65.0, sigmaY: 75 },
      { T: 200, alphaMean: 24.6, E: 63.0, sigmaY: 55 },
      { T: 250, alphaMean: 25.1, E: 60.0, sigmaY: 40 },
      { T: 300, alphaMean: 25.6, E: 56.5, sigmaY: 30 },
    ],
    source: "ASM Handbook Vol. 2; Perry's 9e §28",
  },

  titanium_sb338_gr2: {
    key: 'titanium_sb338_gr2',
    label: 'Titanium SB 338 Gr 2',
    description: 'Commercially-pure titanium Grade 2 (UNS R50400) — MED/MSF tubing',
    referenceTemperature: 20,
    validRange: { min: 20, max: 500 },
    data: [
      { T: 20, alphaMean: 8.6, E: 105, sigmaY: 275 },
      { T: 100, alphaMean: 8.8, E: 100, sigmaY: 215 },
      { T: 200, alphaMean: 9.2, E: 95, sigmaY: 165 },
      { T: 300, alphaMean: 9.5, E: 88, sigmaY: 130 },
      { T: 400, alphaMean: 9.7, E: 81, sigmaY: 110 },
      { T: 500, alphaMean: 9.8, E: 74, sigmaY: 95 },
    ],
    source: 'ASM Handbook Vol. 2; ASTM B265 Gr 2',
  },
};

/** Stable iteration order for UI dropdowns */
export const MATERIAL_THERMAL_KEYS = [
  'carbon_steel',
  'stainless_304',
  'aluminium_5052',
  'titanium_sb338_gr2',
] as const;

export type MaterialThermalKey = (typeof MATERIAL_THERMAL_KEYS)[number];

// ============================================================================
// Lookup helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function interpolate(
  data: MaterialThermalDataPoint[],
  T: number,
  field: 'alphaMean' | 'E' | 'sigmaY'
): number | null {
  const first = data[0];
  const last = data[data.length - 1];
  if (!first || !last) return null;
  const clamped = clamp(T, first.T, last.T);

  for (let i = 0; i < data.length - 1; i++) {
    const lo = data[i];
    const hi = data[i + 1];
    if (!lo || !hi) continue;
    if (clamped >= lo.T && clamped <= hi.T) {
      const loVal = lo[field];
      const hiVal = hi[field];
      if (loVal === undefined || hiVal === undefined) return null;
      if (hi.T === lo.T) return loVal;
      const frac = (clamped - lo.T) / (hi.T - lo.T);
      return loVal + frac * (hiVal - loVal);
    }
  }
  return last[field] ?? null;
}

/**
 * Return the material record, or throw if the key is unknown.
 */
export function getMaterialThermalProperties(key: string): MaterialThermalProperties {
  const mat = MATERIAL_THERMAL_PROPERTIES[key];
  if (!mat) {
    throw new Error(`Unknown material key: ${key}`);
  }
  return mat;
}

/**
 * Mean coefficient of linear thermal expansion (10⁻⁶ /°C) from 20°C to T.
 * T is clamped to the valid range of the tabulated data.
 */
export function getMeanExpansionCoefficient(key: string, T: number): number {
  const mat = getMaterialThermalProperties(key);
  const val = interpolate(mat.data, T, 'alphaMean');
  if (val === null) throw new Error(`No alphaMean data for ${key}`);
  return val;
}

/**
 * Young's modulus E (GPa) at temperature T. T is clamped to the valid range.
 */
export function getYoungsModulus(key: string, T: number): number {
  const mat = getMaterialThermalProperties(key);
  const val = interpolate(mat.data, T, 'E');
  if (val === null) throw new Error(`No E data for ${key}`);
  return val;
}

/**
 * Yield strength σ_y (MPa) at temperature T, or null if not tabulated.
 * T is clamped to the valid range.
 */
export function getYieldStrength(key: string, T: number): number | null {
  const mat = getMaterialThermalProperties(key);
  return interpolate(mat.data, T, 'sigmaY');
}

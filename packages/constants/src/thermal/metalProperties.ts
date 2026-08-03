/**
 * Thermophysical properties of vessel and tube metals.
 *
 * Needed wherever metal thermal mass or wall conduction enters a calculation —
 * dynamic startup models, shell weight, tube wall resistance. Before this file
 * the repo held seven metal DENSITIES (spread across `weightEstimation` and
 * `siphonSizingCalculator`) and zero specific heats, so `M·c` for a vessel wall
 * could not be formed at all.
 *
 * PROVENANCE, AND ITS LIMITS. Density and thermal conductivity are firm.
 * Specific heat is the conventional mill-datasheet figure, quoted over a
 * temperature BAND rather than at a point, and consistent across major producers
 * — it is not traced to a specific standard in this repo. That is stated per
 * value in `specificHeatBasis` rather than left implicit, because the difference
 * between "the datasheet number" and "a sourced number" is exactly what has cost
 * this project three findings: a validity envelope carried over from a citation
 * nobody had opened, a correlation whose cited paper was not its source, and a
 * figure that ended up citing itself.
 *
 * If a conclusion comes to rest on the particular value of a specific heat here,
 * pin it to a named document first. As of writing nothing does: metal thermal
 * mass is a few percent of the liquid's in every vessel this repo sizes, so a
 * 5% error in c moves a total heat capacity by well under 1%.
 */

/** Metal grades this repo specifies for vessels and tubes. */
export type MetalGrade =
  | 'carbon_steel'
  | 'ss_304l'
  | 'ss_316l'
  | 'duplex_2205'
  | 'super_duplex_2507'
  | 'titanium_gr2'
  | 'cu_ni_90_10'
  | 'cu_ni_70_30'
  | 'al_brass'
  | 'al_alloy';

export interface MetalProperties {
  /** Density in kg/m³ */
  densityKgM3: number;
  /**
   * Specific heat capacity in J/(kg·K).
   *
   * A band-averaged datasheet value, NOT a point value — see
   * `specificHeatQuotedRangeC` for the band it is quoted over and
   * `specificHeatBasis` for how firm it is.
   */
  specificHeatJPerKgK: number;
  /** Temperature band, °C, over which the specific heat above is quoted. */
  specificHeatQuotedRangeC: readonly [number, number];
  /** How the specific heat figure is grounded. */
  specificHeatBasis: 'mill-datasheet-conventional' | 'sourced';
  /** Thermal conductivity in W/(m·K). */
  thermalConductivityWmK: number;
  /** Human-readable grade, for report output and simulator exports. */
  label: string;
}

/**
 * Temperature dependence is deliberately NOT modelled.
 *
 * Austenitic stainless specific heat rises a few percent between ambient and
 * 100 °C, and a plant startup crosses exactly that span — so a c(T) correlation
 * is the right shape of answer, and the simulator session asked for one. It is
 * absent because fitting one from datasheet band values would manufacture
 * precision that the underlying data does not carry. Supply a real c(T) with its
 * source when a result needs it; until then use the band value and note that the
 * band is wider than the startup span.
 */
export const METAL_PROPERTIES: Record<MetalGrade, MetalProperties> = {
  carbon_steel: {
    densityKgM3: 7850,
    specificHeatJPerKgK: 470,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 50,
    label: 'Carbon steel',
  },
  ss_304l: {
    densityKgM3: 8030,
    specificHeatJPerKgK: 500,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 16,
    label: 'SS 304L',
  },
  ss_316l: {
    densityKgM3: 8000,
    specificHeatJPerKgK: 500,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 16,
    label: 'SS 316L',
  },
  duplex_2205: {
    densityKgM3: 7805,
    specificHeatJPerKgK: 480,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 19,
    label: 'Duplex 2205',
  },
  super_duplex_2507: {
    densityKgM3: 7800,
    specificHeatJPerKgK: 480,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 17,
    label: 'Super duplex 2507',
  },
  titanium_gr2: {
    densityKgM3: 4510,
    specificHeatJPerKgK: 520,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 21,
    label: 'Titanium Gr 2',
  },
  cu_ni_90_10: {
    densityKgM3: 8900,
    specificHeatJPerKgK: 380,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 45,
    label: 'Cu-Ni 90/10',
  },
  cu_ni_70_30: {
    densityKgM3: 8950,
    specificHeatJPerKgK: 380,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 29,
    label: 'Cu-Ni 70/30',
  },
  al_brass: {
    densityKgM3: 8330,
    specificHeatJPerKgK: 380,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 100,
    label: 'Aluminium brass',
  },
  al_alloy: {
    densityKgM3: 2680,
    specificHeatJPerKgK: 900,
    specificHeatQuotedRangeC: [0, 100],
    specificHeatBasis: 'mill-datasheet-conventional',
    thermalConductivityWmK: 160,
    label: 'Aluminium alloy',
  },
};

/**
 * Vessel wall thickness assumed where no calculation and no procurement record
 * supplies one, in mm.
 *
 * THIS IS AN ASSUMPTION, NOT A DESIGN VALUE, and it must be labelled as one
 * wherever it reaches a report or an export. Wall thickness on a vacuum vessel
 * is set by external-pressure buckling (ASME VIII Div 1 UG-28) plus corrosion
 * allowance and minimum practical plate. This repo performs none of that. For a
 * built plant the real answer is the plate variant actually purchased, which
 * lives in the procurement material master.
 *
 * Agreed with the domain user 2026-08-03 as a working figure pending data.
 */
export const ASSUMED_VESSEL_WALL_THICKNESS_MM = 6;

/** Grade assumed for vessel shells alongside the thickness above. */
export const ASSUMED_VESSEL_MATERIAL: MetalGrade = 'ss_316l';

/**
 * Heat capacity of a metal mass, in J/K.
 *
 * Trivial, but named so the two factors travel together and a caller cannot
 * silently pair a mass with the wrong grade's specific heat.
 */
export function metalHeatCapacityJPerK(massKg: number, grade: MetalGrade): number {
  return massKg * METAL_PROPERTIES[grade].specificHeatJPerKgK;
}

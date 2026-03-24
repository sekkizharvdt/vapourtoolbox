/**
 * Instrument Accessory Generator
 *
 * Given an instrument schedule (list of TT, PT, FT, LT, LS points),
 * generates the complete accessories BOM for each instrument — from
 * sensing element through to I/O card.
 *
 * Each instrument type has a standard accessory template:
 *   TT: thermowell + cable gland + 2-core cable + ferrule + cable tag
 *   PT: isolation valve + 3-valve manifold + cable gland + 2-core cable + ferrule + cable tag
 *   FT: flanged connection + cable gland + 2-core cable (+ power cable if mag) + ferrule + cable tag
 *   LT: 5-valve manifold + impulse tubing + cable gland + 2-core cable + ferrule + cable tag
 *   LS: cable gland + 2-core cable + ferrule + cable tag (magnetic float, simple)
 *
 * All instruments share: I/O card channel (4-20mA AI), junction box terminal.
 *
 * Usage:
 *   const accessories = generateInstrumentAccessories(instrumentSchedule, options);
 *   // Returns complete BOM with quantities, materials, and I/O summary
 */

// ============================================================================
// Types
// ============================================================================

/** Instrument type codes */
export type InstrumentType = 'TT' | 'PT' | 'FT' | 'LT' | 'LS' | 'CT' | 'PG';

/** Input: one instrument point */
export interface InstrumentPoint {
  tagNumber: string;
  type: InstrumentType;
  service: string;
  location: string;
  /** Process temperature °C (for thermowell material selection) */
  processTemp?: number;
  /** Process pressure bar (for manifold rating) */
  processPressure?: number;
  /** Process fluid (for material selection) */
  processFluid?: 'seawater' | 'brine' | 'distillate' | 'steam' | 'other';
  /** Pipe/nozzle size for connection (e.g. "DN50") */
  connectionSize?: string;
  /** Flow meter type (for FT only) */
  flowMeterType?: 'electromagnetic' | 'vortex' | 'ultrasonic' | 'orifice';
  /** Cable run distance to JB in metres */
  cableRunM?: number;
}

/** Output: one accessory line item */
export interface InstrumentAccessoryItem {
  /** Parent instrument tag */
  instrumentTag: string;
  /** Accessory description */
  description: string;
  /** Material category (maps to MaterialCategory enum) */
  category: string;
  /** Quantity */
  quantity: number;
  /** Unit */
  unit: string;
  /** Material of construction */
  material: string;
  /** Size/specification */
  specification: string;
  /** Notes */
  notes?: string;
}

/** I/O summary */
export interface IOSummary {
  /** Total analog inputs (4-20mA) */
  analogInputs: number;
  /** Total digital inputs (potential-free contacts) */
  digitalInputs: number;
  /** Total analog outputs */
  analogOutputs: number;
  /** Total digital outputs */
  digitalOutputs: number;
  /** AI cards needed (8-channel typical) */
  aiCardsNeeded: number;
  /** DI cards needed (16-channel typical) */
  diCardsNeeded: number;
}

/** Complete accessory BOM result */
export interface InstrumentAccessoryBOM {
  accessories: InstrumentAccessoryItem[];
  ioSummary: IOSummary;
  /** Number of junction boxes needed (1 per ~20 instruments) */
  junctionBoxes: number;
  /** Total cable length (metres) */
  totalCableLengthM: number;
  /** Warnings */
  warnings: string[];
}

/** Options for accessory generation */
export interface AccessoryGeneratorOptions {
  /** Default cable run to JB in metres (default 30) */
  defaultCableRunM?: number;
  /** JB capacity — instruments per JB (default 20) */
  jbCapacity?: number;
  /** AI card channels (default 8) */
  aiCardChannels?: number;
  /** DI card channels (default 16) */
  diCardChannels?: number;
  /** Default thermowell material (default 'SS316L') */
  defaultThermowellMaterial?: string;
  /** Cable type (default '2-core shielded, 1.5mm²') */
  cableType?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CABLE_RUN = 30; // metres
const DEFAULT_JB_CAPACITY = 20;
const DEFAULT_AI_CHANNELS = 8;
const DEFAULT_DI_CHANNELS = 16;
const CABLE_WASTAGE = 1.1; // 10% extra for routing

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate complete instrument accessories BOM from an instrument schedule.
 *
 * @param instruments  Array of instrument points
 * @param options      Generator options (cable run, JB capacity, etc.)
 * @returns Complete accessories BOM with I/O summary
 */
export function generateInstrumentAccessories(
  instruments: InstrumentPoint[],
  options?: AccessoryGeneratorOptions
): InstrumentAccessoryBOM {
  const cableRun = options?.defaultCableRunM ?? DEFAULT_CABLE_RUN;
  const jbCap = options?.jbCapacity ?? DEFAULT_JB_CAPACITY;
  const aiChannels = options?.aiCardChannels ?? DEFAULT_AI_CHANNELS;
  const diChannels = options?.diCardChannels ?? DEFAULT_DI_CHANNELS;
  const thermowellMat = options?.defaultThermowellMaterial ?? 'SS316L';
  const cableType = options?.cableType ?? '2-core shielded, 1.5mm² XLPE/SWA';

  const accessories: InstrumentAccessoryItem[] = [];
  const warnings: string[] = [];

  let totalAI = 0;
  let totalDI = 0;
  let totalCableM = 0;

  for (const inst of instruments) {
    const tag = inst.tagNumber;
    const run = inst.cableRunM ?? cableRun;
    const cableLen = Math.ceil(run * CABLE_WASTAGE);
    const wetted = inst.processFluid === 'seawater' || inst.processFluid === 'brine';
    const twMat = wetted ? 'Ti Gr 2' : thermowellMat;

    switch (inst.type) {
      case 'TT': {
        // Temperature Transmitter
        accessories.push({
          instrumentTag: tag,
          description: 'Thermowell',
          category: 'INSTRUMENT_ACCESSORY_THERMOWELL',
          quantity: 1,
          unit: 'nos',
          material: twMat,
          specification: `½" NPT, 150mm insertion, bar stock`,
          notes: inst.processTemp && inst.processTemp > 100 ? 'High temp service' : undefined,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable gland',
          category: 'INSTRUMENT_ACCESSORY_CABLE_GLAND',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: 'M20, IP68, for 6-12mm cable',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Instrument cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: cableType,
          specification: `${cableLen}m run to JB`,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Bootlace ferrule (pair)',
          category: 'INSTRUMENT_ACCESSORY_FERRULE',
          quantity: 2,
          unit: 'nos',
          material: 'Tinned copper',
          specification: '1.5mm², insulated',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable tag',
          category: 'ELECTRICAL',
          quantity: 2,
          unit: 'nos',
          material: 'SS304 engraved',
          specification: `Tag: ${tag}`,
        });
        totalAI++;
        totalCableM += cableLen;
        break;
      }

      case 'PT': {
        // Pressure Transmitter
        accessories.push({
          instrumentTag: tag,
          description: 'Block valve (isolation)',
          category: 'INSTRUMENT_ACCESSORY_MANIFOLD',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: '½" NPT, needle type',
        });
        accessories.push({
          instrumentTag: tag,
          description: '3-valve manifold',
          category: 'INSTRUMENT_ACCESSORY_MANIFOLD',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: '½" NPT, equalise + block + vent',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable gland',
          category: 'INSTRUMENT_ACCESSORY_CABLE_GLAND',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: 'M20, IP68',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Instrument cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: cableType,
          specification: `${cableLen}m run to JB`,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Bootlace ferrule (pair)',
          category: 'INSTRUMENT_ACCESSORY_FERRULE',
          quantity: 2,
          unit: 'nos',
          material: 'Tinned copper',
          specification: '1.5mm², insulated',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable tag',
          category: 'ELECTRICAL',
          quantity: 2,
          unit: 'nos',
          material: 'SS304 engraved',
          specification: `Tag: ${tag}`,
        });
        totalAI++;
        totalCableM += cableLen;
        break;
      }

      case 'FT': {
        // Flow Transmitter
        const isMag = (inst.flowMeterType ?? 'electromagnetic') === 'electromagnetic';
        accessories.push({
          instrumentTag: tag,
          description: 'Cable gland',
          category: 'INSTRUMENT_ACCESSORY_CABLE_GLAND',
          quantity: isMag ? 2 : 1, // signal + power for mag flow
          unit: 'nos',
          material: 'SS316L',
          specification: 'M20, IP68',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Signal cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: cableType,
          specification: `${cableLen}m run to JB`,
        });
        if (isMag) {
          accessories.push({
            instrumentTag: tag,
            description: 'Power cable (mag flow)',
            category: 'ELECTRICAL',
            quantity: cableLen,
            unit: 'm',
            material: '2-core, 1.5mm² XLPE/SWA',
            specification: `${cableLen}m, 24VDC or 230VAC supply`,
          });
        }
        accessories.push({
          instrumentTag: tag,
          description: 'Bootlace ferrule (pair)',
          category: 'INSTRUMENT_ACCESSORY_FERRULE',
          quantity: isMag ? 4 : 2, // signal + power
          unit: 'nos',
          material: 'Tinned copper',
          specification: '1.5mm², insulated',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable tag',
          category: 'ELECTRICAL',
          quantity: isMag ? 4 : 2,
          unit: 'nos',
          material: 'SS304 engraved',
          specification: `Tag: ${tag}`,
        });
        totalAI++;
        totalCableM += cableLen * (isMag ? 2 : 1);
        break;
      }

      case 'LT': {
        // Level Transmitter (DP type)
        accessories.push({
          instrumentTag: tag,
          description: '5-valve manifold',
          category: 'INSTRUMENT_ACCESSORY_MANIFOLD',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: '½" NPT, HP/LP block + equalise + drain',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Impulse tubing',
          category: 'INSTRUMENT_ACCESSORY_MANIFOLD',
          quantity: 2,
          unit: 'm',
          material: 'SS316L, ½" OD × 0.049" wall',
          specification: 'HP + LP legs, with slope for drainage',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable gland',
          category: 'INSTRUMENT_ACCESSORY_CABLE_GLAND',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: 'M20, IP68',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Instrument cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: cableType,
          specification: `${cableLen}m run to JB`,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Bootlace ferrule (pair)',
          category: 'INSTRUMENT_ACCESSORY_FERRULE',
          quantity: 2,
          unit: 'nos',
          material: 'Tinned copper',
          specification: '1.5mm², insulated',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable tag',
          category: 'ELECTRICAL',
          quantity: 2,
          unit: 'nos',
          material: 'SS304 engraved',
          specification: `Tag: ${tag}`,
        });
        totalAI++;
        totalCableM += cableLen;
        break;
      }

      case 'LS': {
        // Level Switch (magnetic float)
        accessories.push({
          instrumentTag: tag,
          description: 'Cable gland',
          category: 'INSTRUMENT_ACCESSORY_CABLE_GLAND',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: 'M20, IP68',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Instrument cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: cableType,
          specification: `${cableLen}m run to JB`,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Bootlace ferrule (pair)',
          category: 'INSTRUMENT_ACCESSORY_FERRULE',
          quantity: 2,
          unit: 'nos',
          material: 'Tinned copper',
          specification: '1.5mm², insulated',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable tag',
          category: 'ELECTRICAL',
          quantity: 2,
          unit: 'nos',
          material: 'SS304 engraved',
          specification: `Tag: ${tag}`,
        });
        totalDI++;
        totalCableM += cableLen;
        break;
      }

      case 'CT': {
        // Conductivity Transmitter
        accessories.push({
          instrumentTag: tag,
          description: 'Cable gland',
          category: 'INSTRUMENT_ACCESSORY_CABLE_GLAND',
          quantity: 2, // signal + power
          unit: 'nos',
          material: 'SS316L',
          specification: 'M20, IP68',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Signal cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: cableType,
          specification: `${cableLen}m run to JB`,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Power cable',
          category: 'ELECTRICAL',
          quantity: cableLen,
          unit: 'm',
          material: '2-core, 1.5mm² XLPE/SWA',
          specification: `${cableLen}m, 24VDC supply`,
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Bootlace ferrule (pair)',
          category: 'INSTRUMENT_ACCESSORY_FERRULE',
          quantity: 4,
          unit: 'nos',
          material: 'Tinned copper',
          specification: '1.5mm², insulated',
        });
        accessories.push({
          instrumentTag: tag,
          description: 'Cable tag',
          category: 'ELECTRICAL',
          quantity: 4,
          unit: 'nos',
          material: 'SS304 engraved',
          specification: `Tag: ${tag}`,
        });
        totalAI++;
        totalCableM += cableLen * 2;
        break;
      }

      case 'PG': {
        // Pressure Gauge (local, no I/O)
        accessories.push({
          instrumentTag: tag,
          description: 'Block valve (isolation)',
          category: 'INSTRUMENT_ACCESSORY_MANIFOLD',
          quantity: 1,
          unit: 'nos',
          material: 'SS316L',
          specification: '½" NPT, needle type',
        });
        // No cable, no I/O
        break;
      }

      default:
        warnings.push(`Unknown instrument type "${inst.type}" for ${tag}`);
    }
  }

  // Junction boxes
  const junctionBoxes = Math.ceil(instruments.length / jbCap);
  for (let i = 0; i < junctionBoxes; i++) {
    accessories.push({
      instrumentTag: `JB-${String(i + 1).padStart(2, '0')}`,
      description: 'Junction Box',
      category: 'INSTRUMENT_ACCESSORY_JUNCTION_BOX',
      quantity: 1,
      unit: 'nos',
      material: 'SS304, IP66',
      specification: `${jbCap}-terminal, with DIN rail + terminal blocks`,
      notes: `Serves instruments ${i * jbCap + 1}-${Math.min((i + 1) * jbCap, instruments.length)}`,
    });
  }

  // I/O summary
  const aiCardsNeeded = Math.ceil(totalAI / aiChannels);
  const diCardsNeeded = Math.ceil(totalDI / diChannels);

  return {
    accessories,
    ioSummary: {
      analogInputs: totalAI,
      digitalInputs: totalDI,
      analogOutputs: 0,
      digitalOutputs: 0,
      aiCardsNeeded,
      diCardsNeeded,
    },
    junctionBoxes,
    totalCableLengthM: totalCableM,
    warnings,
  };
}

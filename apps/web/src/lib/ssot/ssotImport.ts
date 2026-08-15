/**
 * SSOT ← Excel
 *
 * Parses a workbook in the layout `ssotExcel` exports into the same
 * `SSOTGeneration` shape the calculator bridges produce, so the **entire**
 * merge path is reused unchanged: `planSSOTSync` shows what will be created,
 * updated, left alone and orphaned, and nothing is written until the plan is
 * approved (rule 32 — the merge contract has one implementation, not one per
 * source).
 *
 * ── The match key ────────────────────────────────────────────────────────
 * Sync matches records on `provenance.generatedKey`. For a calculator that is
 * a derived identity, because a generated line number carries a sequence that
 * shifts when the effect count changes. For an import it is simply the tag in
 * the file — a stream tag, an equipment tag, a line number — because that is
 * exactly what stays constant when the client issues revision B of the same
 * document. Re-importing then updates rather than duplicating.
 *
 * ── What is trusted and what is recomputed ──────────────────────────────
 * Inputs are trusted: tags, flows, pressures, temperatures, compositions.
 * Derived values are **recomputed rather than read** — a spreadsheet is where
 * numbers get edited by hand, and a density that disagrees with the
 * composition beside it should lose to the composition. The exported file
 * carries them so a human can read it, not so the importer can believe them.
 *
 * ── Columns by name, not position ───────────────────────────────────────
 * Headers are matched by name against the exported column lists. Matching by
 * position would mean that inserting a column in the export silently shifted
 * every field the importer reads, and the failure would look like plausible
 * data rather than an error.
 */

import ExcelJS from 'exceljs';
import type {
  FluidType,
  FlowUnit,
  GasComposition,
  ProcessStreamInput,
  ProcessEquipmentInput,
  ProcessLineInput,
  ProcessEquipmentType,
} from '@vapour/types';
import { FLUID_TYPES, FLOW_UNIT_LABELS } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import type { SSOTGeneration } from './ssotSync';
import {
  calculateStreamProperties,
  convertFlowToKgS,
  deriveStreamPropertyBasis,
  enrichStreamInput,
} from './streamCalculations';
import { enrichLineInput, getDesignVelocity } from './lineCalculations';
import { STREAM_COLUMNS, EQUIPMENT_COLUMNS, LINE_COLUMNS } from './ssotExcel';

const logger = createLogger({ context: 'ssotImport' });

export interface ImportOptions {
  /**
   * The document the data came from — a client basic design number, a revision,
   * a date. Recorded as the basis source on every property the file supplied,
   * so a datasheet can later say where its numbers came from.
   */
  sourceReference: string;
}

export interface SSOTImportResult extends SSOTGeneration {
  /** Rows that could not be read, with the reason */
  errors: string[];
  /** How many data rows each sheet contributed */
  counts: { streams: number; equipment: number; lines: number };
}

// ============================================================================
// Cell reading
// ============================================================================

/** A worksheet's header row as a name → column-number map */
function headerIndex(sheet: ExcelJS.Worksheet): Map<string, number> {
  const index = new Map<string, number>();
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const name = String(cell.value ?? '').trim();
    if (name) index.set(name.toLowerCase(), colNumber);
  });
  return index;
}

function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return '';
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return '';
  // A formula cell carries its computed result; a rich-text cell carries runs
  if (typeof value === 'object') {
    if ('result' in value) return String(value.result ?? '').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    return '';
  }
  return String(value).trim();
}

function cellNumber(row: ExcelJS.Row, col: number | undefined): number | undefined {
  const text = cellText(row, col);
  if (text === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** Reverse of FLOW_UNIT_LABELS — accepts what the export writes */
function parseFlowUnit(label: string): FlowUnit | undefined {
  if (!label) return undefined;
  const normalised = label.trim().toLowerCase();
  const match = (Object.keys(FLOW_UNIT_LABELS) as FlowUnit[]).find(
    (u) => FLOW_UNIT_LABELS[u].toLowerCase() === normalised || u.toLowerCase() === normalised
  );
  return match;
}

function parseFluidType(value: string): FluidType | undefined {
  const normalised = value.trim().toUpperCase();
  return FLUID_TYPES.find((f) => f === normalised);
}

// ============================================================================
// Sheet parsers
// ============================================================================

function parseStreams(
  sheet: ExcelJS.Worksheet,
  options: ImportOptions,
  errors: string[],
  warnings: string[]
): ProcessStreamInput[] {
  const cols = headerIndex(sheet);
  const col = (name: (typeof STREAM_COLUMNS)[number]) => cols.get(name.toLowerCase());
  const streams: ProcessStreamInput[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const lineTag = cellText(row, col('Stream Tag'));
    if (!lineTag) return; // blank row

    const fluidText = cellText(row, col('Fluid Type'));
    const fluidType = parseFluidType(fluidText);
    if (!fluidType) {
      // Never guess: an unrecognised fluid silently treated as sea water is
      // the defect this register already had once.
      errors.push(
        `Streams row ${rowNumber} (${lineTag}): fluid "${fluidText}" is not a known fluid type`
      );
      return;
    }

    const temperature = cellNumber(row, col('Temperature (C)'));
    const pressureMbar = cellNumber(row, col('Pressure (mbar a)'));
    if (temperature === undefined || pressureMbar === undefined) {
      errors.push(`Streams row ${rowNumber} (${lineTag}): temperature and pressure are required`);
      return;
    }

    // Gas analysis, when the sheet carries one
    const methane = cellNumber(row, col('CH4 (mol%)'));
    const carbonDioxide = cellNumber(row, col('CO2 (mol%)'));
    let composition: GasComposition | undefined;
    if (methane !== undefined && carbonDioxide !== undefined) {
      const h2sUnitText = cellText(row, col('H2S Unit')).toUpperCase();
      const basisText = cellText(row, col('Analysis Basis')).toUpperCase();
      const saturatedText = cellText(row, col('Saturated')).toUpperCase();
      composition = {
        methaneMolPercent: methane,
        carbonDioxideMolPercent: carbonDioxide,
        hydrogenSulphide: cellNumber(row, col('H2S')) ?? 0,
        hydrogenSulphideUnit: h2sUnitText === 'MOL_PERCENT' ? 'MOL_PERCENT' : 'PPMV',
        basis: basisText === 'WET' ? 'WET' : 'DRY',
        ...(basisText !== 'WET' && {
          saturatedAtStreamTemperature: saturatedText !== 'NO',
        }),
        ...(cellText(row, col('Analysis Reference')) && {
          sourceReference: cellText(row, col('Analysis Reference')),
        }),
      };
    }

    // Flow: the entered value and unit win over the derived kg/s column,
    // because that is the number the source document actually states.
    const flowValue = cellNumber(row, col('Flow Value'));
    const flowUnit = parseFlowUnit(cellText(row, col('Flow Unit'))) ?? 'KG_S';
    const flowKgSColumn = cellNumber(row, col('Flow (kg/s)'));
    const tds = cellNumber(row, col('TDS (ppm)'));

    // Density is needed before a volumetric flow can become a mass flow, and
    // density does not depend on flow — so it is resolved first, with a zero
    // flow, exactly as the form does.
    let density: number | undefined;
    try {
      density = calculateStreamProperties({
        fluidType,
        temperature,
        pressureMbar,
        flowRateKgS: 0,
        tds,
        composition,
      }).density;
    } catch {
      density = undefined;
    }

    let flowRateKgS: number | undefined;
    if (flowValue !== undefined) {
      const converted = convertFlowToKgS(flowValue, flowUnit, {
        density,
        temperatureC: temperature,
        pressureMbar,
      });
      if (converted === null) {
        errors.push(
          `Streams row ${rowNumber} (${lineTag}): a flow in ${FLOW_UNIT_LABELS[flowUnit]} needs a ` +
            'density, and none could be derived. Supply a gas analysis or give the flow in kg/s.'
        );
        return;
      }
      flowRateKgS = converted;
    } else {
      flowRateKgS = flowKgSColumn;
    }

    if (flowRateKgS === undefined) {
      errors.push(`Streams row ${rowNumber} (${lineTag}): no flow rate`);
      return;
    }

    const suppliedDensity = cellNumber(row, col('Density (kg/m3)'));
    const suppliedEnthalpy = cellNumber(row, col('Enthalpy (kJ/kg)'));

    const base: ProcessStreamInput = {
      lineTag,
      ...(cellText(row, col('Description')) && { description: cellText(row, col('Description')) }),
      fluidType,
      flowRateKgS,
      pressureMbar,
      temperature,
      ...(tds !== undefined && { tds }),
      ...(composition && { composition }),
      ...(flowUnit !== 'KG_S' &&
        flowValue !== undefined && { flowInput: { value: flowValue, unit: flowUnit } }),
      // Only used where nothing can compute them — enrichStreamInput leaves a
      // supplied value alone rather than overwriting it with undefined.
      ...(suppliedDensity !== undefined && { density: suppliedDensity }),
      ...(suppliedEnthalpy !== undefined && { enthalpy: suppliedEnthalpy }),
    };

    const enriched = enrichStreamInput(base);
    const calculated = calculateStreamProperties({
      fluidType,
      temperature,
      pressureMbar,
      flowRateKgS,
      tds,
      composition,
    });

    if (enriched.density === undefined) {
      errors.push(
        `Streams row ${rowNumber} (${lineTag}): no density. ${fluidType} needs either a gas ` +
          'analysis or a density column.'
      );
      return;
    }

    streams.push({
      ...enriched,
      // Anything the file supplied rather than the toolbox computing it is
      // SUPPLIED, attributed to the source document.
      propertyBasis: deriveStreamPropertyBasis(
        calculated,
        { density: enriched.density, enthalpy: enriched.enthalpy },
        'SUPPLIED',
        options.sourceReference
      ),
      provenance: { source: 'IMPORTED', generatedKey: lineTag },
    });
  });

  if (streams.length === 0 && errors.length === 0) {
    warnings.push('The Streams sheet had no data rows.');
  }
  return streams;
}

function parseEquipment(
  sheet: ExcelJS.Worksheet,
  errors: string[],
  warnings: string[]
): ProcessEquipmentInput[] {
  const cols = headerIndex(sheet);
  const col = (name: (typeof EQUIPMENT_COLUMNS)[number]) => cols.get(name.toLowerCase());
  const equipment: ProcessEquipmentInput[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const equipmentTag = cellText(row, col('Equipment Tag'));
    if (!equipmentTag) return;

    const operatingPressure = cellNumber(row, col('Operating Pressure (mbar a)'));
    const operatingTemperature = cellNumber(row, col('Operating Temperature (C)'));
    if (operatingPressure === undefined || operatingTemperature === undefined) {
      errors.push(
        `Equipment row ${rowNumber} (${equipmentTag}): operating pressure and temperature are required`
      );
      return;
    }

    // Semicolon separated, matching the export — a comma is what a spreadsheet
    // uses to split a cell on paste.
    const splitTags = (text: string): string[] =>
      text
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean);

    const typeText = cellText(row, col('Equipment Type')).toUpperCase();

    equipment.push({
      equipmentTag,
      equipmentName: cellText(row, col('Equipment Name')) || equipmentTag,
      ...(typeText && { equipmentType: typeText as ProcessEquipmentType }),
      operatingPressure,
      operatingTemperature,
      fluidIn: splitTags(cellText(row, col('Fluid In'))),
      fluidOut: splitTags(cellText(row, col('Fluid Out'))),
      ...(cellNumber(row, col('Shell ID (mm)')) !== undefined && {
        shellIDmm: cellNumber(row, col('Shell ID (mm)')),
      }),
      ...(cellNumber(row, col('Shell Length (mm)')) !== undefined && {
        shellLengthMM: cellNumber(row, col('Shell Length (mm)')),
      }),
      ...(cellNumber(row, col('Gross Volume (m3)')) !== undefined && {
        grossVolumeM3: cellNumber(row, col('Gross Volume (m3)')),
      }),
      ...(cellNumber(row, col('Liquid Holdup (m3)')) !== undefined && {
        liquidHoldupM3: cellNumber(row, col('Liquid Holdup (m3)')),
      }),
      ...(cellNumber(row, col('Heat Transfer Area (m2)')) !== undefined && {
        heatTransferAreaM2: cellNumber(row, col('Heat Transfer Area (m2)')),
      }),
      ...(cellNumber(row, col('Elevation (m)')) !== undefined && {
        elevationM: cellNumber(row, col('Elevation (m)')),
      }),
      provenance: { source: 'IMPORTED', generatedKey: equipmentTag },
    });
  });

  if (equipment.length === 0 && errors.length === 0) {
    warnings.push('The Equipment sheet had no data rows.');
  }
  return equipment;
}

function parseLines(
  sheet: ExcelJS.Worksheet,
  streams: ProcessStreamInput[],
  errors: string[],
  warnings: string[]
): ProcessLineInput[] {
  const cols = headerIndex(sheet);
  const col = (name: (typeof LINE_COLUMNS)[number]) => cols.get(name.toLowerCase());
  const lines: ProcessLineInput[] = [];
  const streamByTag = new Map(streams.map((s) => [s.lineTag, s]));

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const lineNumber = cellText(row, col('Line Number'));
    if (!lineNumber) return;

    const streamTag = cellText(row, col('Stream Tag'));
    const stream = streamTag ? streamByTag.get(streamTag) : undefined;
    if (streamTag && !stream) {
      // Not fatal — a line can carry its own flow and density — but a dangling
      // reference is worth reporting rather than absorbing.
      warnings.push(
        `Lines row ${rowNumber} (${lineNumber}): references stream "${streamTag}", which is not in the Streams sheet.`
      );
    }

    const flowRateKgS = cellNumber(row, col('Flow (kg/s)')) ?? stream?.flowRateKgS;
    const density = cellNumber(row, col('Density (kg/m3)')) ?? stream?.density;
    if (flowRateKgS === undefined || density === undefined || density <= 0) {
      errors.push(
        `Lines row ${rowNumber} (${lineNumber}): needs a flow and a density, either on the row ` +
          'or from the stream it references'
      );
      return;
    }

    const fluid = cellText(row, col('Fluid')) || stream?.fluidType || '';

    lines.push(
      enrichLineInput({
        ...(cellNumber(row, col('S.No')) !== undefined && { sNo: cellNumber(row, col('S.No')) }),
        lineNumber,
        fluid,
        inputDataTag: streamTag,
        flowRateKgS,
        density,
        designVelocity: cellNumber(row, col('Design Velocity (m/s)')) ?? getDesignVelocity(fluid),
        selectedID: cellNumber(row, col('Selected ID (mm)')) ?? 0,
        ...(cellText(row, col('Pipe Size')) && { pipeSize: cellText(row, col('Pipe Size')) }),
        ...(cellText(row, col('Schedule')) && { schedule: cellText(row, col('Schedule')) }),
        ...(cellText(row, col('From Equipment')) && {
          fromEquipmentTag: cellText(row, col('From Equipment')),
        }),
        ...(cellText(row, col('To Equipment')) && {
          toEquipmentTag: cellText(row, col('To Equipment')),
        }),
        provenance: { source: 'IMPORTED', generatedKey: lineNumber },
      })
    );
  });

  if (lines.length === 0 && errors.length === 0) {
    warnings.push('The Lines sheet had no data rows.');
  }
  return lines;
}

// ============================================================================
// Entry point
// ============================================================================

/**
 * Parse a workbook into the shape `planSSOTSync` consumes.
 *
 * Pure with respect to Firestore — nothing is read or written here. The caller
 * plans, shows the plan, and only then applies it.
 */
export async function parseSSOTWorkbook(
  file: ArrayBuffer,
  options: ImportOptions
): Promise<SSOTImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file);

  const errors: string[] = [];
  const warnings: string[] = [];

  const streamSheet = workbook.getWorksheet('Streams');
  const equipmentSheet = workbook.getWorksheet('Equipment');
  const lineSheet = workbook.getWorksheet('Lines');

  if (!streamSheet && !equipmentSheet && !lineSheet) {
    throw new Error(
      'No Streams, Equipment or Lines sheet found. Export the project first to get the expected layout.'
    );
  }

  const streams = streamSheet ? parseStreams(streamSheet, options, errors, warnings) : [];
  const equipment = equipmentSheet ? parseEquipment(equipmentSheet, errors, warnings) : [];
  const lines = lineSheet ? parseLines(lineSheet, streams, errors, warnings) : [];

  logger.info('Parsed SSOT workbook', {
    streams: streams.length,
    equipment: equipment.length,
    lines: lines.length,
    errors: errors.length,
  });

  return {
    streams,
    equipment,
    lines,
    warnings,
    errors,
    counts: { streams: streams.length, equipment: equipment.length, lines: lines.length },
  };
}

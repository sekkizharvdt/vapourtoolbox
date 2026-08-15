/**
 * SSOT ↔ Excel
 *
 * One sheet per register, and the same column layout in both directions: what
 * this exports is exactly what the importer accepts. That is deliberate — the
 * export **is** the import template, so there is no second document to keep in
 * step with the code, and an engineer preparing a third party's data can start
 * from a file the toolbox produced rather than from a specification of one.
 *
 * The `Export Excel` button on `/ssot` was a stub that raised a toast saying
 * "coming soon" until this shipped.
 *
 * ── What round-trips ────────────────────────────────────────────────────
 * Everything an engineer enters, including the gas analysis and the basis of
 * each property. Derived values (density, enthalpy, calculated bore) are
 * exported for reading but are recomputed on import rather than trusted — a
 * spreadsheet is a place where numbers get edited by hand, and a density that
 * disagrees with its own composition should lose to the composition.
 */

import ExcelJS from 'exceljs';
import type {
  ProcessStream,
  ProcessEquipment,
  ProcessLine,
  ProcessInstrument,
  ProcessValve,
  PipeSize,
} from '@vapour/types';
import { FLOW_UNIT_LABELS } from '@vapour/types';

/** Every register in one workbook */
export interface SSOTWorkbookData {
  projectCode: string;
  projectName: string;
  streams: ProcessStream[];
  equipment: ProcessEquipment[];
  lines: ProcessLine[];
  instruments: ProcessInstrument[];
  valves: ProcessValve[];
  pipeTable: PipeSize[];
}

/**
 * Column headers for the stream sheet.
 *
 * Exported as a constant because the importer reads the same list to find its
 * columns by name rather than by position — inserting a column in the export
 * would otherwise silently shift every field the importer reads.
 */
export const STREAM_COLUMNS = [
  'Stream Tag',
  'Description',
  'Fluid Type',
  'Flow Value',
  'Flow Unit',
  'Flow (kg/s)',
  'Flow (kg/hr)',
  'Pressure (mbar a)',
  'Temperature (C)',
  'TDS (ppm)',
  'CH4 (mol%)',
  'CO2 (mol%)',
  'H2S',
  'H2S Unit',
  'Analysis Basis',
  'Saturated',
  'Analysis Reference',
  'Density (kg/m3)',
  'Enthalpy (kJ/kg)',
  'Cp (kJ/kg.K)',
  'Viscosity (Pa.s)',
  'Conductivity (W/m.K)',
  'Density Basis',
  'Source Reference',
] as const;

export const EQUIPMENT_COLUMNS = [
  'Equipment Tag',
  'Equipment Name',
  'Equipment Type',
  'Operating Pressure (mbar a)',
  'Operating Temperature (C)',
  'Fluid In',
  'Fluid Out',
  'Shell ID (mm)',
  'Shell Length (mm)',
  'Gross Volume (m3)',
  'Liquid Holdup (m3)',
  'Heat Transfer Area (m2)',
  'Elevation (m)',
] as const;

export const LINE_COLUMNS = [
  'S.No',
  'Line Number',
  'Fluid',
  'Stream Tag',
  'Flow (kg/s)',
  'Density (kg/m3)',
  'Design Velocity (m/s)',
  'Calculated ID (mm)',
  'Selected ID (mm)',
  'Actual Velocity (m/s)',
  'Pipe Size',
  'Schedule',
  'From Equipment',
  'To Equipment',
] as const;

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E63' },
};

/** Apply the shared header treatment and set sensible widths */
function styleSheet(sheet: ExcelJS.Worksheet, headers: readonly string[]): void {
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(28, h.length + 4)),
  }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Build the workbook for a project's registers.
 *
 * Empty registers still get their sheet, with headers and no rows: a project
 * with no equipment yet should still hand the engineer the sheet to fill in,
 * which is the whole point of the export doubling as the template.
 */
export async function buildSSOTWorkbook(data: SSOTWorkbookData): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vapour Toolbox';
  workbook.created = new Date();

  // ── Streams ───────────────────────────────────────────────────────────
  const streams = workbook.addWorksheet('Streams');
  styleSheet(streams, STREAM_COLUMNS);
  for (const s of data.streams) {
    streams.addRow([
      s.lineTag,
      s.description ?? '',
      s.fluidType,
      s.flowInput?.value ?? s.flowRateKgS,
      s.flowInput ? FLOW_UNIT_LABELS[s.flowInput.unit] : FLOW_UNIT_LABELS.KG_S,
      s.flowRateKgS,
      s.flowRateKgHr,
      s.pressureMbar,
      s.temperature,
      s.tds ?? '',
      s.composition?.methaneMolPercent ?? '',
      s.composition?.carbonDioxideMolPercent ?? '',
      s.composition?.hydrogenSulphide ?? '',
      s.composition?.hydrogenSulphideUnit ?? '',
      s.composition?.basis ?? '',
      s.composition?.saturatedAtStreamTemperature === undefined
        ? ''
        : s.composition.saturatedAtStreamTemperature
          ? 'YES'
          : 'NO',
      s.composition?.sourceReference ?? '',
      s.density,
      s.enthalpy,
      s.specificHeat ?? '',
      s.viscosity ?? '',
      s.thermalConductivity ?? '',
      s.propertyBasis?.density ?? '',
      s.propertyBasis?.sourceReference ?? '',
    ]);
  }

  // ── Equipment ─────────────────────────────────────────────────────────
  const equipment = workbook.addWorksheet('Equipment');
  styleSheet(equipment, EQUIPMENT_COLUMNS);
  for (const e of data.equipment) {
    equipment.addRow([
      e.equipmentTag,
      e.equipmentName,
      e.equipmentType ?? '',
      e.operatingPressure,
      e.operatingTemperature,
      // Multi-valued cells are semicolon separated, not comma, because a
      // comma is what a spreadsheet uses to split a cell on paste.
      (e.fluidIn ?? []).join('; '),
      (e.fluidOut ?? []).join('; '),
      e.shellIDmm ?? '',
      e.shellLengthMM ?? '',
      e.grossVolumeM3 ?? '',
      e.liquidHoldupM3 ?? '',
      e.heatTransferAreaM2 ?? '',
      e.elevationM ?? '',
    ]);
  }

  // ── Lines ─────────────────────────────────────────────────────────────
  const lines = workbook.addWorksheet('Lines');
  styleSheet(lines, LINE_COLUMNS);
  for (const l of data.lines) {
    lines.addRow([
      l.sNo,
      l.lineNumber,
      l.fluid,
      l.inputDataTag,
      l.flowRateKgS,
      l.density,
      l.designVelocity,
      l.calculatedID,
      l.selectedID,
      l.actualVelocity,
      l.pipeSize ?? '',
      l.schedule ?? '',
      l.fromEquipmentTag ?? '',
      l.toEquipmentTag ?? '',
    ]);
  }

  // ── Instruments ───────────────────────────────────────────────────────
  const instruments = workbook.addWorksheet('Instruments');
  styleSheet(instruments, [
    'S.No',
    'P&ID No',
    'Line No',
    'Tag No',
    'Service / Location',
    'Instrument Type',
    'Fluid',
    'Range',
    'MOC',
    'Signal (PLC)',
    'I/O Type',
    'Remarks',
  ]);
  for (const i of data.instruments) {
    instruments.addRow([
      i.sNo,
      i.pidNo,
      i.lineNo,
      i.tagNo,
      i.serviceLocation,
      i.instrumentType,
      i.fluid,
      i.instRange ?? '',
      i.moc ?? '',
      i.signalPLC ?? '',
      i.ioType ?? '',
      i.remarks ?? '',
    ]);
  }

  // ── Valves ────────────────────────────────────────────────────────────
  const valves = workbook.addWorksheet('Valves');
  styleSheet(valves, [
    'S.No',
    'P&ID No',
    'Line Number',
    'Valve Tag',
    'Service / Location',
    'Valve Type',
    'End Connection',
    'Size (NB)',
    'Fluid',
    'Body Material',
    'Operation',
    'Remarks',
  ]);
  for (const v of data.valves) {
    valves.addRow([
      v.sNo,
      v.pidNo,
      v.lineNumber,
      v.valveTag,
      v.serviceLocation,
      v.valveType,
      v.endConnection,
      v.sizeNB,
      v.fluid,
      v.bodyMaterial ?? '',
      v.valveOperation ?? '',
      v.remarks ?? '',
    ]);
  }

  // ── Pipe table ────────────────────────────────────────────────────────
  const pipeTable = workbook.addWorksheet('Pipe Table');
  styleSheet(pipeTable, [
    'ID Range Min (mm)',
    'ID Range Max (mm)',
    'Pipe Size (NB)',
    'OD (mm)',
    'Thickness Sch40 (mm)',
    'ID (mm)',
  ]);
  for (const p of data.pipeTable) {
    pipeTable.addRow([
      p.idRangeMin,
      p.idRangeMax,
      p.pipeSizeNB,
      p.outerDiameter,
      p.thicknessSch40,
      p.innerDiameter,
    ]);
  }

  // Returns the raw buffer rather than a Blob: this module has no business
  // depending on the DOM, and the caller that downloads it is the one that
  // knows how. It also keeps the round trip testable without a browser.
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

/** MIME type for the workbook, for whoever wraps the buffer for download */
export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Filename for a project's register export */
export function ssotWorkbookFilename(projectCode: string): string {
  // A project code carries slashes (PRJ/26/002) and those are path separators
  const safeCode = projectCode.replace(/[/\\]/g, '-');
  return `SSOT-${safeCode}.xlsx`;
}

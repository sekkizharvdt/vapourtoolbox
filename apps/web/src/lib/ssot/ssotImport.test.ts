/**
 * SSOT Import Tests
 *
 * The test that matters is the round trip: export a register, read the file
 * back, and get the same engineering content. Everything else in this file is
 * about what happens when the file is wrong, because a spreadsheet prepared by
 * somebody else always is, somewhere.
 */

import ExcelJS from 'exceljs';
import { Timestamp } from 'firebase/firestore';
import type { ProcessStream } from '@vapour/types';
import { buildSSOTWorkbook, STREAM_COLUMNS, type SSOTWorkbookData } from './ssotExcel';
import { parseSSOTWorkbook } from './ssotImport';

const now = Timestamp.fromDate(new Date('2026-08-15T00:00:00Z'));

function makeStream(overrides: Partial<ProcessStream> = {}): ProcessStream {
  return {
    id: 'x',
    projectId: 'p',
    lineTag: 'BG-1',
    description: 'Gas from digester',
    fluidType: 'BIOGAS',
    flowRateKgS: 0.165,
    flowRateKgHr: 594,
    pressureMbar: 1100,
    pressureBar: 1.1,
    temperature: 30,
    density: 1.19,
    enthalpy: 40.35,
    composition: {
      methaneMolPercent: 60,
      carbonDioxideMolPercent: 40,
      hydrogenSulphide: 2000,
      hydrogenSulphideUnit: 'PPMV',
      basis: 'DRY',
      saturatedAtStreamTemperature: true,
    },
    flowInput: { value: 500, unit: 'M3_HR' },
    createdAt: now,
    createdBy: 'u',
    updatedAt: now,
    updatedBy: 'u',
    ...overrides,
  };
}

const EMPTY: SSOTWorkbookData = {
  projectCode: 'PRJ/26/002',
  projectName: 'BioGas',
  streams: [],
  equipment: [],
  lines: [],
  instruments: [],
  valves: [],
  pipeTable: [],
};

async function roundTrip(data: Partial<SSOTWorkbookData>) {
  const buffer = await buildSSOTWorkbook({ ...EMPTY, ...data });
  return parseSSOTWorkbook(buffer, { sourceReference: 'Client BD-1234 Rev B' });
}

describe('SSOT workbook round trip', () => {
  it('should read back a stream it exported, with its composition intact', async () => {
    const result = await roundTrip({ streams: [makeStream()] });

    expect(result.errors).toEqual([]);
    expect(result.counts.streams).toBe(1);

    const stream = result.streams[0]!;
    expect(stream.lineTag).toBe('BG-1');
    expect(stream.fluidType).toBe('BIOGAS');
    expect(stream.temperature).toBe(30);
    expect(stream.pressureMbar).toBe(1100);
    expect(stream.composition?.methaneMolPercent).toBe(60);
    expect(stream.composition?.hydrogenSulphide).toBe(2000);
    expect(stream.composition?.hydrogenSulphideUnit).toBe('PPMV');
    expect(stream.composition?.basis).toBe('DRY');
    expect(stream.composition?.saturatedAtStreamTemperature).toBe(true);
  });

  it('should preserve the flow in the unit it was entered in', async () => {
    const result = await roundTrip({ streams: [makeStream()] });
    const stream = result.streams[0]!;

    // The specification says 500 m³/hr, and that is what has to survive
    expect(stream.flowInput).toEqual({ value: 500, unit: 'M3_HR' });
    // …and it must convert to a mass flow using the density it derives itself
    expect(stream.flowRateKgS).toBeGreaterThan(0.1);
    expect(stream.flowRateKgS).toBeLessThan(0.25);
  });

  it('should recompute density from the composition rather than trusting the cell', async () => {
    // The exported density is deliberately wrong here — a hand edit in the
    // spreadsheet. The composition is the input; the density is a derived
    // value, and the derivation wins.
    const result = await roundTrip({ streams: [makeStream({ density: 999 })] });
    const stream = result.streams[0]!;

    expect(stream.density).toBeLessThan(2);
    expect(stream.density).toBeGreaterThan(0.5);
  });

  it('should stamp imported provenance keyed on the stream tag', async () => {
    const result = await roundTrip({ streams: [makeStream()] });
    const stream = result.streams[0]!;

    // The tag is what stays constant across a client's revision B, which is
    // why it is the match key rather than a generated sequence.
    expect(stream.provenance).toEqual({ source: 'IMPORTED', generatedKey: 'BG-1' });
  });

  it('should attribute supplied values to the source document', async () => {
    // Flow in kg/s here on purpose: with no analysis there is no density, and
    // a volumetric flow could not be converted at all — which the next test
    // covers separately.
    const result = await roundTrip({
      streams: [
        makeStream({ composition: undefined, flowInput: undefined, density: 1.19, enthalpy: 40 }),
      ],
    });
    const stream = result.streams[0]!;

    // No composition, so nothing could be computed — the values came from the
    // file and are marked as such, naming the document they came from.
    expect(stream.propertyBasis?.density).toBe('SUPPLIED');
    expect(stream.propertyBasis?.sourceReference).toBe('Client BD-1234 Rev B');
  });

  it('should mark composition-derived values computed, not supplied', async () => {
    const result = await roundTrip({ streams: [makeStream()] });
    const stream = result.streams[0]!;

    expect(stream.propertyBasis?.density).toBe('COMPUTED');
  });
});

describe('SSOT import — bad input', () => {
  it('should reject an unknown fluid rather than guessing', async () => {
    const result = await roundTrip({
      streams: [makeStream({ fluidType: 'PRODUCER GAS' as never })],
    });

    expect(result.counts.streams).toBe(0);
    expect(result.errors.join(' ')).toMatch(/not a known fluid type/i);
  });

  it('should report a biogas row with neither analysis nor density', async () => {
    const result = await roundTrip({
      streams: [
        makeStream({
          composition: undefined,
          flowInput: undefined,
          density: undefined as never,
        }),
      ],
    });

    expect(result.counts.streams).toBe(0);
    expect(result.errors.join(' ')).toMatch(/density/i);
  });

  it('should refuse a volumetric flow it cannot convert, rather than inventing one', async () => {
    // 500 m³/hr of a gas whose density nothing can derive. Guessing here would
    // put a mass flow into the register that nobody could trace.
    const result = await roundTrip({
      streams: [makeStream({ composition: undefined, density: undefined as never })],
    });

    expect(result.counts.streams).toBe(0);
    expect(result.errors.join(' ')).toMatch(/needs a density/i);
  });

  it('should skip a blank row without complaining', async () => {
    const exported = await buildSSOTWorkbook({ ...EMPTY, streams: [makeStream()] });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported);
    workbook.getWorksheet('Streams')!.addRow([]);
    const buffer = await workbook.xlsx.writeBuffer();

    const result = await parseSSOTWorkbook(buffer as ArrayBuffer, { sourceReference: 'X' });
    expect(result.counts.streams).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('should refuse a file with none of the expected sheets', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Something Else');
    const buffer = await workbook.xlsx.writeBuffer();

    await expect(
      parseSSOTWorkbook(buffer as ArrayBuffer, { sourceReference: 'X' })
    ).rejects.toThrow(/no streams, equipment or lines sheet/i);
  });

  it('should match columns by name, not position', async () => {
    // A column inserted at the front would shift every field if the parser
    // read by index — and the result would look like data, not an error.
    const exported = await buildSSOTWorkbook({ ...EMPTY, streams: [makeStream()] });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported);
    const sheet = workbook.getWorksheet('Streams')!;
    sheet.spliceColumns(1, 0, ['Client Ref', 'REF-1']);
    const buffer = await workbook.xlsx.writeBuffer();

    const result = await parseSSOTWorkbook(buffer as ArrayBuffer, { sourceReference: 'X' });
    expect(result.errors).toEqual([]);
    expect(result.streams[0]!.lineTag).toBe('BG-1');
    expect(result.streams[0]!.temperature).toBe(30);
  });

  it('should export every column the parser looks for', () => {
    // The export IS the template, so a column the parser needs and the export
    // omits would make a file the toolbox produced unreadable by the toolbox.
    expect(STREAM_COLUMNS).toContain('Stream Tag');
    expect(STREAM_COLUMNS).toContain('Fluid Type');
    expect(STREAM_COLUMNS).toContain('Flow Value');
    expect(STREAM_COLUMNS).toContain('Flow Unit');
    expect(STREAM_COLUMNS).toContain('CH4 (mol%)');
    expect(STREAM_COLUMNS).toContain('Analysis Basis');
  });
});

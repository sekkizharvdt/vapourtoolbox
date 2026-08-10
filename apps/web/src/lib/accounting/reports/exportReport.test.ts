/**
 * Tests for the shared accounting report export layer.
 *
 * Covers the pure pieces: cell formatting (shared by CSV and PDF, so the two
 * downloads of a report cannot disagree) and the PDF page-orientation rule.
 * Blob-producing functions are exercised by the report pages themselves.
 */

import {
  formatCellValue,
  maxColumnCount,
  resolveOrientation,
  LANDSCAPE_COLUMN_THRESHOLD,
  type ExportSection,
} from './exportReport';

const cols = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ header: `H${i}`, key: `k${i}` }));

const section = (n: number): ExportSection => ({ columns: cols(n), rows: [] });

describe('formatCellValue', () => {
  it('renders currency with exactly two decimals and Indian grouping', () => {
    expect(formatCellValue(123456.5, 'currency')).toBe('1,23,456.50');
    expect(formatCellValue(0, 'currency')).toBe('0.00');
  });

  it('keeps the sign on negative currency so credits stay distinguishable', () => {
    expect(formatCellValue(-2500, 'currency')).toBe('-2,500.00');
  });

  it('rounds to paisa rather than emitting floating-point residue (rule 21)', () => {
    expect(formatCellValue(0.1 + 0.2, 'currency')).toBe('0.30');
  });

  it('renders non-currency numbers unformatted', () => {
    expect(formatCellValue(42)).toBe('42');
  });

  it('treats null and undefined as empty, not as zero', () => {
    expect(formatCellValue(null, 'currency')).toBe('');
    expect(formatCellValue(undefined, 'currency')).toBe('');
    expect(formatCellValue(null)).toBe('');
  });

  it('formats dates via the en-IN locale', () => {
    expect(formatCellValue(new Date(2026, 7, 9))).toBe(
      new Date(2026, 7, 9).toLocaleDateString('en-IN')
    );
  });

  it('passes strings through unchanged', () => {
    expect(formatCellValue('  1001 Cash in Hand')).toBe('  1001 Cash in Hand');
  });
});

describe('maxColumnCount', () => {
  it('reports the widest section, since one report is one page size throughout', () => {
    expect(maxColumnCount([section(2), section(7), section(3)])).toBe(7);
  });

  it('returns zero for no sections', () => {
    expect(maxColumnCount([])).toBe(0);
  });
});

describe('resolveOrientation', () => {
  it('keeps narrow reports portrait', () => {
    expect(resolveOrientation([section(2)])).toBe('portrait');
  });

  it('stays portrait exactly at the threshold', () => {
    expect(resolveOrientation([section(LANDSCAPE_COLUMN_THRESHOLD)])).toBe('portrait');
  });

  it('switches to landscape past the threshold', () => {
    expect(resolveOrientation([section(LANDSCAPE_COLUMN_THRESHOLD + 1)])).toBe('landscape');
  });

  it('lets an explicit orientation win over the column heuristic', () => {
    expect(resolveOrientation([section(20)], 'portrait')).toBe('portrait');
    expect(resolveOrientation([section(1)], 'landscape')).toBe('landscape');
  });
});

import { buildCsv } from './csvExport';

describe('buildCsv', () => {
  it('emits the header row followed by the data rows', () => {
    expect(
      buildCsv(
        ['A', 'B'],
        [
          ['1', '2'],
          ['3', '4'],
        ]
      )
    ).toBe('A,B\n1,2\n3,4');
  });

  it('quotes fields containing a comma', () => {
    expect(buildCsv(['Project'], [['Narippaiyur, Phase 2']])).toBe(
      'Project\n"Narippaiyur, Phase 2"'
    );
  });

  it('escapes embedded quotes by doubling them', () => {
    expect(buildCsv(['Note'], [['He said "yes"']])).toBe('Note\n"He said ""yes"""');
  });

  it('quotes fields containing a newline', () => {
    expect(buildCsv(['Note'], [['line one\nline two']])).toBe('Note\n"line one\nline two"');
  });

  it('leaves ordinary fields unquoted', () => {
    // A quoted number is still a number to a spreadsheet, but the file is
    // noisier to read and diff.
    expect(buildCsv(['Amount'], [['318600']])).toBe('Amount\n318600');
  });

  it('handles an empty row set', () => {
    expect(buildCsv(['A', 'B'], [])).toBe('A,B');
  });
});

import {
  formatLineItemDescription,
  formatMaterialSpec,
  materialClassAbbreviation,
} from './specFormat';

describe('materialClassAbbreviation', () => {
  it('reads the class from the category, for plates and pipes alike', () => {
    expect(materialClassAbbreviation('PLATES_CARBON_STEEL')).toBe('CS');
    expect(materialClassAbbreviation('PIPES_CARBON_STEEL')).toBe('CS');
    expect(materialClassAbbreviation('PLATES_STAINLESS_STEEL')).toBe('SS');
    expect(materialClassAbbreviation('PIPES_STAINLESS_316L')).toBe('SS');
    expect(materialClassAbbreviation('PLATES_ALLOY_STEEL')).toBe('AS');
  });

  it('distinguishes super duplex from duplex — the order of the tests matters', () => {
    expect(materialClassAbbreviation('PIPES_SUPER_DUPLEX_2507')).toBe('SDX');
    expect(materialClassAbbreviation('PIPES_DUPLEX_2205')).toBe('DX');
    expect(materialClassAbbreviation('PLATES_DUPLEX_STEEL')).toBe('DX');
  });

  it('is empty for anything unmapped, so the caller omits the prefix', () => {
    expect(materialClassAbbreviation('OTHER')).toBe('');
    expect(materialClassAbbreviation('')).toBe('');
  });
});

describe('formatLineItemDescription', () => {
  it('reads as a plate callout', () => {
    expect(formatLineItemDescription('PLATES_CARBON_STEEL', 'Plate', '6000 × 1500 × 6 mm')).toBe(
      'CS Plate 6000 × 1500 × 6 mm'
    );
  });

  it('reads as a pipe callout', () => {
    expect(formatLineItemDescription('PIPES_STAINLESS_316L', 'Pipe', 'NPS 4 Sch 40')).toBe(
      'SS Pipe NPS 4 Sch 40'
    );
  });

  it('omits the parts it does not have rather than leaving gaps', () => {
    expect(formatLineItemDescription('PLATES_CARBON_STEEL', 'Plate', undefined)).toBe('CS Plate');
    expect(formatLineItemDescription('OTHER', 'Plate', '10 mm')).toBe('Plate 10 mm');
    expect(formatLineItemDescription('OTHER', undefined, undefined)).toBe('');
  });
});

describe('formatMaterialSpec', () => {
  const plate = {
    standard: 'ASTM A516/A516M',
    grade: 'Grade 70',
    form: 'Plate',
  };

  it('keeps the standard with the grade — "Grade 70" alone is ambiguous', () => {
    expect(formatMaterialSpec(plate, { includeForm: false })).toBe('ASTM A516/A516M · Grade 70');
  });

  it('still includes form by default, for the catalog surfaces that want it', () => {
    expect(formatMaterialSpec(plate)).toBe('ASTM A516/A516M · Grade 70 · Plate');
  });

  it('is empty when there is no spec at all', () => {
    expect(formatMaterialSpec(undefined)).toBe('');
    expect(formatMaterialSpec({})).toBe('');
  });
});

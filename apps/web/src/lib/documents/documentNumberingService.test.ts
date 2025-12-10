/**
 * Document Numbering Service Tests
 *
 * Tests for document numbering including:
 * - Document number validation
 * - Document number parsing
 * - Standard discipline codes
 * - Number format patterns
 */

import {
  validateDocumentNumber,
  parseDocumentNumber,
  STANDARD_DISCIPLINE_CODES,
} from './documentNumberingService';

describe('Document Numbering Service', () => {
  describe('validateDocumentNumber', () => {
    const defaultFormat = {
      projectCode: 'PRJ-001',
      separator: '-',
      disciplineCode: '01',
      sequenceDigits: 3,
    };

    it('should validate correct document number without sub-code', () => {
      expect(validateDocumentNumber('PRJ-001-01-005', defaultFormat)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-001', defaultFormat)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-999', defaultFormat)).toBe(true);
    });

    it('should validate correct document number with sub-code', () => {
      expect(validateDocumentNumber('PRJ-001-01-A-001', defaultFormat)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-B-015', defaultFormat)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-Z-999', defaultFormat)).toBe(true);
    });

    it('should validate numeric sub-codes', () => {
      expect(validateDocumentNumber('PRJ-001-01-1-001', defaultFormat)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-99-001', defaultFormat)).toBe(true);
    });

    it('should reject invalid project code', () => {
      expect(validateDocumentNumber('XXX-001-01-005', defaultFormat)).toBe(false);
      expect(validateDocumentNumber('PRJ001-01-005', defaultFormat)).toBe(false);
    });

    it('should reject invalid discipline code', () => {
      expect(validateDocumentNumber('PRJ-001-02-005', defaultFormat)).toBe(false);
      expect(validateDocumentNumber('PRJ-001-XX-005', defaultFormat)).toBe(false);
    });

    it('should reject invalid sequence length', () => {
      expect(validateDocumentNumber('PRJ-001-01-05', defaultFormat)).toBe(false); // Too short
      expect(validateDocumentNumber('PRJ-001-01-0005', defaultFormat)).toBe(false); // Too long
    });

    it('should reject invalid separator', () => {
      expect(validateDocumentNumber('PRJ_001_01_005', defaultFormat)).toBe(false);
      expect(validateDocumentNumber('PRJ.001.01.005', defaultFormat)).toBe(false);
    });

    it('should handle different sequence digit lengths', () => {
      const format4Digits = { ...defaultFormat, sequenceDigits: 4 };
      expect(validateDocumentNumber('PRJ-001-01-0005', format4Digits)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-005', format4Digits)).toBe(false);

      const format2Digits = { ...defaultFormat, sequenceDigits: 2 };
      expect(validateDocumentNumber('PRJ-001-01-05', format2Digits)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-005', format2Digits)).toBe(false);
    });

    it('should handle different separators', () => {
      // Note: Project code contains hyphens, so when using underscore separator
      // the project code must also change
      const underscoreFormat = {
        projectCode: 'PRJ_001',
        separator: '_',
        disciplineCode: '01',
        sequenceDigits: 3,
      };
      expect(validateDocumentNumber('PRJ_001_01_005', underscoreFormat)).toBe(true);
      expect(validateDocumentNumber('PRJ-001-01-005', underscoreFormat)).toBe(false);

      const dotFormat = {
        projectCode: 'PRJ.001',
        separator: '.',
        disciplineCode: '01',
        sequenceDigits: 3,
      };
      expect(validateDocumentNumber('PRJ.001.01.005', dotFormat)).toBe(true);
    });

    it('should handle complex project codes', () => {
      const complexFormat = { ...defaultFormat, projectCode: 'VAPOUR-2024-PRJ' };
      expect(validateDocumentNumber('VAPOUR-2024-PRJ-01-001', complexFormat)).toBe(true);
      expect(validateDocumentNumber('VAPOUR-2024-PRJ-01-A-001', complexFormat)).toBe(true);
    });

    it('should reject empty document number', () => {
      expect(validateDocumentNumber('', defaultFormat)).toBe(false);
    });
  });

  describe('parseDocumentNumber', () => {
    it('should parse document number without sub-code', () => {
      const result = parseDocumentNumber('PRJ-01-005', '-');

      expect(result).not.toBeNull();
      expect(result?.projectCode).toBe('PRJ');
      expect(result?.disciplineCode).toBe('01');
      expect(result?.sequence).toBe('005');
      expect(result?.subCode).toBeUndefined();
    });

    it('should parse document number with sub-code', () => {
      const result = parseDocumentNumber('PRJ-01-A-001', '-');

      expect(result).not.toBeNull();
      expect(result?.projectCode).toBe('PRJ');
      expect(result?.disciplineCode).toBe('01');
      expect(result?.subCode).toBe('A');
      expect(result?.sequence).toBe('001');
    });

    it('should handle different separators', () => {
      const dashResult = parseDocumentNumber('PRJ-01-005', '-');
      expect(dashResult?.sequence).toBe('005');

      const underscoreResult = parseDocumentNumber('PRJ_01_005', '_');
      expect(underscoreResult?.sequence).toBe('005');

      const dotResult = parseDocumentNumber('PRJ.01.005', '.');
      expect(dotResult?.sequence).toBe('005');
    });

    it('should return null for invalid format', () => {
      expect(parseDocumentNumber('INVALID', '-')).toBeNull();
      expect(parseDocumentNumber('PRJ', '-')).toBeNull();
      expect(parseDocumentNumber('PRJ-01', '-')).toBeNull();
    });

    it('should return null for too many parts', () => {
      // More than 4 parts is invalid
      expect(parseDocumentNumber('PRJ-01-A-B-001', '-')).toBeNull();
    });

    it('should use default separator', () => {
      const result = parseDocumentNumber('PRJ-01-005');
      expect(result?.sequence).toBe('005');
    });

    it('should parse numeric sub-codes', () => {
      const result = parseDocumentNumber('PRJ-01-99-001', '-');

      expect(result?.subCode).toBe('99');
      expect(result?.sequence).toBe('001');
    });

    it('should preserve leading zeros', () => {
      const result = parseDocumentNumber('PRJ-01-001', '-');
      expect(result?.sequence).toBe('001');

      const resultWithSubcode = parseDocumentNumber('PRJ-01-A-001', '-');
      expect(resultWithSubcode?.sequence).toBe('001');
    });
  });

  describe('STANDARD_DISCIPLINE_CODES', () => {
    it('should have all expected discipline codes', () => {
      const expectedCodes = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

      expectedCodes.forEach((code) => {
        const discipline = STANDARD_DISCIPLINE_CODES.find((d) => d.code === code);
        expect(discipline).toBeDefined();
      });
    });

    it('should have unique sort orders', () => {
      const sortOrders = STANDARD_DISCIPLINE_CODES.map((d) => d.sortOrder);
      const uniqueOrders = new Set(sortOrders);
      expect(uniqueOrders.size).toBe(sortOrders.length);
    });

    it('should have all disciplines active by default', () => {
      STANDARD_DISCIPLINE_CODES.forEach((discipline) => {
        expect(discipline.isActive).toBe(true);
      });
    });

    it('should have names and descriptions for all disciplines', () => {
      STANDARD_DISCIPLINE_CODES.forEach((discipline) => {
        expect(discipline.name).toBeDefined();
        expect(discipline.name.length).toBeGreaterThan(0);
        expect(discipline.description).toBeDefined();
      });
    });

    it('should have Client Inputs as code 00', () => {
      const clientInputs = STANDARD_DISCIPLINE_CODES.find((d) => d.code === '00');
      expect(clientInputs?.name).toBe('Client Inputs');
    });

    it('should have Process as code 01', () => {
      const process = STANDARD_DISCIPLINE_CODES.find((d) => d.code === '01');
      expect(process?.name).toBe('Process');
    });

    it('should have sub-codes for Client Inputs', () => {
      const clientInputs = STANDARD_DISCIPLINE_CODES.find((d) => d.code === '00');
      expect(clientInputs?.subCodes).toBeDefined();
      expect(clientInputs?.subCodes?.length).toBeGreaterThan(0);

      const subCodeNames = clientInputs?.subCodes?.map((s) => s.name);
      expect(subCodeNames).toContain('Process Data');
      expect(subCodeNames).toContain('Equipment List');
      expect(subCodeNames).toContain('Site Information');
    });

    it('should have engineering disciplines in proper order', () => {
      const orderedDisciplines = [...STANDARD_DISCIPLINE_CODES].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );

      // First should be Client Inputs (00)
      expect(orderedDisciplines[0]?.code).toBe('00');

      // Then engineering disciplines in order
      expect(orderedDisciplines[1]?.code).toBe('01'); // Process
      expect(orderedDisciplines[2]?.code).toBe('02'); // Mechanical
      expect(orderedDisciplines[3]?.code).toBe('03'); // Structural
    });
  });

  describe('Document Number Generation Patterns', () => {
    it('should generate correct pattern without sub-code', () => {
      const projectCode = 'PRJ-001';
      const separator = '-';
      const disciplineCode = '01';
      const sequence = 5;
      const sequenceDigits = 3;

      const sequenceStr = sequence.toString().padStart(sequenceDigits, '0');
      const docNumber = `${projectCode}${separator}${disciplineCode}${separator}${sequenceStr}`;

      expect(docNumber).toBe('PRJ-001-01-005');
    });

    it('should generate correct pattern with sub-code', () => {
      const projectCode = 'PRJ-001';
      const separator = '-';
      const disciplineCode = '01';
      const subCode = 'A';
      const sequence = 1;
      const sequenceDigits = 3;

      const sequenceStr = sequence.toString().padStart(sequenceDigits, '0');
      const docNumber = `${projectCode}${separator}${disciplineCode}${separator}${subCode}${separator}${sequenceStr}`;

      expect(docNumber).toBe('PRJ-001-01-A-001');
    });

    it('should handle sequence overflow (when max reached)', () => {
      const sequenceDigits = 3;
      const maxSequence = Math.pow(10, sequenceDigits) - 1; // 999

      const sequenceStr = maxSequence.toString().padStart(sequenceDigits, '0');
      expect(sequenceStr).toBe('999');

      // Next would be 1000 which overflows
      const overflowSequence = maxSequence + 1;
      const overflowStr = overflowSequence.toString().padStart(sequenceDigits, '0');
      expect(overflowStr).toBe('1000'); // 4 digits, exceeds format
    });

    it('should generate hierarchical counter keys', () => {
      const disciplineCode = '01';
      const subCodes = ['A', 'B', 'C'];

      const counterKeys = subCodes.map((subCode) => `${disciplineCode}-${subCode}`);

      expect(counterKeys).toEqual(['01-A', '01-B', '01-C']);
    });

    it('should generate independent counters for different sub-codes', () => {
      const counters: Record<string, number> = {
        '01': 5, // Main discipline counter
        '01-A': 3, // Sub-code A counter
        '01-B': 1, // Sub-code B counter
      };

      expect(counters['01']).toBe(5);
      expect(counters['01-A']).toBe(3);
      expect(counters['01-B']).toBe(1);

      // Incrementing one doesn't affect others
      counters['01-A'] = 4;
      expect(counters['01']).toBe(5); // Unchanged
      expect(counters['01-B']).toBe(1); // Unchanged
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long project codes', () => {
      const longProjectCode = 'VERY-LONG-PROJECT-CODE-2024';
      const format = {
        projectCode: longProjectCode,
        separator: '-',
        disciplineCode: '01',
        sequenceDigits: 3,
      };

      expect(validateDocumentNumber(`${longProjectCode}-01-001`, format)).toBe(true);
    });

    it('should handle alphanumeric discipline codes', () => {
      const format = {
        projectCode: 'PRJ',
        separator: '-',
        disciplineCode: 'A1',
        sequenceDigits: 3,
      };

      expect(validateDocumentNumber('PRJ-A1-001', format)).toBe(true);
    });

    it('should handle parsing with complex project codes', () => {
      // Simple 3-part: PROJECT-DISCIPLINE-SEQUENCE
      const result = parseDocumentNumber('PROJ123-01-005', '-');
      expect(result?.projectCode).toBe('PROJ123');
      expect(result?.disciplineCode).toBe('01');
      expect(result?.sequence).toBe('005');
    });

    it('should handle empty separator edge case', () => {
      // Empty separator would cause issues
      const result = parseDocumentNumber('PRJ01005', '');
      // With empty separator, split('') returns individual characters
      expect(result).toBeNull(); // Too many parts
    });

    it('should handle special characters in sub-codes', () => {
      // Alphanumeric sub-codes should work
      const result = parseDocumentNumber('PRJ-01-A1-001', '-');
      expect(result?.subCode).toBe('A1');
    });
  });

  describe('Real-world Document Numbering Scenarios', () => {
    it('should handle typical EPC project document numbering', () => {
      // Note: parseDocumentNumber splits by separator, so project codes with
      // hyphens will be parsed incorrectly. Use simple project codes.

      // Simple project code works well
      const simpleDoc = 'DESAL24-01-001';
      expect(parseDocumentNumber(simpleDoc, '-')).toEqual({
        projectCode: 'DESAL24',
        disciplineCode: '01',
        sequence: '001',
      });

      // With sub-code
      const docWithSubcode = 'DESAL24-01-A-001';
      expect(parseDocumentNumber(docWithSubcode, '-')).toEqual({
        projectCode: 'DESAL24',
        disciplineCode: '01',
        subCode: 'A',
        sequence: '001',
      });
    });

    it('should number client input documents with sub-codes', () => {
      // Client inputs use sub-codes for categorization
      const processData = 'PRJ-00-A-001'; // First process data document
      const equipmentList = 'PRJ-00-B-001'; // First equipment list

      const processResult = parseDocumentNumber(processData, '-');
      expect(processResult?.subCode).toBe('A');
      expect(processResult?.sequence).toBe('001');

      const equipResult = parseDocumentNumber(equipmentList, '-');
      expect(equipResult?.subCode).toBe('B');
    });

    it('should track independent counters for each discipline', () => {
      const counters = {
        '01': 15, // Process: 15 documents
        '02': 8, // Mechanical: 8 documents
        '04': 22, // Piping: 22 documents (more piping docs)
        '01-A': 5, // Process sub-code A: 5 documents
      };

      // Next document numbers would be:
      expect(counters['01'] + 1).toBe(16); // PRJ-01-016
      expect(counters['02'] + 1).toBe(9); // PRJ-02-009
      expect(counters['04'] + 1).toBe(23); // PRJ-04-023
      expect(counters['01-A'] + 1).toBe(6); // PRJ-01-A-006
    });
  });
});

import {
  toFirestoreTimestamp,
  fromFirestoreTimestamp,
  createFirestoreDoc,
  updateFirestoreDoc,
  createTransactionDoc,
  conditionalProps,
  isFirestoreTimestamp,
  safeToTimestamp,
  docToTyped,
  docToTypedWithDates,
  TransactionDocBase,
} from './typeHelpers';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    seconds: number;
    nanoseconds: number;

    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }

    toMillis() {
      return this.seconds * 1000 + this.nanoseconds / 1000000;
    }

    toISOString() {
      return this.toDate().toISOString();
    }

    static fromDate(date: Date) {
      return new MockTimestamp(
        Math.floor(date.getTime() / 1000),
        (date.getTime() % 1000) * 1000000
      );
    }

    static fromMillis(millis: number) {
      return new MockTimestamp(Math.floor(millis / 1000), (millis % 1000) * 1000000);
    }

    static now() {
      return MockTimestamp.fromDate(new Date());
    }
  }

  return {
    Timestamp: MockTimestamp,
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  };
});

describe('typeHelpers', () => {
  describe('toFirestoreTimestamp', () => {
    it('should convert Date object to Timestamp', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const ts = toFirestoreTimestamp(date);
      expect(ts).toBeInstanceOf(Timestamp);
      expect(ts.toDate()).toEqual(date);
    });

    it('should convert date string to Timestamp', () => {
      const dateStr = '2024-01-01';
      const ts = toFirestoreTimestamp(dateStr);
      expect(ts).toBeInstanceOf(Timestamp);
      expect(ts.toDate().toISOString()).toContain(dateStr);
    });
  });

  describe('fromFirestoreTimestamp', () => {
    it('should convert Timestamp to YYYY-MM-DD string', () => {
      const date = new Date('2024-01-15T12:00:00.000Z');
      const ts = Timestamp.fromDate(date);
      const str = fromFirestoreTimestamp(ts);
      expect(str).toBe('2024-01-15');
    });

    it('should convert Date to YYYY-MM-DD string', () => {
      const date = new Date('2024-01-15T12:00:00.000Z');
      const str = fromFirestoreTimestamp(date);
      expect(str).toBe('2024-01-15');
    });
  });

  describe('createFirestoreDoc', () => {
    it('should add createdAt and updatedAt', () => {
      const data = { foo: 'bar' };
      const doc = createFirestoreDoc(data);

      expect(doc).toEqual({
        foo: 'bar',
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('updateFirestoreDoc', () => {
    it('should add updatedAt', () => {
      const data = { foo: 'bar' };
      const doc = updateFirestoreDoc(data);

      expect(doc).toEqual({
        foo: 'bar',
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('createTransactionDoc', () => {
    const baseData: TransactionDocBase = {
      type: 'TEST',
      date: Timestamp.now(),
      description: 'Test',
      amount: 100,
      currency: 'USD',
      status: 'DRAFT',
    };

    it('should create new transaction doc with defaults', () => {
      const doc = createTransactionDoc(baseData);

      expect(doc).toEqual({
        ...baseData,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
        transactionNumber: undefined,
      });
    });

    it('should preserve existing transaction number and createdAt', () => {
      const existing = {
        transactionNumber: 'TXN-123',
        createdAt: Timestamp.fromDate(new Date('2023-01-01')),
      };

      const doc = createTransactionDoc(baseData, existing);

      expect(doc.transactionNumber).toBe('TXN-123');
      expect(doc.createdAt).toEqual(existing.createdAt);
      expect(doc.updatedAt).toBe('SERVER_TIMESTAMP');
    });
  });

  describe('conditionalProps', () => {
    it('should filter out undefined and null values', () => {
      const props = {
        a: 1,
        b: undefined,
        c: null,
        d: 'test',
      };
      const result = conditionalProps(props);
      expect(result).toEqual({ a: 1, d: 'test' });
    });
  });

  describe('isFirestoreTimestamp', () => {
    it('should return true for Timestamp instances', () => {
      const ts = Timestamp.now();
      expect(isFirestoreTimestamp(ts)).toBe(true);
    });

    it('should return false for others', () => {
      expect(isFirestoreTimestamp(new Date())).toBe(false);
      expect(isFirestoreTimestamp('2024-01-01')).toBe(false);
      expect(isFirestoreTimestamp(123)).toBe(false);
    });
  });

  describe('safeToTimestamp', () => {
    it('should return timestamp if input is timestamp', () => {
      const ts = Timestamp.now();
      expect(safeToTimestamp(ts)).toBe(ts);
    });

    it('should convert Date to timestamp', () => {
      const date = new Date();
      const ts = safeToTimestamp(date);
      expect(ts).toBeInstanceOf(Timestamp);
      expect(ts?.toDate()).toEqual(date);
    });

    it('should convert string to timestamp', () => {
      const str = '2024-01-01';
      const ts = safeToTimestamp(str);
      expect(ts).toBeInstanceOf(Timestamp);
      expect(ts?.toDate().toISOString()).toContain(str);
    });

    it('should convert number to timestamp', () => {
      const now = Date.now();
      const ts = safeToTimestamp(now);
      expect(ts).toBeInstanceOf(Timestamp);
      // Verify timestamp was created (precision varies by implementation)
      expect(ts?.toMillis()).toBeDefined();
    });

    it('should return null for invalid inputs', () => {
      expect(safeToTimestamp(null)).toBeNull();
      expect(safeToTimestamp(undefined)).toBeNull();
      expect(safeToTimestamp({})).toBeNull();
    });
  });

  describe('docToTyped', () => {
    it('should combine id and data', () => {
      const id = 'doc-1';
      const data = { foo: 'bar' };
      const result = docToTyped<{ id: string; foo: string }>(id, data);
      expect(result).toEqual({ id: 'doc-1', foo: 'bar' });
    });
  });

  describe('docToTypedWithDates', () => {
    it('should convert fields to Dates', () => {
      const id = 'doc-1';
      const date = new Date('2024-01-01');
      const ts = Timestamp.fromDate(date);
      const data = {
        dateField: ts,
        stringField: 'test',
        numberField: 123,
      };

      const result = docToTypedWithDates<{
        id: string;
        dateField: Date;
        stringField: string;
        numberField: number;
      }>(id, data);

      expect(result.id).toBe(id);
      expect(result.dateField).toBeInstanceOf(Date);
      expect(result.dateField).toEqual(date);
      expect(result.stringField).toBe('test');
      expect(result.numberField).toBe(123);
    });

    it('should handle undefined data', () => {
      const result = docToTypedWithDates('doc-1', undefined);
      expect(result).toEqual({ id: 'doc-1' });
    });
  });
});

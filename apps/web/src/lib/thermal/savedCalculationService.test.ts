/**
 * Saved Calculation Service Tests
 *
 * Tests for the stripUndefined helper that sanitises payloads before
 * Firestore writes (rule 12 — Firestore rejects `undefined`).
 */

import { Timestamp } from 'firebase/firestore';
import { stripUndefined } from './savedCalculationService';

describe('stripUndefined', () => {
  it('removes top-level undefined keys', () => {
    const result = stripUndefined({ a: 1, b: undefined, c: 'x' });
    expect(result).toEqual({ a: 1, c: 'x' });
    expect('b' in result).toBe(false);
  });

  it('removes nested undefined keys recursively', () => {
    const result = stripUndefined({
      a: { b: { c: undefined, d: 2 }, e: undefined },
      f: 3,
    });
    expect(result).toEqual({ a: { b: { d: 2 } }, f: 3 });
    expect('c' in (result.a.b as object)).toBe(false);
    expect('e' in (result.a as object)).toBe(false);
  });

  it('preserves arrays as arrays and recurses into their elements', () => {
    const result = stripUndefined({
      list: [{ a: 1, b: undefined }, { c: 2 }],
    });
    expect(Array.isArray(result.list)).toBe(true);
    expect(result.list).toEqual([{ a: 1 }, { c: 2 }]);
  });

  it('converts undefined array elements to null instead of dropping them', () => {
    const result = stripUndefined({ list: [1, undefined, 3] });
    expect(result.list).toEqual([1, null, 3]);
    expect(result.list).toHaveLength(3);
  });

  it('leaves Date instances untouched (no recursion into them)', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const result = stripUndefined({ createdAt: date, x: undefined });
    expect(result.createdAt).toBe(date); // same reference
    expect(result).toEqual({ createdAt: date });
  });

  it('leaves Firestore Timestamp-like class instances untouched', () => {
    // Real Firestore Timestamps are class instances; the helper must pass
    // any non-plain object through without recursing or cloning it.
    class FakeTimestamp {
      constructor(
        public seconds: number,
        public nanoseconds: number
      ) {}
      toDate() {
        return new Date(this.seconds * 1000);
      }
    }
    const ts = new FakeTimestamp(1750000000, 0);
    const result = stripUndefined({ updatedAt: ts, gone: undefined });
    expect(result.updatedAt).toBe(ts); // same reference, not cloned
    expect(result).toEqual({ updatedAt: ts });
  });

  it('passes through the mocked serverTimestamp/Timestamp sentinel values without throwing', () => {
    const sentinel = Timestamp.now();
    const result = stripUndefined({ createdAt: sentinel });
    expect(result.createdAt).toEqual(sentinel);
  });

  it('preserves null, 0, empty string, and false (only undefined is stripped)', () => {
    const input = { a: null, b: 0, c: '', d: false };
    expect(stripUndefined(input)).toEqual(input);
  });

  it('returns primitives unchanged', () => {
    expect(stripUndefined(42)).toBe(42);
    expect(stripUndefined('x')).toBe('x');
    expect(stripUndefined(null)).toBe(null);
  });

  it('handles deeply nested arrays of objects', () => {
    const result = stripUndefined({
      effects: [{ stages: [{ t: 60, p: undefined }] }],
    });
    expect(result).toEqual({ effects: [{ stages: [{ t: 60 }] }] });
  });
});

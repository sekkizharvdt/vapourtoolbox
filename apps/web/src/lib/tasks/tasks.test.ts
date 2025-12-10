/**
 * Tasks Module Tests
 *
 * Tests for task-related utility functions including:
 * - Thread utilities (mention parsing, formatting)
 * - Time entry utilities (duration formatting, elapsed time calculation)
 * - Mention utilities (user ID extraction)
 */

import { Timestamp } from 'firebase/firestore';
import type { TimeEntry } from '@vapour/types';
import { parseMentions, formatMentions } from './threadService';
import { formatDuration, calculateElapsedTime } from './timeEntryService';
import { extractUserIdFromMention } from './mentionService';

// Mock Timestamp helper
const createMockTimestamp = (date: Date) =>
  ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as unknown as Timestamp;

// Helper to create mock TimeEntry
const createMockTimeEntry = (overrides: Partial<TimeEntry> = {}): TimeEntry => {
  const entry: TimeEntry = {
    id: 'entry-1',
    userId: 'user-1',
    taskNotificationId: 'task-1',
    startTime: createMockTimestamp(new Date()),
    duration: 0,
    isActive: true,
    createdAt: createMockTimestamp(new Date()),
    ...overrides,
  };
  return entry;
};

describe('Tasks Module', () => {
  // ============================================================================
  // THREAD SERVICE TESTS
  // ============================================================================

  describe('threadService', () => {
    describe('parseMentions', () => {
      it('should parse @[userId] format mentions', () => {
        const content = 'Hello @[user123] please review this';
        expect(parseMentions(content)).toEqual(['user123']);
      });

      it('should parse @userId format mentions', () => {
        const content = 'Hello @john please review this';
        expect(parseMentions(content)).toEqual(['john']);
      });

      it('should parse multiple mentions', () => {
        const content = '@[user1] and @[user2] please check @jane';
        expect(parseMentions(content)).toEqual(['user1', 'user2', 'jane']);
      });

      it('should return unique mentions only', () => {
        const content = '@[user1] mentioned @[user1] twice';
        expect(parseMentions(content)).toEqual(['user1']);
      });

      it('should return empty array for no mentions', () => {
        const content = 'Hello world, no mentions here';
        expect(parseMentions(content)).toEqual([]);
      });

      it('should handle empty content', () => {
        expect(parseMentions('')).toEqual([]);
      });

      it('should handle complex userIds in brackets', () => {
        const content = '@[abc-123-def] review needed';
        expect(parseMentions(content)).toEqual(['abc-123-def']);
      });

      it('should parse mixed mention formats', () => {
        const content = 'Hey @[user-uuid-123] and @simpleuser check this';
        expect(parseMentions(content)).toEqual(['user-uuid-123', 'simpleuser']);
      });
    });

    describe('formatMentions', () => {
      it('should replace @[userId] with display name', () => {
        const content = 'Hello @[user123]';
        const userMap = { user123: 'John Doe' };
        expect(formatMentions(content, userMap)).toBe('Hello @John Doe');
      });

      it('should handle multiple users', () => {
        const content = '@[user1] and @[user2] please review';
        const userMap = { user1: 'Alice', user2: 'Bob' };
        expect(formatMentions(content, userMap)).toBe('@Alice and @Bob please review');
      });

      it('should fallback to userId if display name not found', () => {
        const content = 'Hello @[unknownuser]';
        const userMap = {};
        expect(formatMentions(content, userMap)).toBe('Hello @unknownuser');
      });

      it('should handle empty user map', () => {
        const content = '@[user1] check this';
        expect(formatMentions(content, {})).toBe('@user1 check this');
      });

      it('should not affect non-mention text', () => {
        const content = 'Hello world';
        expect(formatMentions(content, {})).toBe('Hello world');
      });
    });
  });

  // ============================================================================
  // TIME ENTRY SERVICE TESTS
  // ============================================================================

  describe('timeEntryService', () => {
    describe('formatDuration', () => {
      it('should format seconds only', () => {
        expect(formatDuration(45)).toBe('45s');
      });

      it('should format minutes and seconds', () => {
        expect(formatDuration(125)).toBe('2m 5s');
      });

      it('should format hours, minutes, and seconds', () => {
        expect(formatDuration(3665)).toBe('1h 1m 5s');
      });

      it('should format hours only', () => {
        expect(formatDuration(3600)).toBe('1h');
      });

      it('should format minutes only', () => {
        expect(formatDuration(60)).toBe('1m');
      });

      it('should format hours and minutes without seconds', () => {
        expect(formatDuration(3660)).toBe('1h 1m');
      });

      it('should handle zero seconds', () => {
        expect(formatDuration(0)).toBe('0s');
      });

      it('should handle large durations', () => {
        // 10 hours, 30 minutes, 15 seconds = 37815 seconds
        expect(formatDuration(37815)).toBe('10h 30m 15s');
      });
    });

    describe('calculateElapsedTime', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should return duration for inactive time entry', () => {
        const entry = createMockTimeEntry({
          isActive: false,
          duration: 3600,
        });
        expect(calculateElapsedTime(entry)).toBe(3600);
      });

      it('should calculate elapsed time for active entry', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const now = new Date('2024-01-01T11:00:00Z'); // 1 hour later
        jest.setSystemTime(now);

        const entry = createMockTimeEntry({
          isActive: true,
          startTime: createMockTimestamp(startTime),
          pausedDuration: 0,
        });

        expect(calculateElapsedTime(entry)).toBe(3600); // 1 hour in seconds
      });

      it('should exclude paused duration from elapsed time', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const now = new Date('2024-01-01T11:00:00Z'); // 1 hour later
        jest.setSystemTime(now);

        const entry = createMockTimeEntry({
          isActive: true,
          startTime: createMockTimestamp(startTime),
          pausedDuration: 600, // 10 minutes paused
        });

        expect(calculateElapsedTime(entry)).toBe(3000); // 50 minutes in seconds
      });

      it('should handle currently paused entry', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const pausedAt = new Date('2024-01-01T10:30:00Z'); // Paused after 30 min
        const now = new Date('2024-01-01T11:00:00Z'); // 1 hour from start
        jest.setSystemTime(now);

        const entry = createMockTimeEntry({
          isActive: true,
          startTime: createMockTimestamp(startTime),
          pausedAt: createMockTimestamp(pausedAt),
          pausedDuration: 0,
        });

        // 3600 total - 1800 current pause = 1800 (30 min)
        expect(calculateElapsedTime(entry)).toBe(1800);
      });

      it('should not return negative elapsed time', () => {
        const startTime = new Date('2024-01-01T10:00:00Z');
        const now = new Date('2024-01-01T10:01:00Z'); // 1 minute later
        jest.setSystemTime(now);

        const entry = createMockTimeEntry({
          isActive: true,
          startTime: createMockTimestamp(startTime),
          pausedDuration: 120, // 2 minutes paused (more than elapsed)
        });

        expect(calculateElapsedTime(entry)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ============================================================================
  // MENTION SERVICE TESTS
  // ============================================================================

  describe('mentionService', () => {
    describe('extractUserIdFromMention', () => {
      it('should extract userId from @[userId] format', () => {
        expect(extractUserIdFromMention('@[user123]')).toBe('user123');
      });

      it('should extract userId with complex characters', () => {
        expect(extractUserIdFromMention('@[abc-123-def]')).toBe('abc-123-def');
      });

      it('should return null for invalid format', () => {
        expect(extractUserIdFromMention('@username')).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(extractUserIdFromMention('')).toBeNull();
      });

      it('should return null for text without mention', () => {
        expect(extractUserIdFromMention('Hello world')).toBeNull();
      });

      it('should extract first userId if multiple in text', () => {
        expect(extractUserIdFromMention('@[user1] and @[user2]')).toBe('user1');
      });
    });
  });
});

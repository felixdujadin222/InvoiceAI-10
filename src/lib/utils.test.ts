import { describe, it, expect } from 'vitest';
import { cn, toJsDate } from './utils';

describe('cn (tailwind class merger)', () => {
  it('joins conditional classes and drops falsy ones', () => {
    expect(cn('px-2', false && 'py-3', undefined, 'mt-1')).toBe('px-2 mt-1');
  });

  it('lets later utilities win conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles arrays of classes', () => {
    expect(cn(['a', 'b'], 'c')).toContain('a b c');
  });
});

describe('toJsDate (timestamp normalizer)', () => {
  const EPOCH_MS = 0;

  it('unwraps Firestore Timestamp-like objects', () => {
    const ts = { toDate: () => new Date('2026-01-15T10:00:00Z') };
    expect(toJsDate(ts).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('parses ISO strings and epoch numbers', () => {
    expect(toJsDate('2026-03-01T00:00:00Z').toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(toJsDate(1700000000000).getTime()).toBe(1700000000000);
  });

  it('falls back to epoch for null/undefined/garbage', () => {
    expect(toJsDate(null).getTime()).toBe(EPOCH_MS);
    expect(toJsDate(undefined).getTime()).toBe(EPOCH_MS);
    expect(toJsDate({}).getTime()).toBe(EPOCH_MS);
    expect(toJsDate('not-a-date').getTime()).toBe(EPOCH_MS);
  });
});


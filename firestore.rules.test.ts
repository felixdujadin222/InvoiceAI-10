import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Static validation of firestore.rules against the security invariants
 * documented in security_spec.md ("Dirty Dozen" deny cases).
 *
 * These tests run fully offline (no emulator) — they assert the rules file
 * contains the required deny/gate patterns so regressions are caught in CI.
 */
let rules = '';

beforeAll(() => {
  rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf-8');
});

function has(needle: string): boolean {
  return rules.includes(needle);
}

describe('firestore.rules', () => {
  it('starts with rules_version 2 and the cloud.firestore service', () => {
    expect(has("rules_version = '2'")).toBe(true);
    expect(has('service cloud.firestore')).toBe(true);
  });

  it('has a global safety net that denies everything by default', () => {
    expect(has('match /{document=**}')).toBe(true);
    expect(has('allow read, write: if false')).toBe(true);
  });

  describe('authentication primitives', () => {
    it('defines isSignedIn, isOwner, and isValidId helpers', () => {
      expect(has('function isSignedIn()')).toBe(true);
      expect(has('function isOwner(userId)')).toBe(true);
      expect(has("request.auth.uid == userId")).toBe(true);
      expect(has('function isValidId(id)')).toBe(true);
    });

    it('restricts IDs to a safe pattern (rejects traversal / ../ )', () => {
      expect(has('id.matches')).toBe(true);
      expect(has('id.size() <= 128')).toBe(true);
    });
  });

  describe('data validation helpers', () => {
    it('validates user profiles bind userId to the auth uid', () => {
      expect(has('function isValidUser(data, userId)')).toBe(true);
      expect(has('data.userId == userId')).toBe(true);
    });

    it('validates clients and invoices on shape + size', () => {
      expect(has('function isValidClient(data, userId)')).toBe(true);
      expect(has('function isValidInvoice(data, userId)')).toBe(true);
      expect(has('data.items.size() <= 100')).toBe(true);
      expect(has("data.status in ['draft', 'sent', 'paid', 'overdue']")).toBe(true);
    });
  });

  describe('tenant isolation (Dirty Dozen #1, #3, #4)', () => {
    it('only lets the owner read/write their own clients', () => {
      expect(has('match /clients/{clientId}')).toBe(true);
      // allow get/list/create/update/delete guarded by isOwner(userId)
      expect(has('allow delete: if isOwner(userId)')).toBe(true);
    });

    it('only lets the owner read/write their own recurring/expenses/quotes/templates', () => {
      const subs: Record<string, string> = {
        recurring: 'recurringId',
        expenses: 'expenseId',
        quotes: 'quoteId',
        templates: 'templateId',
      };
      for (const [path, idParam] of Object.entries(subs)) {
        expect(has(`match /${path}/{${idParam}}`)).toBe(true);
        expect(has('allow read, write: if isOwner(userId)')).toBe(true);
      }
    });
  });

  describe('public invoice access (invariant #4)', () => {
    it('allows single-doc get publicly but list only for owner', () => {
      expect(has('match /invoices/{invoiceId}')).toBe(true);
      expect(has('allow get: if true')).toBe(true);
      expect(has('allow list: if isOwner(userId)')).toBe(true);
    });

    it('allows a simulated public payment that only flips status to paid', () => {
      expect(has('incoming().status == \'paid\'')).toBe(true);
      expect(has("hasOnly(['status', 'updatedAt'])")).toBe(true);
    });

    it('only lets the owner create, update, and delete invoices', () => {
      expect(has('allow create: if isOwner(userId)')).toBe(true);
      expect(has('allow delete: if isOwner(userId)')).toBe(true);
    });
  });
});

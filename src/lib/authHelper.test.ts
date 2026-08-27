import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLocalAuthUser,
  setLocalAuthUser,
  formatAuthError,
  type AppUser,
} from './authHelper';

const KEY = 'invoiceflow_auth_user';

describe('local auth persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a user through localStorage', () => {
    const user: AppUser = { uid: 'u1', email: 'a@b.com', displayName: 'Ann', photoURL: '', isDemo: true };
    setLocalAuthUser(user);
    expect(getLocalAuthUser()).toEqual(user);
  });

  it('returns null when nothing stored and clears on setLocalAuthUser(null)', () => {
    expect(getLocalAuthUser()).toBeNull();
    setLocalAuthUser({ uid: 'u2', email: null, displayName: null, photoURL: null });
    expect(getLocalAuthUser()).not.toBeNull();
    setLocalAuthUser(null);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getLocalAuthUser()).toBeNull();
  });

  it('survives corrupt JSON gracefully', () => {
    localStorage.setItem(KEY, '{not-json');
    expect(getLocalAuthUser()).toBeNull();
  });

  it('dispatches an auth-changed event on every write', () => {
    let fired = 0;
    const handler = () => fired++;
    window.addEventListener('invoiceflow_auth_changed', handler);
    setLocalAuthUser({ uid: 'u3', email: 'a@b.com', displayName: 'Ann', photoURL: '' });
    window.removeEventListener('invoiceflow_auth_changed', handler);
    expect(fired).toBe(1);
  });
});

describe('formatAuthError', () => {
  it('maps Firebase setup errors with actionable guidance', () => {
    for (const code of ['auth/configuration-not-found', 'auth/operation-not-allowed', 'auth/unauthorized-domain']) {
      const out = formatAuthError({ code });
      expect(out.isFirebaseSetupError).toBe(true);
      expect(out.message).toMatch(/Firebase Console/i);
    }
  });

  it('maps credential problems to friendly messages', () => {
    expect(formatAuthError({ code: 'auth/invalid-credential' }).message).toMatch(/Invalid email or password/i);
    expect(formatAuthError({ code: 'auth/email-already-in-use' }).message).toMatch(/already exists/i);
    expect(formatAuthError({ code: 'auth/weak-password' }).message).toMatch(/at least 6 characters/i);
    expect(formatAuthError({ code: 'auth/invalid-email' }).message).toMatch(/valid email/i);
  });

  it('handles message-only errors, empty errors, and unknown shapes', () => {
    expect(formatAuthError({ message: 'boom' }).message).toBe('boom');
    expect(formatAuthError(null).isFirebaseSetupError).toBe(false);
    expect(formatAuthError({}).message).toMatch(/try again/i);
  });
});

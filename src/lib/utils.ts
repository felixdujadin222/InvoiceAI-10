import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes the app's date values to a JS Date.
 *
 * Timestamps reach the UI in three shapes depending on origin:
 * - Firestore `Timestamp`-like objects (cloud reads) → `.toDate()`
 * - ISO strings / epoch numbers (local-first storage & seed data)
 * - null/undefined or garbage → Unix epoch
 */
export function toJsDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

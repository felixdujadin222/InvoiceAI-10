import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  escapeHtml,
  validateId,
  validateEmail,
  validateUrl,
  validateCurrency,
  validateTaxRate,
  validateInvoiceStatus,
  validateClientStatus,
  validateInvoiceItems,
  validateClientData,
  validateInvoiceData,
  sanitizeClientData,
  sanitizeInvoiceData,
} from './validation';

describe('sanitizeString', () => {
  it('trims, strips angle brackets/quotes, and caps length', () => {
    expect(sanitizeString('  <b>"hi"</b> ')).toBe('bhi/b');
    expect(sanitizeString('a'.repeat(50), 10)).toHaveLength(10);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(42 as unknown as string)).toBe('');
  });
});

describe('escapeHtml', () => {
  it('encodes all dangerous characters exactly once', () => {
    expect(escapeHtml(`<script>alert("x&y")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it("encodes single quotes and is safe to call twice", () => {
    const once = escapeHtml(`it's`);
    expect(once).toBe('it&apos;s');
    expect(escapeHtml(once)).not.toContain('<');
  });

  it('returns empty string for non-strings', () => {
    expect(escapeHtml(null as unknown as string)).toBe('');
  });
});

describe('primitive validators', () => {
  it('validateId accepts safe ids and rejects injection shapes', () => {
    expect(validateId('abc_123-XYZ')).toBe(true);
    expect(validateId('')).toBe(false);
    expect(validateId('a'.repeat(129))).toBe(false);
    expect(validateId('../etc/passwd')).toBe(false);
    expect(validateId('id with space')).toBe(false);
  });

  it('validateEmail accepts normal addresses and rejects malformed ones', () => {
    expect(validateEmail('user@example.co')).toBe(true);
    expect(validateEmail('no-at-sign')).toBe(false);
    expect(validateEmail('a b@c.com')).toBe(false);
    expect(validateEmail(`${'a'.repeat(300)}@x.com`)).toBe(false);
  });

  it('validateUrl allows only http(s)', () => {
    expect(validateUrl('https://ok.com/path')).toBe(true);
    expect(validateUrl('javascript:alert(1)')).toBe(false);
    expect(validateUrl('not a url')).toBe(false);
  });

  it('enum validators hold their whitelists', () => {
    for (const c of ['USD', 'eur', 'Ngn']) expect(validateCurrency(c)).toBe(true);
    expect(validateCurrency('BTC')).toBe(false);
    expect(validateTaxRate(-1)).toBe(false);
    expect(validateTaxRate(101)).toBe(false);
    expect(validateTaxRate(NaN)).toBe(false);
    expect(validateInvoiceStatus('paid')).toBe(true);
    expect(validateInvoiceStatus('refunded')).toBe(false);
    expect(validateClientStatus('lead')).toBe(true);
    expect(validateClientStatus('vip')).toBe(false);
  });
});

describe('validateInvoiceItems', () => {
  const good = { description: 'Design', quantity: 2, rate: 100, amount: 200 };

  it('accepts well-formed items including optional taxRate', () => {
    expect(validateInvoiceItems([good, { ...good, taxRate: 7.5 }])).toEqual({ valid: true });
  });

  it('rejects non-arrays and over-limit batches', () => {
    expect(validateInvoiceItems('nope' as unknown as Parameters<typeof validateInvoiceItems>[0]).valid).toBe(false);
    const many = Array.from({ length: 101 }, () => good);
    expect(validateInvoiceItems(many).error).toMatch(/Maximum 100/);
  });

  it('reports the first field-level problem per item', () => {
    expect(validateInvoiceItems([{ ...good, description: '   ' }]).error).toMatch(/description/i);
    expect(validateInvoiceItems([{ ...good, quantity: 0 }]).error).toMatch(/quantity/i);
    expect(validateInvoiceItems([{ ...good, rate: -5 }]).error).toMatch(/rate/i);
    expect(validateInvoiceItems([{ ...good, amount: -1 }]).error).toMatch(/amount/i);
    expect(validateInvoiceItems([{ ...good, taxRate: 150 }]).error).toMatch(/tax rate/i);
    expect(validateInvoiceItems([null as unknown as typeof good]).error).toMatch(/object/i);
  });
});

describe('validateClientData / validateInvoiceData', () => {
  it('requires client name and flags invalid fields', () => {
    expect(validateClientData(null).valid).toBe(false);
    expect(validateClientData({}).error).toMatch(/name/i);
    expect(validateClientData({ name: 'Acme', email: 'bad' }).error).toMatch(/email/i);
    expect(validateClientData({ name: 'Acme', email: 'a@b.com', status: 'ghost' }).error).toMatch(/status/i);
    expect(validateClientData({ name: 'Acme', email: 'a@b.com' })).toEqual({ valid: true });
  });

  it('requires valid invoice shape end-to-end', () => {
    const base = { clientId: 'c_1', clientName: 'Acme', total: 100, items: [], currency: 'USD', status: 'draft' };
    expect(validateInvoiceData(base)).toEqual({ valid: true });
    expect(validateInvoiceData({ ...base, clientId: 'bad id!' }).error).toMatch(/client ID/i);
    expect(validateInvoiceData({ ...base, total: -3 }).error).toMatch(/Total/i);
    expect(validateInvoiceData({ ...base, currency: 'YEN' }).error).toMatch(/currency/i);
    expect(validateInvoiceData(undefined).valid).toBe(false);
  });
});

describe('sanitizers', () => {
  it('normalize client payloads with defaults and caps', () => {
    const out = sanitizeClientData({
      name: '  <Acme> ',
      email: 'A@B.COM ',
      tags: Array.from({ length: 60 }, (_, i) => `t${i}`),
    });
    expect(out.name).toBe('Acme');
    expect(out.email).toBe('a@b.com');
    expect(out.status).toBe('active');
    expect(out.tags).toHaveLength(50);
  });

  it('clamp invoice numbers and coerce bad values safely', () => {
    const out = sanitizeInvoiceData({
      items: [{
        description: '<img>',
        quantity: -4,
        rate: 'x' as unknown as number,
        amount: null as unknown as number,
      }],
      total: -9,
      currency: 'gbp',
      status: 'bogus',
    });
    expect(out.items[0].quantity).toBeGreaterThanOrEqual(1);
    expect(out.items[0].rate).toBe(0);
    expect(out.currency).toBe('GBP');
    expect(out.status).toBe('draft');
    expect(out.total).toBe(0);
    expect(typeof out.dueDate).toBe('string');
  });
});

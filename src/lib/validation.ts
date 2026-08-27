import type { InvoiceItem } from '../services/geminiService';

export const MAX_STRING_LENGTH = 1000;
export const MAX_ITEMS_PER_INVOICE = 100;
export const MAX_CLIENTS_PER_BATCH = 500;
export const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

/** Shape accepted by validate/sanitizeClientData. All fields optional so partial forms can be checked incrementally. */
export interface ClientPayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  category?: string;
  status?: string;
  tags?: string[];
  [key: string]: unknown;
}

/** Shape accepted by validate/sanitizeInvoiceData. */
export interface InvoicePayload {
  clientId?: string;
  clientName?: string;
  invoiceNumber?: string;
  status?: string;
  currency?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  total?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  paymentMethod?: string;
  remindersEnabled?: boolean;
  [key: string]: unknown;
}

export function sanitizeString(input: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"']/g, '');
}

// HTML entity encoding for safe output.
// NOTE: `&` must be encoded FIRST so we don't double-encode the entities below.
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\//g, '&#x2F;');
}

export function validateId(id: string): boolean {
  return typeof id === 'string' && 
         id.length > 0 && 
         id.length <= 128 && 
         VALID_ID_REGEX.test(id);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 256;
}

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCurrency(code: string): boolean {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'KES'];
  return validCurrencies.includes(code.toUpperCase());
}

export function validateTaxRate(rate: number): boolean {
  return typeof rate === 'number' && rate >= 0 && rate <= 100;
}

export function validateInvoiceStatus(status: string): boolean {
  return ['draft', 'sent', 'paid', 'overdue'].includes(status);
}

export function validateClientStatus(status: string): boolean {
  return ['active', 'inactive', 'lead', 'archived'].includes(status);
}

export function validateInvoiceItems(items: InvoiceItem[]): { valid: boolean; error?: string } {
  if (!Array.isArray(items)) {
    return { valid: false, error: 'Items must be an array' };
  }
  
  if (items.length > MAX_ITEMS_PER_INVOICE) {
    return { valid: false, error: `Maximum ${MAX_ITEMS_PER_INVOICE} items allowed per invoice` };
  }
  
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: 'Each item must be an object' };
    }
    if (typeof item.description !== 'string' || item.description.trim().length === 0) {
      return { valid: false, error: 'Item description is required' };
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      return { valid: false, error: 'Item quantity must be a positive number' };
    }
    if (typeof item.rate !== 'number' || item.rate < 0) {
      return { valid: false, error: 'Item rate must be a non-negative number' };
    }
    if (typeof item.amount !== 'number' || item.amount < 0) {
      return { valid: false, error: 'Item amount must be a non-negative number' };
    }
    if (item.taxRate !== undefined && !validateTaxRate(item.taxRate)) {
      return { valid: false, error: 'Item tax rate must be between 0 and 100' };
    }
  }
  
  return { valid: true };
}

export function validateClientData(data: ClientPayload): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Client data must be an object' };
  }
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { valid: false, error: 'Client name is required' };
  }
  
  if (data.name.length > 200) {
    return { valid: false, error: 'Client name must be 200 characters or less' };
  }
  
  if (!data.email || !validateEmail(data.email)) {
    return { valid: false, error: 'Valid client email is required' };
  }
  
  if (data.phone && typeof data.phone === 'string' && data.phone.length > 50) {
    return { valid: false, error: 'Phone number too long' };
  }
  
  if (data.address && typeof data.address === 'string' && data.address.length > 500) {
    return { valid: false, error: 'Address too long' };
  }
  
  if (data.tags && Array.isArray(data.tags) && data.tags.length > 50) {
    return { valid: false, error: 'Maximum 50 tags allowed' };
  }
  
  if (data.status && !validateClientStatus(data.status)) {
    return { valid: false, error: 'Invalid client status' };
  }
  
  return { valid: true };
}

export function validateInvoiceData(data: InvoicePayload): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invoice data must be an object' };
  }
  
  if (!data.clientId || !validateId(data.clientId)) {
    return { valid: false, error: 'Valid client ID is required' };
  }
  
  if (!data.clientName || typeof data.clientName !== 'string' || data.clientName.trim().length === 0) {
    return { valid: false, error: 'Client name is required' };
  }
  
  if (typeof data.total !== 'number' || data.total < 0) {
    return { valid: false, error: 'Total must be a non-negative number' };
  }
  
  const itemsValidation = validateInvoiceItems(data.items || []);
  if (!itemsValidation.valid) {
    return itemsValidation;
  }
  
  if (data.status && !validateInvoiceStatus(data.status)) {
    return { valid: false, error: 'Invalid invoice status' };
  }
  
  if (data.currency && !validateCurrency(data.currency)) {
    return { valid: false, error: 'Invalid currency code' };
  }
  
  return { valid: true };
}

export function sanitizeClientData(data: ClientPayload) {
  return {
    name: sanitizeString(data.name, 200),
    email: sanitizeString(data.email, 256).toLowerCase(),
    phone: data.phone ? sanitizeString(data.phone, 50) : undefined,
    address: data.address ? sanitizeString(data.address, 500) : undefined,
    category: data.category ? sanitizeString(data.category, 100) : undefined,
    status: validateClientStatus(data.status) ? data.status : 'active',
    tags: Array.isArray(data.tags) 
      ? data.tags.slice(0, 50).map((t: string) => sanitizeString(t, 50))
      : [],
  };
}

export function sanitizeInvoiceData(data: InvoicePayload) {
  const sanitizedItems = (data.items || []).map((item: InvoiceItem) => ({
    description: sanitizeString(item.description, 500),
    quantity: Math.max(1, Number(item.quantity) || 1),
    rate: Math.max(0, Number(item.rate) || 0),
    amount: Math.max(0, Number(item.amount) || 0),
    taxRate: validateTaxRate(item.taxRate) ? Number(item.taxRate) : undefined,
  }));
  
  return {
    clientId: sanitizeString(data.clientId),
    clientName: sanitizeString(data.clientName, 200),
    invoiceNumber: sanitizeString(data.invoiceNumber, 50),
    status: validateInvoiceStatus(data.status) ? data.status : 'draft',
    items: sanitizedItems,
    subtotal: Math.max(0, Number(data.subtotal) || 0),
    tax: Math.max(0, Number(data.tax) || 0),
    discount: Math.max(0, Number(data.discount) || 0),
    total: Math.max(0, Number(data.total) || 0),
    currency: validateCurrency(data.currency) ? data.currency.toUpperCase() : 'USD',
    issueDate: data.issueDate ? sanitizeString(data.issueDate, 20) : undefined,
    dueDate: data.dueDate ? sanitizeString(data.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    notes: data.notes ? sanitizeString(data.notes, 2000) : undefined,
    paymentMethod: data.paymentMethod ? sanitizeString(data.paymentMethod, 100) : undefined,
    remindersEnabled: Boolean(data.remindersEnabled),
  };
}
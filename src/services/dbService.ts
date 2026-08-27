import { auth, db } from '../lib/firebase';
import {
  collection,
  addDoc as fbAddDoc,
  updateDoc as fbUpdateDoc,
  setDoc as fbSetDoc,
  getDoc as fbGetDoc,
  deleteDoc as fbDeleteDoc,
  doc,
  query,
  getDocs as fbGetDocs,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  type QuerySnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore/lite';
import {
  validateClientData,
  validateInvoiceData,
  sanitizeClientData,
  sanitizeInvoiceData,
} from '../lib/validation';
import { getLocalAuthUser } from '../lib/authHelper';

// ----------------------------------------------------
// Firestore timeout guard
// firestore/lite has no offline cache: when the backend is
// unreachable (offline, blocked network, hanging request) its
// promises may never settle, leaving UI spinners stuck forever.
// Every async call is therefore wrapped with a hard timeout so the
// local-storage fallback below always takes over quickly.
// ----------------------------------------------------
const FS_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, op: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${op} timed out - check your internet connection`)),
      FS_TIMEOUT_MS
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const addDoc = (ref: any, data: any) => withTimeout(fbAddDoc(ref, data), 'Saving to cloud');
const setDoc = (ref: any, data: any, opts?: any) =>
  withTimeout(fbSetDoc(ref, data, opts), 'Saving to cloud');
const updateDoc = (ref: any, data: any) =>
  withTimeout(fbUpdateDoc(ref, data), 'Updating cloud record');
const deleteDoc = (ref: any) => withTimeout(fbDeleteDoc(ref), 'Cloud delete');
const getDoc = (ref: any): Promise<DocumentSnapshot<any>> =>
  withTimeout(fbGetDoc<any, any>(ref), 'Loading from cloud');
const getDocs = (q: any): Promise<QuerySnapshot<any>> =>
  withTimeout(fbGetDocs<any, any>(q), 'Loading from cloud');
/* eslint-enable @typescript-eslint/no-explicit-any */

import type { InvoiceItem } from './geminiService';

// ----------------------------------------------------
// Domain payload types. Required fields mirror today's persisted shapes;
// index signatures keep forward-compatibility with evolving cloud docs.
// ----------------------------------------------------
export interface RecurringInvoiceData {
  id?: string;
  userId?: string;
  clientId?: string;
  clientName?: string;
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDate?: string;
  amount?: number;
  currency?: string;
  active?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface UserSettings {
  userId?: string;
  email?: string | null;
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  address?: string;
  logoUrl?: string;
  currency?: string;
  defaultTaxRate?: number;
  taxRate?: number;
  defaultDueDays?: number;
  defaultPaymentMethod?: string;
  paymentTerms?: string;
  terms?: string;
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    swiftCode?: string;
    iban?: string;
  };
  cryptoWallets?: Record<string, string>;
  reminderIntervals?: number[];
  onboardingCompleted?: boolean;
  displayName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface ExpenseData {
  id?: string;
  userId?: string;
  merchant?: string;
  amount?: number;
  category?: string;
  date?: string;
  notes?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface QuoteData {
  id?: string;
  userId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  items?: InvoiceItem[];
  subtotal?: number;
  tax?: number;
  discount?: number;
  total?: number;
  currency?: string;
  validUntil?: string;
  notes?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface InvoiceData {
  id?: string;
  userId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  invoiceNumber: string;
  templateId?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currency: string;
  issueDate?: string;
  dueDate: string;
  notes?: string;
  paymentMethod?: string;
  suggestedTaxRate?: number;
  remindersEnabled?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  items: InvoiceItem[];
  notes?: string;
  currency: string;
  taxRate?: number;
  updatedAt: string | null;
}

export interface ClientData {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  category?: string;
  status?: 'active' | 'inactive' | 'lead' | 'archived';
  tags?: string[];
  activityLog?: {
    action: string;
    timestamp: string | null;
    notes?: string;
  }[];
  createdAt: string | null;
  updatedAt?: string | null;
}

// ----------------------------------------------------
// Local Store Fallback Engine for Offline / Demo / Unprovisioned DBs
// ----------------------------------------------------
const LOCAL_STORAGE_PREFIX = 'invoiceflow_store_';

function getLocalData<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to write to localStorage:', e);
  }
}

/**
 * Check if the active session can and should query Firestore directly.
 * Demo users and unauthenticated sessions must not fire unauthenticated requests
 * to avoid 403 Forbidden permission-denied errors.
 */
function shouldSyncFirestore(userId: string): boolean {
  if (!userId || userId.startsWith('demo_')) return false;
  return auth.currentUser !== null && auth.currentUser.uid === userId;
}

// ----------------------------------------------------
// Business identity for seeding / self-healing.
// "Apex Creative Studio" was a fictional demo business seeded into every
// new account, so real users saw it branded on their invoices. The seed
// (and any legacy seeded settings) now derive branding from the
// signed-in user's real identity instead.
// ----------------------------------------------------
const SEED_BUSINESS_NAME = 'Apex Creative Studio';
const SEED_BUSINESS_EMAIL = 'alex.rivers@invoiceflow.ai';

function deriveBusinessIdentity(): { name: string; email: string } {
  const user = auth.currentUser || getLocalAuthUser();
  const name =
    user?.displayName?.trim() || (user?.email ? user.email.split('@')[0] : '') || 'My Business';
  return { name, email: user?.email || '' };
}

function initializeSeedDataIfEmpty(userId: string) {
  const settingsKey = `settings_${userId}`;
  const rawSettings = localStorage.getItem(LOCAL_STORAGE_PREFIX + settingsKey);
  if (!rawSettings) {
    const identity = deriveBusinessIdentity();
    const defaultSettings = {
      userId,
      businessName: identity.name,
      email: identity.email,
      currency: 'USD',
      taxRate: 10,
      address: '',
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_STORAGE_PREFIX + settingsKey, JSON.stringify(defaultSettings));

    const sampleClients: ClientData[] = [
      {
        id: 'client_acme_101',
        userId,
        name: 'Acme Corporation',
        email: 'billing@acme.corp',
        phone: '+1 (555) 234-5678',
        address: '100 Enterprise Blvd, New York, NY',
        category: 'Enterprise',
        status: 'active',
        tags: ['VIP', 'Retainer'],
        activityLog: [
          {
            action: 'Client Created',
            timestamp: new Date().toISOString(),
            notes: 'Initial seed client',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'client_techsphere_102',
        userId,
        name: 'TechSphere Global',
        email: 'accounts@techsphere.io',
        phone: '+1 (555) 876-5432',
        address: '500 Tech Park, Austin, TX',
        category: 'Technology',
        status: 'active',
        tags: ['SaaS', 'High-Growth'],
        activityLog: [
          {
            action: 'Client Created',
            timestamp: new Date().toISOString(),
            notes: 'Initial seed client',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    // Seed each collection only when it is actually empty - never clobber real
    // data just because the settings key was missing.
    if (getLocalData<ClientData>(`clients_${userId}`).length === 0) {
      setLocalData(`clients_${userId}`, sampleClients);
    }

    const sampleInvoices: InvoiceData[] = [
      {
        id: 'inv_2024_001',
        userId,
        clientId: 'client_acme_101',
        clientName: 'Acme Corporation',
        invoiceNumber: 'INV-2024-001',
        status: 'paid',
        items: [
          {
            description: 'Full-Stack Web App UI/UX Redesign',
            quantity: 1,
            rate: 3500,
            amount: 3500,
            taxRate: 10,
          },
          {
            description: 'Design System & Figma Component Library',
            quantity: 1,
            rate: 1200,
            amount: 1200,
            taxRate: 10,
          },
        ],
        subtotal: 4700,
        tax: 470,
        discount: 0,
        total: 5170,
        currency: 'USD',
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Thank you for your business! Payment received with thanks.',
        paymentMethod: 'Bank Transfer / Stripe',
        remindersEnabled: true,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'inv_2024_002',
        userId,
        clientId: 'client_techsphere_102',
        clientName: 'TechSphere Global',
        invoiceNumber: 'INV-2024-002',
        status: 'sent',
        items: [
          {
            description: 'AI Agent Architecture Consulting (Phase 1)',
            quantity: 20,
            rate: 150,
            amount: 3000,
            taxRate: 10,
          },
          {
            description: 'Automated Invoice Flow Pipeline Integration',
            quantity: 1,
            rate: 1800,
            amount: 1800,
            taxRate: 10,
          },
        ],
        subtotal: 4800,
        tax: 480,
        discount: 0,
        total: 5280,
        currency: 'USD',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Net 14 payment terms apply. Please remit payment by the due date.',
        paymentMethod: 'Stripe / Card',
        remindersEnabled: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'inv_2024_003',
        userId,
        clientId: 'client_acme_101',
        clientName: 'Acme Corporation',
        invoiceNumber: 'INV-2024-003',
        status: 'draft',
        items: [
          {
            description: 'Quarterly Maintenance & Performance Optimization',
            quantity: 1,
            rate: 1500,
            amount: 1500,
            taxRate: 10,
          },
        ],
        subtotal: 1500,
        tax: 150,
        discount: 0,
        total: 1650,
        currency: 'USD',
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Draft proposal for Q3 maintenance retainer.',
        remindersEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    if (getLocalData<InvoiceData>(`invoices_${userId}`).length === 0) {
      setLocalData(`invoices_${userId}`, sampleInvoices);
    }

    const sampleExpenses = [
      {
        id: 'exp_001',
        userId,
        merchant: 'Vercel / Cloud Infrastructure',
        amount: 80,
        category: 'Software',
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'exp_002',
        userId,
        merchant: 'Figma Professional Workspace',
        amount: 45,
        category: 'Software',
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      },
    ];
    if (getLocalData<ExpenseData>(`expenses_${userId}`).length === 0) {
      setLocalData(`expenses_${userId}`, sampleExpenses);
    }

    const sampleQuotes = [
      {
        id: 'quote_001',
        userId,
        clientName: 'NextGen Retail Ltd',
        title: 'Full E-commerce Overhaul & Mobile App',
        total: 7500,
        currency: 'USD',
        status: 'accepted',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [{ description: 'E-commerce Architecture', quantity: 1, rate: 7500, amount: 7500 }],
        createdAt: new Date().toISOString(),
      },
    ];
    if (getLocalData<QuoteData>(`quotes_${userId}`).length === 0) {
      setLocalData(`quotes_${userId}`, sampleQuotes);
    }
  }
}

// Records saved while offline (or when cloud sync failed) live only in localStorage.
// When a cloud read succeeds, re-include those local-only records so they don't
// disappear from lists. They will sync up on their next individual save/update.
function mergeLocalOnly<T extends { id?: string }>(local: T[], cloud: T[]): T[] {
  if (!Array.isArray(local) || local.length === 0) return cloud;
  const cloudIds = new Set(cloud.map(item => item?.id));
  const seen = new Set<string>();
  const localOnly: T[] = [];
  for (const item of local) {
    if (!item?.id || cloudIds.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    localOnly.push(item);
  }
  return [...cloud, ...localOnly];
}

export const dbService = {
  async saveInvoice(userId: string, data: Partial<InvoiceData>) {
    const validation = validateInvoiceData(data);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid invoice data');
    }

    const sanitized = sanitizeInvoiceData(data);
    let invoiceId = 'inv_' + Math.random().toString(36).substring(2, 10);
    const nowIso = new Date().toISOString();

    // Try cloud Firestore first so the locally cached copy can reuse the SAME
    // document id. Caching locally before the cloud write used to produce two
    // different ids for one invoice (local vs auto-id), so later reads merged
    // them into duplicated/stale rows in the invoice list.
    if (shouldSyncFirestore(userId)) {
      try {
        const invoicesRef = collection(db, `users/${userId}/invoices`);
        const docRef = await addDoc(invoicesRef, {
          ...sanitized,
          userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        invoiceId = docRef.id;
      } catch {
        console.warn('Firestore sync skipped, using local persistence for invoice.');
      }
    }

    const invoiceObj: InvoiceData = {
      ...sanitized,
      status: (sanitized.status as InvoiceData['status'] | undefined) ?? 'draft',
      id: invoiceId,
      userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Cache locally with the FINAL id (cloud id when synced, local id otherwise).
    const list = getLocalData<InvoiceData>(`invoices_${userId}`);
    setLocalData(`invoices_${userId}`, [invoiceObj, ...list.filter(inv => inv.id !== invoiceId)]);

    if (sanitized.clientId) {
      this.addClientActivity(userId, sanitized.clientId, {
        action: 'Invoice Created',
        notes: `Invoice #${sanitized.invoiceNumber} created for ${sanitized.total}`,
      }).catch(() => undefined); // fire-and-forget: activity logging must never block invoice creation
    }

    return { id: invoiceObj.id };
  },

  async getInvoices(userId: string) {
    initializeSeedDataIfEmpty(userId);
    if (shouldSyncFirestore(userId)) {
      try {
        const invoicesRef = collection(db, `users/${userId}/invoices`);
        const q = query(invoicesRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (snapshot.docs.length > 0) {
          const cloudDocs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as InvoiceData[];
          const local = getLocalData<InvoiceData>(`invoices_${userId}`);
          // Reconcile records left behind by the legacy save flow, which cached a
          // throwaway `inv_*` id locally while the cloud twin got an auto-id:
          // same invoiceNumber => same invoice, keep only the cloud copy so the
          // list stops showing duplicates / stale statuses.
          const cloudNumbers = new Set(
            cloudDocs
              .map(d => d.invoiceNumber)
              .filter((n): n is string => typeof n === 'string' && n.length > 0)
          );
          const reconciled = local.filter(
            inv =>
              !(
                typeof inv.id === 'string' &&
                inv.id.startsWith('inv_') &&
                typeof inv.invoiceNumber === 'string' &&
                inv.invoiceNumber.length > 0 &&
                cloudNumbers.has(inv.invoiceNumber)
              )
          );
          const merged = mergeLocalOnly(reconciled, cloudDocs);
          setLocalData(`invoices_${userId}`, merged);
          return merged;
        }
      } catch {
        // Fall through to local data
      }
    }
    return getLocalData<InvoiceData>(`invoices_${userId}`);
  },

  async getInvoicesPaginated(userId: string, pageSize = 20, lastDoc?: QueryDocumentSnapshot) {
    if (shouldSyncFirestore(userId)) {
      try {
        const invoicesRef = collection(db, `users/${userId}/invoices`);
        let q = query(invoicesRef, orderBy('createdAt', 'desc'), limit(pageSize));
        if (lastDoc) {
          q = query(
            invoicesRef,
            orderBy('createdAt', 'desc'),
            startAfter(lastDoc),
            limit(pageSize)
          );
        }
        const snapshot = await getDocs(q);
        if (snapshot.docs.length > 0) {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
          const hasMore = snapshot.docs.length === pageSize;
          return { data: docs, lastDoc: newLastDoc, hasMore };
        }
      } catch {
        // Fall through
      }
    }
    const all = await this.getInvoices(userId);
    return { data: all.slice(0, pageSize), lastDoc: undefined, hasMore: all.length > pageSize };
  },

  async getClientInvoices(userId: string, clientId: string) {
    const all = await this.getInvoices(userId);
    return all.filter(inv => inv.clientId === clientId);
  },

  async getClientInvoicesPaginated(
    userId: string,
    clientId: string,
    pageSize = 20,
    _lastDoc?: QueryDocumentSnapshot
  ) {
    const all = await this.getClientInvoices(userId, clientId);
    return { data: all.slice(0, pageSize), lastDoc: undefined, hasMore: all.length > pageSize };
  },

  async updateInvoiceStatus(userId: string, invoiceId: string, status: InvoiceData['status']) {
    const list = getLocalData<InvoiceData>(`invoices_${userId}`);
    const updated = list.map(inv =>
      inv.id === invoiceId ? { ...inv, status, updatedAt: new Date().toISOString() } : inv
    );
    setLocalData(`invoices_${userId}`, updated);

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/invoices`, invoiceId);
        await updateDoc(docRef, { status, updatedAt: serverTimestamp() });
      } catch {
        // Handled in local store
      }
    }
  },

  async updateInvoice(userId: string, invoiceId: string, data: Partial<InvoiceData>) {
    const validation = validateInvoiceData(data);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid invoice data');
    }
    const sanitized = sanitizeInvoiceData(data);
    const list = getLocalData<InvoiceData>(`invoices_${userId}`);
    const updated = list.map(inv =>
      inv.id === invoiceId ? { ...inv, ...sanitized, updatedAt: new Date().toISOString() } : inv
    );
    setLocalData(`invoices_${userId}`, updated);

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/invoices`, invoiceId);
        await updateDoc(docRef, { ...sanitized, updatedAt: serverTimestamp() });
      } catch {
        // Handled in local store
      }
    }
  },

  async deleteInvoice(userId: string, invoiceId: string) {
    const list = getLocalData<InvoiceData>(`invoices_${userId}`);
    setLocalData(
      `invoices_${userId}`,
      list.filter(inv => inv.id !== invoiceId)
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/invoices`, invoiceId);
        await deleteDoc(docRef);
      } catch {
        // Handled in local store
      }
    }
  },

  async getClients(userId: string): Promise<ClientData[]> {
    initializeSeedDataIfEmpty(userId);
    if (shouldSyncFirestore(userId)) {
      try {
        const clientsRef = collection(db, `users/${userId}/clients`);
        const q = query(clientsRef, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        if (snapshot.docs.length > 0) {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientData[];
          const merged = mergeLocalOnly(getLocalData<ClientData>(`clients_${userId}`), docs);
          setLocalData(`clients_${userId}`, merged);
          return merged;
        }
      } catch {
        // Fall through to local store
      }
    }
    return getLocalData<ClientData>(`clients_${userId}`);
  },

  async getClientsPaginated(userId: string, pageSize = 20, _lastDoc?: QueryDocumentSnapshot) {
    const docs = await this.getClients(userId);
    return { data: docs.slice(0, pageSize), lastDoc: undefined, hasMore: docs.length > pageSize };
  },

  async addClient(userId: string, data: Partial<ClientData>) {
    const validation = validateClientData(data);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid client data');
    }

    const sanitized = sanitizeClientData(data);
    const clientId = 'client_' + Math.random().toString(36).substring(2, 10);
    const nowIso = new Date().toISOString();

    const newClient: ClientData = {
      ...sanitized,
      status: (sanitized.status as ClientData['status'] | undefined) ?? 'active',
      id: clientId,
      userId,
      activityLog: [
        {
          action: 'Client Created',
          timestamp: nowIso,
          notes: 'Client added to system',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const list = getLocalData<ClientData>(`clients_${userId}`);
    setLocalData(`clients_${userId}`, [...list, newClient]);

    if (shouldSyncFirestore(userId)) {
      try {
        const clientsRef = collection(db, `users/${userId}/clients`);
        const docRef = await addDoc(clientsRef, {
          ...sanitized,
          userId,
          activityLog: newClient.activityLog,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        newClient.id = docRef.id;
      } catch {
        // Saved in local store
      }
    }

    return { id: newClient.id };
  },

  async updateClient(userId: string, clientId: string, data: Partial<ClientData>) {
    const validation = validateClientData(data);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid client data');
    }
    const sanitized = sanitizeClientData(data);
    const list = getLocalData<ClientData>(`clients_${userId}`);
    const updated = list.map(c =>
      c.id === clientId ? { ...c, ...sanitized, updatedAt: new Date().toISOString() } : c
    );
    setLocalData(`clients_${userId}`, updated);

    if (shouldSyncFirestore(userId)) {
      try {
        const clientRef = doc(db, `users/${userId}/clients`, clientId);
        await updateDoc(clientRef, {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Saved in local store
      }
    }
  },

  async addClientActivity(
    userId: string,
    clientId: string,
    log: { action: string; notes?: string }
  ) {
    const list = getLocalData<ClientData>(`clients_${userId}`);
    const nowIso = new Date().toISOString();
    const updated = list.map(c => {
      if (c.id === clientId) {
        const current = c.activityLog || [];
        return { ...c, activityLog: [{ ...log, timestamp: nowIso }, ...current].slice(0, 50) };
      }
      return c;
    });
    setLocalData(`clients_${userId}`, updated);

    if (shouldSyncFirestore(userId)) {
      try {
        const clientRef = doc(db, `users/${userId}/clients`, clientId);
        const snap = await getDoc(clientRef);
        if (snap.exists()) {
          const currentLog = snap.data().activityLog || [];
          await updateDoc(clientRef, {
            activityLog: [{ ...log, timestamp: nowIso }, ...currentLog].slice(0, 50),
          });
        }
      } catch {
        // Saved locally
      }
    }
  },

  async batchAddClients(userId: string, clients: Partial<ClientData>[]) {
    for (const client of clients) {
      await this.addClient(userId, client);
    }
  },

  async deleteClient(userId: string, clientId: string) {
    const list = getLocalData<ClientData>(`clients_${userId}`);
    setLocalData(
      `clients_${userId}`,
      list.filter(c => c.id !== clientId)
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const clientRef = doc(db, `users/${userId}/clients`, clientId);
        await deleteDoc(clientRef);
      } catch {
        // Deleted locally
      }
    }
  },

  async getOrCreateClient(userId: string, name: string): Promise<ClientData> {
    const clients = await this.getClients(userId);
    const existing = clients.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing;

    const res = await this.addClient(userId, {
      name: name.trim(),
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      category: 'General',
      status: 'active',
    });

    const all = await this.getClients(userId);
    return (
      all.find(c => c.id === res.id) || {
        id: res.id,
        userId,
        name: name.trim(),
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        createdAt: new Date().toISOString(),
      }
    );
  },

  // Recurring Invoices
  async saveRecurringInvoice(userId: string, data: RecurringInvoiceData) {
    const id = 'rec_' + Math.random().toString(36).substring(2, 10);
    const record = { ...data, id, userId, createdAt: new Date().toISOString() };
    const list = getLocalData(`recurring_${userId}`);
    setLocalData(`recurring_${userId}`, [record, ...list]);

    if (shouldSyncFirestore(userId)) {
      try {
        const recurringRef = collection(db, `users/${userId}/recurring`);
        const docRef = await addDoc(recurringRef, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: docRef.id };
      } catch {
        return { id };
      }
    }
    return { id };
  },

  async getRecurringInvoices(userId: string) {
    if (shouldSyncFirestore(userId)) {
      try {
        const recurringRef = collection(db, `users/${userId}/recurring`);
        const q = query(recurringRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (snapshot.docs.length > 0) {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const merged = mergeLocalOnly(getLocalData(`recurring_${userId}`), docs);
          setLocalData(`recurring_${userId}`, merged);
          return merged;
        }
      } catch {
        // Fall through
      }
    }
    return getLocalData(`recurring_${userId}`);
  },

  async toggleRecurringActive(userId: string, recurringId: string, active: boolean) {
    const list = getLocalData<RecurringInvoiceData>(`recurring_${userId}`);
    setLocalData(
      `recurring_${userId}`,
      list.map(item => (item.id === recurringId ? { ...item, active } : item))
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/recurring`, recurringId);
        await updateDoc(docRef, { active, updatedAt: serverTimestamp() });
      } catch {
        // Updated locally
      }
    }
  },

  async deleteRecurring(userId: string, recurringId: string) {
    const list = getLocalData<RecurringInvoiceData>(`recurring_${userId}`);
    setLocalData(
      `recurring_${userId}`,
      list.filter(item => item.id !== recurringId)
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/recurring`, recurringId);
        await deleteDoc(docRef);
      } catch {
        // Deleted locally
      }
    }
  },

  // Public Invoice
  async getPublicInvoice(userId: string, invoiceId: string) {
    if (userId && !userId.startsWith('demo_')) {
      try {
        const invoiceRef = doc(db, `users/${userId}/invoices`, invoiceId);
        const snap = await getDoc(invoiceRef);
        if (snap.exists()) return { id: snap.id, ...snap.data() };
      } catch {
        // Fallback to local
      }
    }
    const list = getLocalData<InvoiceData>(`invoices_${userId}`);
    return list.find(i => i.id === invoiceId) || null;
  },

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    initializeSeedDataIfEmpty(userId);
    let settings: UserSettings | null = null;
    if (shouldSyncFirestore(userId)) {
      try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          settings = docSnap.data() as UserSettings;
          localStorage.setItem(
            LOCAL_STORAGE_PREFIX + `settings_${userId}`,
            JSON.stringify(settings)
          );
        }
      } catch {
        // Fall through
      }
    }
    if (!settings) {
      const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + `settings_${userId}`);
      settings = raw ? (JSON.parse(raw) as UserSettings) : null;
    }
    // Self-heal legacy seed branding: accounts created before the fix still
    // carry the fictional "Apex Creative Studio" business name. Replace it
    // once with the signed-in user's real identity (local + cloud).
    if (settings && settings.businessName === SEED_BUSINESS_NAME) {
      const identity = deriveBusinessIdentity();
      settings = {
        ...settings,
        businessName: identity.name,
        ...(settings.email === SEED_BUSINESS_EMAIL ? { email: identity.email } : {}),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_PREFIX + `settings_${userId}`, JSON.stringify(settings));
      if (shouldSyncFirestore(userId)) {
        try {
          await setDoc(
            doc(db, 'users', userId),
            {
              businessName: settings.businessName,
              email: settings.email,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Local-only heal; retried on next load
        }
      }
    }
    return settings;
  },

  async updateUserSettings(userId: string, data: UserSettings) {
    const current = (await this.getUserSettings(userId)) || {};
    const merged = { ...current, ...data, userId, updatedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_STORAGE_PREFIX + `settings_${userId}`, JSON.stringify(merged));

    if (shouldSyncFirestore(userId)) {
      try {
        const userRef = doc(db, 'users', userId);
        await setDoc(
          userRef,
          {
            ...data,
            userId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // Saved locally
      }
    }
    return merged;
  },

  // Expenses
  async getExpenses(userId: string) {
    initializeSeedDataIfEmpty(userId);
    if (shouldSyncFirestore(userId)) {
      try {
        const colRef = collection(db, `users/${userId}/expenses`);
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (snap.docs.length > 0) {
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const merged = mergeLocalOnly(getLocalData(`expenses_${userId}`), docs);
          setLocalData(`expenses_${userId}`, merged);
          return merged;
        }
      } catch {
        // Fall through
      }
    }
    return getLocalData(`expenses_${userId}`);
  },

  async getExpensesPaginated(userId: string, pageSize = 20, _lastDoc?: QueryDocumentSnapshot) {
    const all = await this.getExpenses(userId);
    return { data: all.slice(0, pageSize), lastDoc: undefined, hasMore: all.length > pageSize };
  },

  async addExpense(userId: string, expense: ExpenseData) {
    const id = 'exp_' + Math.random().toString(36).substring(2, 10);
    const newExpense = { ...expense, id, userId, createdAt: new Date().toISOString() };
    const list = getLocalData(`expenses_${userId}`);
    setLocalData(`expenses_${userId}`, [newExpense, ...list]);

    if (shouldSyncFirestore(userId)) {
      try {
        const colRef = collection(db, `users/${userId}/expenses`);
        const docRef = await addDoc(colRef, { ...expense, createdAt: serverTimestamp() });
        return { id: docRef.id };
      } catch {
        return { id };
      }
    }
    return { id };
  },

  async deleteExpense(userId: string, expenseId: string) {
    const list = getLocalData<ExpenseData>(`expenses_${userId}`);
    setLocalData(
      `expenses_${userId}`,
      list.filter(exp => exp.id !== expenseId)
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/expenses`, expenseId);
        await deleteDoc(docRef);
      } catch {
        // Handled in local store
      }
    }
  },

  // Quotes
  async getQuotes(userId: string): Promise<QuoteData[]> {
    initializeSeedDataIfEmpty(userId);
    if (shouldSyncFirestore(userId)) {
      try {
        const colRef = collection(db, `users/${userId}/quotes`);
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (snap.docs.length > 0) {
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuoteData[];
          const merged = mergeLocalOnly<QuoteData>(
            getLocalData<QuoteData>(`quotes_${userId}`),
            docs
          );
          setLocalData(`quotes_${userId}`, merged);
          return merged;
        }
      } catch {
        // Fall through
      }
    }
    return getLocalData<QuoteData>(`quotes_${userId}`);
  },

  async getQuotesPaginated(userId: string, pageSize = 20, _lastDoc?: QueryDocumentSnapshot) {
    const all = await this.getQuotes(userId);
    return { data: all.slice(0, pageSize), lastDoc: undefined, hasMore: all.length > pageSize };
  },

  async saveQuote(userId: string, data: QuoteData) {
    const id = data.id || 'quote_' + Math.random().toString(36).substring(2, 10);
    const nowIso = new Date().toISOString();
    const newQuote = {
      ...data,
      id,
      userId,
      updatedAt: nowIso,
      createdAt: data.createdAt || nowIso,
    };
    const list = getLocalData<QuoteData>(`quotes_${userId}`);
    const filtered = list.filter(q => q.id !== id);
    setLocalData(`quotes_${userId}`, [newQuote, ...filtered]);

    if (shouldSyncFirestore(userId)) {
      try {
        const colRef = collection(db, `users/${userId}/quotes`);
        const docRef = await addDoc(colRef, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: docRef.id };
      } catch {
        return { id };
      }
    }
    return { id };
  },

  async deleteQuote(userId: string, quoteId: string) {
    const list = getLocalData<QuoteData>(`quotes_${userId}`);
    setLocalData(
      `quotes_${userId}`,
      list.filter(q => q.id !== quoteId)
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/quotes`, quoteId);
        await deleteDoc(docRef);
      } catch {
        // Deleted locally
      }
    }
  },

  // Templates
  async getInvoiceTemplates(userId: string) {
    if (shouldSyncFirestore(userId)) {
      try {
        const colRef = collection(db, `users/${userId}/templates`);
        const q = query(colRef, orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        if (snap.docs.length > 0) {
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InvoiceTemplate[];
          const merged = mergeLocalOnly(getLocalData<InvoiceTemplate>(`templates_${userId}`), docs);
          setLocalData(`templates_${userId}`, merged);
          return merged;
        }
      } catch {
        // Fall through
      }
    }
    return getLocalData<InvoiceTemplate>(`templates_${userId}`);
  },

  async saveInvoiceTemplate(userId: string, data: Partial<InvoiceTemplate>) {
    const id = data.id || 'tpl_' + Math.random().toString(36).substring(2, 10);
    const tpl: InvoiceTemplate = {
      id,
      name: data.name || 'Custom Template',
      items: data.items || [],
      notes: data.notes,
      currency: data.currency || 'USD',
      taxRate: data.taxRate,
      updatedAt: new Date().toISOString(),
    };
    const list = getLocalData<InvoiceTemplate>(`templates_${userId}`);
    const filtered = list.filter(t => t.id !== id);
    setLocalData(`templates_${userId}`, [tpl, ...filtered]);

    if (shouldSyncFirestore(userId)) {
      try {
        const colRef = collection(db, `users/${userId}/templates`);
        if (data.id) {
          const docRef = doc(db, `users/${userId}/templates`, data.id);
          await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
          return data.id;
        }
        const docRef = await addDoc(colRef, { ...data, updatedAt: serverTimestamp() });
        return docRef.id;
      } catch {
        return id;
      }
    }
    return id;
  },

  async deleteInvoiceTemplate(userId: string, templateId: string) {
    const list = getLocalData<InvoiceTemplate>(`templates_${userId}`);
    setLocalData(
      `templates_${userId}`,
      list.filter(t => t.id !== templateId)
    );

    if (shouldSyncFirestore(userId)) {
      try {
        const docRef = doc(db, `users/${userId}/templates`, templateId);
        await deleteDoc(docRef);
      } catch {
        // Deleted locally
      }
    }
  },
};

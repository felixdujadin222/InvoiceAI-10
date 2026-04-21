import { db } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  setDoc,
  getDoc,
  deleteDoc,
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy
} from "firebase/firestore/lite";

export interface InvoiceData {
  userId: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  templateId?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  items: any[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  currency: string;
  dueDate: string;
  notes?: string;
  paymentMethod?: string;
  suggestedTaxRate?: number;
  remindersEnabled?: boolean;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  items: any[];
  notes?: string;
  currency: string;
  taxRate?: number;
  updatedAt: any;
}

export interface ClientData {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  category?: string;
  status? : 'active' | 'inactive' | 'lead' | 'archived';
  tags?: string[];
  activityLog?: {
    action: string;
    timestamp: any;
    notes?: string;
  }[];
  createdAt: any;
  updatedAt?: any;
}

export const dbService = {
  // ... existing methods (I will just update affected and add new ones below)
  async saveInvoice(userId: string, data: Partial<InvoiceData>) {
    const invoicesRef = collection(db, `users/${userId}/invoices`);
    const docRef = await addDoc(invoicesRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log activity if clientId exists
    if (data.clientId) {
      this.addClientActivity(userId, data.clientId, {
        action: 'Invoice Created',
        notes: `Invoice #${data.invoiceNumber} created for ${data.total}`
      });
    }
    return docRef;
  },

  async getInvoices(userId: string) {
    const invoicesRef = collection(db, `users/${userId}/invoices`);
    const q = query(invoicesRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getClientInvoices(userId: string, clientId: string) {
    const invoicesRef = collection(db, `users/${userId}/invoices`);
    const q = query(invoicesRef, where("clientId", "==", clientId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateInvoiceStatus(userId: string, invoiceId: string, status: string) {
    const docRef = doc(db, `users/${userId}/invoices`, invoiceId);
    return await updateDoc(docRef, { status, updatedAt: serverTimestamp() });
  },

  async updateInvoice(userId: string, invoiceId: string, data: Partial<InvoiceData>) {
    const docRef = doc(db, `users/${userId}/invoices`, invoiceId);
    return await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  },

  async deleteInvoice(userId: string, invoiceId: string) {
    const docRef = doc(db, `users/${userId}/invoices`, invoiceId);
    return await deleteDoc(docRef);
  },

  async getClients(userId: string) {
    const clientsRef = collection(db, `users/${userId}/clients`);
    const q = query(clientsRef, orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientData[];
  },

  async addClient(userId: string, data: Partial<ClientData>) {
    const clientsRef = collection(db, `users/${userId}/clients`);
    const newClient = {
      ...data,
      userId,
      status: data.status || 'active',
      tags: data.tags || [],
      activityLog: [{
        action: 'Client Created',
        timestamp: new Date().toISOString(),
        notes: 'Client added to system'
      }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    return await addDoc(clientsRef, newClient);
  },

  async updateClient(userId: string, clientId: string, data: Partial<ClientData>) {
    const clientRef = doc(db, `users/${userId}/clients`, clientId);
    return await updateDoc(clientRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async addClientActivity(userId: string, clientId: string, log: { action: string, notes?: string }) {
    const clientRef = doc(db, `users/${userId}/clients`, clientId);
    const snap = await getDoc(clientRef);
    if (snap.exists()) {
      const currentLog = snap.data().activityLog || [];
      const newEntry = {
        ...log,
        timestamp: new Date().toISOString()
      };
      return await updateDoc(clientRef, {
        activityLog: [newEntry, ...currentLog].slice(0, 50) // Keep last 50 entries
      });
    }
  },

  async batchAddClients(userId: string, clients: Partial<ClientData>[]) {
    // Firestore Lite doesn't support writeBatch, so we'll do them sequentially or in chunks
    // For simplicity and to stay compliant with Lite, we'll use Promise.all for smaller batches
    const clientsRef = collection(db, `users/${userId}/clients`);
    const promises = clients.map(client => {
      const newClient = {
        ...client,
        userId,
        status: client.status || 'active',
        tags: client.tags || [],
        activityLog: [{
          action: 'Client Imported',
          timestamp: new Date().toISOString(),
          notes: 'Imported from file'
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      return addDoc(clientsRef, newClient);
    });
    return await Promise.all(promises);
  },

  async deleteClient(userId: string, clientId: string) {
    const clientRef = doc(db, `users/${userId}/clients`, clientId);
    return await deleteDoc(clientRef);
  },

  async getOrCreateClient(userId: string, name: string): Promise<ClientData> {
    const clientsRef = collection(db, `users/${userId}/clients`);
    const q = query(clientsRef, where("name", "==", name));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ClientData;
    }

    const newClient = {
      userId,
      name,
      email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(clientsRef, newClient);
    return { id: docRef.id, ...newClient } as ClientData;
  },

  // New Recurring Methods
  async saveRecurringInvoice(userId: string, data: any) {
    const recurringRef = collection(db, `users/${userId}/recurring`);
    return await addDoc(recurringRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async getRecurringInvoices(userId: string) {
    const recurringRef = collection(db, `users/${userId}/recurring`);
    const q = query(recurringRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async toggleRecurringActive(userId: string, recurringId: string, active: boolean) {
    const docRef = doc(db, `users/${userId}/recurring`, recurringId);
    return await updateDoc(docRef, { active, updatedAt: serverTimestamp() });
  },

  // Public access
  async getPublicInvoice(userId: string, invoiceId: string) {
    const invoiceRef = doc(db, `users/${userId}/invoices`, invoiceId);
    const snap = await getDoc(invoiceRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  // User Settings
  async getUserSettings(userId: string) {
    const userRef = doc(db, "users", userId);
    try {
      const docSnap = await getDoc(userRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.warn("Error fetching user settings:", error);
      return null;
    }
  },

  async updateUserSettings(userId: string, data: any) {
    const userRef = doc(db, "users", userId);
    return await setDoc(userRef, { 
      ...data, 
      userId,
      updatedAt: serverTimestamp() 
    }, { merge: true });
  },

  // Expenses
  async getExpenses(userId: string) {
    const colRef = collection(db, `users/${userId}/expenses`);
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addExpense(userId: string, expense: any) {
    const colRef = collection(db, `users/${userId}/expenses`);
    return await addDoc(colRef, { ...expense, createdAt: serverTimestamp() });
  },

  // Quotes
  async getQuotes(userId: string) {
    const colRef = collection(db, `users/${userId}/quotes`);
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async saveQuote(userId: string, data: any) {
    const colRef = collection(db, `users/${userId}/quotes`);
    return await addDoc(colRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },

  async deleteQuote(userId: string, quoteId: string) {
    const docRef = doc(db, `users/${userId}/quotes`, quoteId);
    return await deleteDoc(docRef);
  },

  // Templates
  async getInvoiceTemplates(userId: string) {
    const colRef = collection(db, `users/${userId}/templates`);
    const q = query(colRef, orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InvoiceTemplate[];
  },

  async saveInvoiceTemplate(userId: string, data: Partial<InvoiceTemplate>) {
    const colRef = collection(db, `users/${userId}/templates`);
    if (data.id) {
      const docRef = doc(db, `users/${userId}/templates`, data.id);
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
      return data.id;
    }
    const docRef = await addDoc(colRef, { ...data, updatedAt: serverTimestamp() });
    return docRef.id;
  },

  async deleteInvoiceTemplate(userId: string, templateId: string) {
    const docRef = doc(db, `users/${userId}/templates`, templateId);
    return await deleteDoc(docRef);
  }
};


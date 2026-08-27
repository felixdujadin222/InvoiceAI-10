import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CreditCard,
  Hash,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { parseInvoiceDescription } from '../services/geminiService';
import { dbService } from '../services/dbService';
import type { ClientData, InvoiceData, InvoiceTemplate } from '../services/dbService';
import type { InvoiceItem } from '../services/geminiService';
import { cn } from '../lib/utils';

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialInvoice?: InvoiceData | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  amount: number;
}

const PAYMENT_METHODS = ['Bank Transfer', 'Stripe', 'PayPal', 'Crypto'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'KES'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
};

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const emptyItem = (tax: number): LineItem => ({
  id: makeId(),
  description: '',
  quantity: 1,
  rate: 0,
  taxRate: tax,
  amount: 0,
});

const toDateInputValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const nextInvoiceNumber = (invoices: InvoiceData[]) => {
  const re = /INV-(\d+)/i;
  let max = 0;
  (invoices || []).forEach((inv) => {
    const m = String(inv.invoiceNumber || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `INV-${String(max + 1).padStart(4, '0')}`;
};

const getCurrencySymbol = (code: string) => CURRENCY_SYMBOLS[code] || '$';

const formatMoney = (value: number, currency: string) => {
  const num = Number.isFinite(value) ? value : 0;
  return `${getCurrencySymbol(currency)}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-gray-900 dark:text-white';
export default function AIInvoiceGenerator({ userId, onClose, onSuccess, initialInvoice }: Props) {
  const isEdit = Boolean(initialInvoice);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);

  // Invoice metadata
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => toDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState(() => toDateInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)));
  const [currency, setCurrency] = useState('USD');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [isCustomPayment, setIsCustomPayment] = useState(false);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [globalTaxRate, setGlobalTaxRate] = useState(5);

  // Bill from / bill to
  const [business, setBusiness] = useState({ name: '', email: '', phone: '', address: '' });
  const [client, setClient] = useState({ id: '', name: '', email: '', phone: '', address: '' });

  // Line items
  const [items, setItems] = useState<LineItem[]>([emptyItem(5)]);

  // AI assist
  const [showAi, setShowAi] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Save lifecycle
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settings, clientList, templateList, invoiceList] = await Promise.all([
          dbService.getUserSettings(userId),
          dbService.getClients(userId),
          dbService.getInvoiceTemplates(userId),
          dbService.getInvoices(userId),
        ]);
        const defaultTax = settings?.defaultTaxRate ?? settings?.taxRate ?? 5;
        setClients(clientList || []);
        setTemplates(templateList || []);
        setBusiness({
          name: settings?.businessName || 'My Business',
          email: settings?.businessEmail || settings?.email || 'hello@invoiceflow.ai',
          phone: settings?.businessPhone || '',
          address: settings?.businessAddress || settings?.address || '',
        });
        setCurrency(settings?.currency || 'USD');
        setGlobalTaxRate(defaultTax);
        setPaymentMethod(settings?.defaultPaymentMethod || 'Bank Transfer');
        setIssueDate(toDateInputValue(new Date()));
        const due = new Date();
        due.setDate(due.getDate() + (settings?.defaultDueDays || 14));
        setDueDate(toDateInputValue(due));

        if (initialInvoice) {
          // Editing an existing invoice: prefill every field from the saved record.
          const inv = initialInvoice;
          setInvoiceNumber(inv.invoiceNumber || nextInvoiceNumber(invoiceList));
          if (typeof inv.issueDate === 'string' && inv.issueDate) setIssueDate(inv.issueDate.slice(0, 10));
          if (inv.dueDate) {
            const d = new Date(inv.dueDate);
            if (!Number.isNaN(d.getTime())) setDueDate(toDateInputValue(d));
          }
          if (inv.currency) setCurrency(inv.currency);
          setDiscount(Number(inv.discount) || 0);
          setNotes(typeof inv.notes === 'string' ? inv.notes : '');
          if (inv.paymentMethod) {
            setIsCustomPayment(!PAYMENT_METHODS.includes(inv.paymentMethod));
            setPaymentMethod(inv.paymentMethod);
          }
          const linked = (clientList || []).find(c => c.id === inv.clientId);
          setClient({
            id: linked?.id || inv.clientId || '',
            name: inv.clientName || linked?.name || '',
            email: linked?.email || '',
            phone: linked?.phone || '',
            address: linked?.address || '',
          });
          const sourceItems = Array.isArray(inv.items) && inv.items.length ? inv.items : [{}];
          setItems(
            sourceItems.map((it: InvoiceItem) => ({
              id: makeId(),
              description: it?.description || '',
              quantity: Number(it?.quantity) > 0 ? Number(it.quantity) : 1,
              rate: Number(it?.rate) || 0,
              taxRate: it?.taxRate ?? defaultTax,
              amount: Number(it?.amount) || Number(it?.quantity || 1) * Number(it?.rate || 0),
            })),
          );
        } else {
          setInvoiceNumber(nextInvoiceNumber(invoiceList));
          setItems([emptyItem(defaultTax)]);
        }
      } catch (err) {
        console.error('Failed to load invoice builder data', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- builder seeds once per user; initialInvoice changes are intentionally not re-applied
  }, [userId]);
const calcTotals = (it: LineItem[], disc: number, gTax: number) => {
    const subtotal = it.reduce((sum, i) => sum + i.quantity * i.rate, 0);
    const factor = subtotal > 0 && disc > 0 ? Math.max(0, (subtotal - disc) / subtotal) : 1;
    const tax = it.reduce((sum, i) => {
      const rate = i.taxRate !== undefined ? i.taxRate : gTax;
      return sum + (i.quantity * i.rate * factor * rate) / 100;
    }, 0);
    const discountedSubtotal = Math.max(0, subtotal - disc);
    return { subtotal, tax, total: discountedSubtotal + tax };
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        next.amount = next.quantity * next.rate;
        return next;
      })
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem(globalTaxRate)]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const selectClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    if (c) setClient({ id: c.id, name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '' });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await parseInvoiceDescription(prompt);
      const defaultTax = globalTaxRate;
      setItems(
        (result.items || []).map((it) => ({
          id: makeId(),
          description: it.description || '',
          quantity: it.quantity || 1,
          rate: it.rate || 0,
          taxRate: it.taxRate !== undefined ? it.taxRate : defaultTax,
          amount: (it.quantity || 1) * (it.rate || 0),
        }))
      );
      if (result.clientName) setClient((prev) => ({ ...prev, name: result.clientName }));
      if (result.suggestedTaxRate) setGlobalTaxRate(result.suggestedTaxRate);
      if (result.notes) setNotes(result.notes);
    } catch (e) {
      console.error('AI generation failed', e);
      setAiError('Failed to generate the invoice. Please try a more descriptive prompt.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const tax = template.taxRate ?? globalTaxRate;
    setItems(
      (template.items || []).map((it) => ({
        id: makeId(),
        description: it.description || '',
        quantity: it.quantity || 1,
        rate: it.rate || 0,
        taxRate: it.taxRate !== undefined ? it.taxRate : tax,
        amount: (it.quantity || 1) * (it.rate || 0),
      }))
    );
    if (template.notes) setNotes(template.notes);
    setGlobalTaxRate(tax);
  };

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!client.name.trim()) {
      setError('Please add a client name in the Bill To section.');
      return;
    }
    if (!business.name.trim()) {
      setError('Please add a business name in the From section.');
      return;
    }
    const validItems = items.filter((i) => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one line item with a description and quantity.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Reuse an already-selected client to avoid duplicates; otherwise find-or-create by name.
      const existing = client.id ? clients.find((c) => c.id === client.id) : undefined;
      const savedClient = existing ?? (await dbService.getOrCreateClient(userId, client.name.trim()));
      if (client.email || client.phone || client.address) {
        await dbService
          .updateClient(userId, savedClient.id, {
            name: client.name.trim(),
            email: client.email || savedClient.email,
            phone: client.phone || savedClient.phone,
            address: client.address || savedClient.address,
          })
          .catch(() => {
            /* client contact update is best-effort */
          });
      }
      const totals = calcTotals(validItems, discount, globalTaxRate);
      const cleanItems = validItems.map(({ id: _id, ...rest }) => rest);
      const payload = {
        userId,
        clientId: savedClient.id,
        clientName: client.name.trim() || savedClient.name,
        invoiceNumber: invoiceNumber.trim() || `INV-${Date.now()}`,
        // Keep the button's explicit intent ('sent'); otherwise preserve the invoice's existing status when editing.
        status: status === 'sent' ? 'sent' : isEdit ? initialInvoice?.status ?? status : status,
        items: cleanItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount,
        total: totals.total,
        currency,
        issueDate,
        dueDate,
        notes: notes.trim() || undefined,
        paymentMethod: isCustomPayment && !paymentMethod.length ? 'Other' : paymentMethod,
        remindersEnabled: true,
      };
      if (isEdit && initialInvoice?.id) {
        await dbService.updateInvoice(userId, initialInvoice.id, payload);
      } else {
        await dbService.saveInvoice(userId, payload);
      }
      onSuccess();
    } catch (err) {
      console.error('Invoice save failed', err);
      const detail = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
      setError(`Couldn't save the invoice: ${detail}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const totals = calcTotals(items, discount, globalTaxRate);
return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200 transition-all active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {isEdit ? 'Edit Invoice' : 'Create Invoice'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
              {isEdit
                ? `Updating ${initialInvoice?.invoiceNumber || 'invoice'} — adjust anything and save your changes.`
                : 'Fill in the details below or use AI to draft it instantly.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAi((v) => !v)}
          className={cn(
            'hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border',
            showAi
              ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30'
              : 'bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-800 hover:border-purple-300 hover:text-purple-600'
          )}
        >
          <Wand2 size={16} />
          AI Assist
        </button>
      </div>

      {/* AI Assist Panel */}
      {showAi && (
        <div className="rounded-2xl border border-purple-200 dark:border-purple-500/30 bg-gradient-to-r from-purple-50/80 via-white to-white dark:from-purple-500/10 dark:via-zinc-900 dark:to-zinc-900 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-gray-900 dark:text-white">AI Invoice Generator</h3>
            </div>
            <button
              onClick={() => setShowAi(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close AI assist"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder='Describe the work, e.g. "Designed a landing page for Acme Corp and set up their email marketing. 20 hours at $120/hr, 5% VAT."'
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 resize-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none transition-all"
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || aiLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-purple-200"
            >
              {aiLoading ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
              {aiLoading ? 'Generating...' : 'Generate Draft'}
            </button>
            {templates.length > 0 && (
              <div className="flex items-center gap-2 text-sm flex-1">
                <span className="text-gray-500 dark:text-zinc-400 font-medium">or start from template:</span>
                <select
                  onChange={(e) => e.target.value && handleLoadTemplate(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm text-gray-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-purple-500/30"
                >
                  <option value="">Select template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {aiError && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{aiError}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
          <span className="text-base">⚠</span>
          {error}
        </div>
      )}
{/* Invoice Details Card */}
      <div className="dashboard-card space-y-5">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Hash size={18} className="text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold">Invoice Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Invoice Number
            </label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-0001"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              <CalendarDays size={13} className="inline -mt-0.5 mr-1" />
              Issue Date
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              <CalendarDays size={13} className="inline -mt-0.5 mr-1" />
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              <CreditCard size={13} className="inline -mt-0.5 mr-1" />
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} ({getCurrencySymbol(c)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
{/* Bill From / Bill To */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* From */}
        <div className="dashboard-card space-y-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold">From</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Business Name
              </label>
              <input
                value={business.name}
                onChange={(e) => setBusiness((prev) => ({ ...prev, name: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={business.email}
                  onChange={(e) => setBusiness((prev) => ({ ...prev, email: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Phone
                </label>
                <input
                  value={business.phone}
                  onChange={(e) => setBusiness((prev) => ({ ...prev, phone: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Address
              </label>
              <textarea
                value={business.address}
                onChange={(e) => setBusiness((prev) => ({ ...prev, address: e.target.value }))}
                rows={2}
                className={cn(inputCls, 'resize-none')}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Tip: set your default business info in{' '}
              <span className="font-semibold">Settings → Business Profile</span>.
            </p>
          </div>
        </div>

        {/* Bill To */}
        <div className="dashboard-card space-y-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <User size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold">Bill To</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Select Existing Client
              </label>
              <select
                value={client.id}
                onChange={(e) => selectClient(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choose a client or enter below —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                value={client.name}
                onChange={(e) => setClient((prev) => ({ ...prev, name: e.target.value, id: '' }))}
                placeholder="Client / company name"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={client.email}
                  onChange={(e) => setClient((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="client@company.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  Phone
                </label>
                <input
                  value={client.phone}
                  onChange={(e) => setClient((prev) => ({ ...prev, phone: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Address
              </label>
              <textarea
                value={client.address}
                onChange={(e) => setClient((prev) => ({ ...prev, address: e.target.value }))}
                rows={2}
                className={cn(inputCls, 'resize-none')}
              />
            </div>
          </div>
        </div>
      </div>
{/* Line Items */}
      <div className="dashboard-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <StickyNote size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold">Line Items</h3>
          </div>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white dark:text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-200 dark:shadow-none"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <div className="grid grid-cols-[1fr_90px_120px_100px_120px_40px] gap-2 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Tax %</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_90px_110px_80px_120px_40px] gap-2 items-center px-3 py-2 rounded-xl bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800"
              >
                <input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Description of work or item"
                  className="w-full px-2.5 py-1.5 text-sm bg-transparent rounded-lg placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm text-right bg-transparent rounded-lg focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-white"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {getCurrencySymbol(currency)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) })}
                    className="w-full pl-6 pr-2 py-1.5 text-sm text-right bg-transparent rounded-lg focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-white"
                  />
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.taxRate ?? globalTaxRate}
                    onChange={(e) => updateItem(item.id, { taxRate: Number(e.target.value) })}
                    className="w-full pl-2 pr-5 py-1.5 text-sm text-right bg-transparent rounded-lg focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white text-right tabular-nums">
                  {formatMoney(item.amount, currency)}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Remove item"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
{/* Mobile Item Cards */}
        <div className="md:hidden space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-800/50 p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Description item or work"
                  className="flex-1 w-full px-2.5 py-1.5 text-sm bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 dark:text-white"
                />
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 shrink-0"
                  aria-label="Remove item"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm text-right bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm text-right bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Tax %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.taxRate ?? globalTaxRate}
                    onChange={(e) => updateItem(item.id, { taxRate: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm text-right bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                {formatMoney(item.amount, currency)}
              </div>
            </div>
          ))}
        </div>
      </div>
{/* Notes & Payment / Totals Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Notes & Payment */}
        <div className="dashboard-card space-y-3 lg:col-span-3">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <StickyNote size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold">Notes &amp; Payment</h3>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Payment Method
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method);
                    setIsCustomPayment(false);
                  }}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border',
                    paymentMethod === method && !isCustomPayment
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-none'
                      : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                  )}
                >
                  {method}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomPayment(true)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border',
                  isCustomPayment
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-none'
                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:border-blue-300'
                )}
              >
                Other
              </button>
            </div>
            {isCustomPayment && (
              <input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Enter payment method"
                className={cn(inputCls, 'mt-2')}
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
              Notes / Message to Client
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Thank you for your business! Payment is due within 14 days."
              className={cn(inputCls, 'resize-none')}
            />
          </div>
        </div>

        {/* Totals Summary */}
        <div className="dashboard-card lg:col-span-2 h-fit space-y-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-white">
            <CreditCard size={18} className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold">Summary</h3>
          </div>
          <div className="space-y-2.5 text-sm text-gray-600 dark:text-zinc-300">
            <div className="flex items-center justify-between font-medium">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Discount</span>
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-6 pr-2 py-1.5 text-sm text-right bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span>Tax ({globalTaxRate}%)</span>
              <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
            </div>
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200 dark:border-zinc-700">
              <span className="text-base font-bold text-gray-900 dark:text-white">Total</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                {formatMoney(totals.total, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
{/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-200 transition-all active:scale-95 disabled:opacity-50"
        >
          Cancel
        </button>
        <div className="flex flex-col sm:flex-row gap-3">
          {isEdit ? (
            <>
              {initialInvoice?.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handleSave('sent')}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  Save &amp; Send
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-blue-200 dark:shadow-none"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave('sent')}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-blue-200 dark:shadow-none"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Save &amp; Send
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, FileText, Quote as QuoteIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { dbService } from '../services/dbService';
import type { QuoteData } from '../services/dbService';
import type { InvoiceItem } from '../services/geminiService';
import { format } from 'date-fns';

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const currencies = ['USD', 'EUR', 'GBP', 'NGN', 'KES'];

const emptyItem = (): InvoiceItem => ({
  description: '',
  quantity: 1,
  rate: 0,
  amount: 0,
});

export default function CreateQuoteForm({ userId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(10);
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const tax = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + tax;

  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : currency === 'NGN' ? '\u20A6' : 'KSh';

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value } as InvoiceItem;
        updated.amount = (Number(updated.quantity) || 0) * (Number(updated.rate) || 0);
        return updated;
      })
    );
  };

  const addItem = () => setItems([...items, emptyItem()]);

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) { alert('Client name is required.'); return; }
    if (items.some(i => !i.description.trim())) { alert('Please fill in all line item descriptions.'); return; }

    setLoading(true);
    try {
      const client = await dbService.getOrCreateClient(userId, clientName.trim());
      const nowIso = new Date().toISOString();

      const quoteData: QuoteData = {
        userId,
        clientId: client.id,
        clientName: clientName.trim(),
        clientEmail: clientEmail || client.email,
        quoteNumber: `QT-${format(new Date(), 'yyMMdd')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        title: title.trim(),
        status: 'draft',
        items: items.map(i => ({ ...i, amount: (Number(i.quantity) || 0) * (Number(i.rate) || 0) })),
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        discount: 0,
        total: Math.round(total * 100) / 100,
        currency,
        validUntil: validUntil || format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        notes: notes.trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await dbService.saveQuote(userId, quoteData);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save quote', err);
      alert('Failed to save quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/50 dark:bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-zinc-800"
      >

        <div className="sticky top-0 bg-white dark:bg-zinc-950 p-6 sm:p-8 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <QuoteIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tight">Create Quote</h2>
              <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">New Estimate</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Client Name *</label>
              <input type="text" required value={clientName} onChange={e => setClientName(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" placeholder="e.g. Acme Corporation" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Client Email</label>
              <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" placeholder="client@example.com" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" placeholder="e.g. Web Design Estimate" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 bg-gray-50 dark:bg-zinc-900/30 rounded-2xl border border-gray-100 dark:border-zinc-800">
            <div><p className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Subtotal</p><p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">{symbol}{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
            <div><p className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Tax ({taxRate}%)</p><p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">{symbol}{tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
            <div className="col-span-2 sm:col-span-1"><label className="block text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Tax Rate (%)</label><input type="number" min="0" max="100" value={taxRate} onChange={e => setTaxRate(Number(e.target.value) || 0)} className="w-full px-3 py-2.5 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-black text-gray-900 dark:text-white outline-none text-sm" /></div>
            <div className="col-span-2 sm:col-span-1"><p className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Total</p><p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">{symbol}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Currency</label><select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all appearance-none">{currencies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Valid Until</label><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" /></div>
            <div className="flex items-end"><p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Total = Subtotal + Tax</p></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Line Items</h4>
              <button type="button" onClick={addItem} className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"><Plus size={14} /> Add Item</button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 sm:gap-3 items-end p-3 sm:p-4 bg-gray-50 dark:bg-zinc-900/30 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <div className="col-span-12 sm:col-span-6">
                  <label className="block text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Description *</label>
                  <input type="text" required value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none text-sm transition-all" placeholder="Service description" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Qty</label>
                  <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value) || 1)} className="w-full px-3 py-3 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-black text-gray-900 dark:text-white outline-none text-sm transition-all" />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <label className="block text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400 text-xs">{symbol}</span>
                    <input type="number" min="0" value={item.rate} onChange={e => updateItem(index, 'rate', Number(e.target.value) || 0)} className="w-full pl-8 pr-3 py-3 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-black text-gray-900 dark:text-white outline-none text-sm transition-all" />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Amount</label>
                  <div className="px-3 py-3 bg-gray-100 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl font-black text-gray-900 dark:text-white text-sm text-center">{symbol}{(Number(item.amount) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="col-span-1 flex justify-end">
                  {items.length > 1 && (<button type="button" onClick={() => removeItem(index)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Remove item"><Trash2 size={16} /></button>)}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all resize-none" placeholder="Payment terms..." />
          </div>
          <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 text-sm font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-2xl transition-all">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 sm:flex-[2] py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} {loading ? 'Saving...' : 'Save Quote'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

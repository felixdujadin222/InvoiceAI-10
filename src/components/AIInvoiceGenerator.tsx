import React, { useState } from 'react';
import { Sparkles, Loader2, Save, X, Calculator, Plus, Trash2 } from 'lucide-react';
import { parseInvoiceDescription, GeneratedInvoice, InvoiceItem } from '../services/geminiService';
import { dbService } from '../services/dbService';

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AIInvoiceGenerator({ userId, onClose, onSuccess }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<GeneratedInvoice & { discount?: number, currency?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showClientSelect, setShowClientSelect] = useState(false);
  const [isCustomPayment, setIsCustomPayment] = useState(false);
  const paymentMethods = ['Bank Transfer', 'Stripe', 'PayPal', 'Crypto'];

  React.useEffect(() => {
    const fetchInitialData = async () => {
      const [settings, clientsList, templateList] = await Promise.all([
        dbService.getUserSettings(userId),
        dbService.getClients(userId),
        dbService.getInvoiceTemplates(userId)
      ]);
      setUserSettings(settings);
      setClients(clientsList);
      setTemplates(templateList);
    };
    fetchInitialData();
  }, [userId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const result = await parseInvoiceDescription(prompt);
      setDraft({
        ...result,
        suggestedTaxRate: result.suggestedTaxRate || userSettings?.defaultTaxRate || 5,
        discount: 0,
        currency: userSettings?.currency || 'USD',
        paymentMethod: userSettings?.defaultPaymentMethod || 'Bank Transfer'
      });
    } catch (error) {
      console.error("AI Generation failed", error);
      alert("Failed to generate invoice. Please try a more descriptive prompt.");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (index: number) => {
    if (!draft) return;
    const newItems = draft.items.filter((_, i) => i !== index);
    setDraft({ ...draft, items: newItems });
  };

  const calculateTotals = (items: InvoiceItem[], discount: number = 0, globalTaxRate: number = 5) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const discountedFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 1;
    
    const tax = items.reduce((sum, item) => {
      const itemTaxRate = (item.taxRate !== undefined ? item.taxRate : globalTaxRate) / 100;
      const itemDiscountedAmount = item.amount * Math.max(0, discountedFactor);
      return sum + (itemDiscountedAmount * itemTaxRate);
    }, 0);

    const discountedSubtotal = Math.max(0, subtotal - discount);
    return { subtotal, discountedSubtotal, tax, total: discountedSubtotal + tax };
  };

  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'NGN': '₦', 'KES': 'KSh' };
    return symbols[code] || '$';
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const client = await dbService.getOrCreateClient(userId, draft.clientName);
      const totals = calculateTotals(draft.items);
      
      await dbService.saveInvoice(userId, {
        userId,
        clientId: client.id,
        clientName: client.name,
        invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
        status: 'draft',
        items: draft.items,
        ...totals,
        currency: draft.currency || 'USD',
        discount: draft.discount || 0,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        notes: draft.notes,
        remindersEnabled: true,
        paymentMethod: draft.paymentMethod
      });
      
      onSuccess();
    } catch (error) {
      console.error("Save failed", error);
      alert("Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden transform transition-all">
      <div className="p-8">
        {!draft ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Invoice Generator</h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Describe the work you did, and I'll build the invoice.</p>
                </div>
              </div>

              {templates.length > 0 && (
                <div className="hidden lg:block relative group">
                  <select 
                    className="appearance-none pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-500 dark:text-zinc-400 focus:ring-2 focus:ring-purple-500/20 outline-none cursor-pointer transition-all"
                    onChange={(e) => {
                      const template = templates.find(t => t.id === e.target.value);
                      if (template) {
                        setDraft({
                          clientName: '',
                          items: template.items,
                          suggestedTaxRate: template.taxRate || userSettings?.defaultTaxRate || 5,
                          notes: template.notes || '',
                          discount: 0,
                          currency: template.currency || userSettings?.currency || 'USD'
                        });
                      }
                    }}
                  >
                    <option value="">Use Template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <Plus size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your work. Examples:&#10;• '5 hours of branding design for Acme Corp at $100/hr'&#10;• 'Web development package for Sarah: $3000 total minus $200 discount'&#10;• '3 months of SEO maintenance at £500/month for Studio X'"
                className="w-full h-44 p-4 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:bg-white dark:focus:bg-zinc-800 focus:border-purple-300 dark:focus:border-purple-500/40 outline-none transition-all resize-none text-gray-700 dark:text-zinc-200 leading-relaxed font-medium"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-200 dark:shadow-none transition-transform active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} />}
                Generate Draft
              </button>
            </div>
            
            <div className="flex gap-4">
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-black uppercase tracking-widest leading-relaxed">
                <span className="text-purple-600 dark:text-purple-400">Pro Tip:</span> Be specific with rates and quantities. AI works best when you mention the client's name and individual task costs.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Draft Invoice</h2>
              <button 
                onClick={() => setDraft(null)}
                className="text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              >
                Edit Prompt
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 sm:p-6 border border-gray-100 dark:border-zinc-700">
              <div className="mb-6 relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Client</label>
                  <button 
                    onClick={() => setShowClientSelect(!showClientSelect)}
                    className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline"
                  >
                    {showClientSelect ? 'Type Name Instead' : 'Select Existing Client'}
                  </button>
                </div>
                
                {showClientSelect ? (
                  <select 
                    className="w-full text-lg font-bold bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 focus:border-purple-300 dark:focus:border-purple-500 focus:outline-none py-1 appearance-none cursor-pointer dark:text-white"
                    value={draft.clientName}
                    onChange={(e) => {
                      setDraft({...draft, clientName: e.target.value});
                      setShowClientSelect(false);
                    }}
                  >
                    <option value="" disabled>Select a client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={draft.clientName}
                    onChange={(e) => setDraft({...draft, clientName: e.target.value})}
                    className="w-full text-lg font-bold bg-transparent border-b border-transparent focus:border-purple-300 dark:focus:border-purple-500 focus:outline-none py-1 dark:text-white"
                    placeholder="Client Name"
                  />
                )}
              </div>

              <div className="mb-6">
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">Payment Method</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select 
                    className="flex-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none dark:text-white appearance-none"
                    value={paymentMethods.includes(draft.paymentMethod || '') ? draft.paymentMethod : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomPayment(true);
                        setDraft({...draft, paymentMethod: ''});
                      } else {
                        setIsCustomPayment(false);
                        setDraft({...draft, paymentMethod: e.target.value});
                      }
                    }}
                  >
                    <option value="" disabled>Select Method...</option>
                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value="custom">Enter Custom Method...</option>
                  </select>
                  
                  {(isCustomPayment || (draft.paymentMethod && !paymentMethods.includes(draft.paymentMethod))) && (
                    <input 
                      type="text"
                      className="flex-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 outline-none dark:text-white"
                      placeholder="e.g. Venmo, Wire Transfer"
                      value={draft.paymentMethod}
                      onChange={(e) => setDraft({...draft, paymentMethod: e.target.value})}
                    />
                  )}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                {/* Desktop Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-2">
                  <div className="col-span-4 text-italic font-serif">Description</div>
                  <div className="col-span-1 text-center">Qty</div>
                  <div className="col-span-2 text-center">Rate</div>
                  <div className="col-span-2 text-center">Tax %</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1"></div>
                </div>
                
                <div className="space-y-4">
                  {draft.items.map((item, i) => (
                    <div key={i} className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-start sm:items-center bg-white dark:bg-zinc-800 p-5 sm:p-3 rounded-2xl border border-gray-100 dark:border-zinc-700 group shadow-sm sm:shadow-none hover:border-blue-100 dark:hover:border-blue-900/40 transition-all">
                      <div className="w-full sm:col-span-4">
                        <label className="sm:hidden text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Description</label>
                        <input 
                          className="w-full text-base sm:text-sm font-bold sm:font-medium bg-transparent focus:outline-none dark:text-white"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...draft.items];
                            newItems[i].description = e.target.value;
                            setDraft({...draft, items: newItems});
                          }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-7 gap-4 w-full sm:col-span-7">
                        <div className="sm:col-span-1">
                          <label className="sm:hidden text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Qty</label>
                          <input 
                            className="w-full text-sm sm:text-center bg-gray-50 dark:bg-zinc-900 sm:bg-transparent px-3 py-2 sm:p-0 rounded-lg sm:rounded-none focus:outline-none font-bold sm:font-normal dark:text-white text-gray-900"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...draft.items];
                              newItems[i].quantity = Number(e.target.value);
                              newItems[i].amount = newItems[i].quantity * newItems[i].rate;
                              setDraft({...draft, items: newItems});
                            }}
                          />
                        </div>
                        
                        <div className="sm:col-span-2">
                          <label className="sm:hidden text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Rate</label>
                          <div className="relative">
                            <span className="sm:hidden absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">{getCurrencySymbol(draft.currency || 'USD')}</span>
                            <input 
                              className="w-full text-sm sm:text-center pl-7 sm:pl-0 pr-3 sm:pr-0 py-2 sm:py-0 bg-gray-50 dark:bg-zinc-900 sm:bg-transparent rounded-lg sm:rounded-none focus:outline-none font-black sm:font-mono dark:text-white text-gray-900"
                              type="number"
                              value={item.rate}
                              onChange={(e) => {
                                const newItems = [...draft.items];
                                newItems[i].rate = Number(e.target.value);
                                newItems[i].amount = newItems[i].quantity * newItems[i].rate;
                                setDraft({...draft, items: newItems});
                              }}
                            />
                          </div>
                        </div>

                        <div className="col-span-2 xs:col-span-1 sm:col-span-2">
                          <label className="sm:hidden text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Tax %</label>
                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-900 sm:bg-gray-50 dark:sm:bg-zinc-900 rounded-lg px-3 sm:px-2 py-2 sm:py-1">
                            <input 
                              className="w-full text-xs text-center font-bold bg-transparent focus:outline-none dark:text-white text-gray-900"
                              type="number"
                              value={item.taxRate ?? draft.suggestedTaxRate}
                              onChange={(e) => {
                                const newItems = [...draft.items];
                                newItems[i].taxRate = Number(e.target.value);
                                setDraft({...draft, items: newItems});
                              }}
                            />
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500">%</span>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center justify-end sm:col-span-2 text-sm font-black font-mono dark:text-white">
                          {getCurrencySymbol(draft.currency || 'USD')}{item.amount.toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center justify-between w-full sm:w-auto sm:col-span-1 border-t dark:border-zinc-700 sm:border-none pt-4 sm:pt-0 mt-2 sm:mt-0">
                        <div className="sm:hidden">
                           <span className="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest block leading-none mb-1">Row Total</span>
                           <span className="text-base font-black text-gray-900 dark:text-white italic tracking-tighter">{getCurrencySymbol(draft.currency || 'USD')}{item.amount.toLocaleString()}</span>
                        </div>
                        <button 
                          onClick={() => removeItem(i)}
                          className="flex items-center gap-2 px-4 py-2 sm:p-2 bg-red-50 sm:bg-transparent text-red-500 dark:text-red-400 sm:text-gray-300 dark:sm:text-zinc-600 hover:text-red-600 dark:hover:text-red-300 sm:hover:text-red-500 sm:dark:hover:text-red-400 transition-colors sm:opacity-0 group-hover:opacity-100 rounded-xl"
                          title="Remove Item"
                        >
                          <Trash2 size={16} />
                          <span className="sm:hidden text-[10px] font-black uppercase tracking-widest">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700 flex flex-col items-end space-y-4">
                <div className="flex justify-between w-full sm:w-64 text-sm text-gray-500 dark:text-zinc-400 font-medium">
                  <span>Subtotal</span>
                  <span>{getCurrencySymbol(draft.currency || 'USD')}{calculateTotals(draft.items, draft.discount, draft.suggestedTaxRate).subtotal.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-between w-full sm:w-64 gap-4">
                  <label className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Discount</label>
                  <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-700 focus-within:border-purple-500 transition-colors">
                    <span className="text-sm text-gray-400 dark:text-zinc-500 font-mono">{getCurrencySymbol(draft.currency || 'USD')}</span>
                    <input 
                      type="number"
                      className="w-20 bg-transparent text-right text-sm font-black focus:outline-none py-1 dark:text-white"
                      value={draft.discount}
                      onChange={(e) => setDraft({...draft, discount: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-64 gap-4">
                  <label className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Tax Rate</label>
                  <div className="flex items-center gap-1 border-b border-gray-200 dark:border-zinc-700 focus-within:border-purple-500 transition-colors">
                    <input 
                      type="number"
                      className="w-20 bg-transparent text-right text-sm font-black focus:outline-none py-1 dark:text-white"
                      value={draft.suggestedTaxRate}
                      onChange={(e) => setDraft({...draft, suggestedTaxRate: Number(e.target.value)})}
                    />
                    <span className="text-sm text-gray-400 dark:text-zinc-500 font-mono font-bold">%</span>
                  </div>
                </div>

                <div className="flex justify-between w-full sm:w-64 text-sm text-gray-500 dark:text-zinc-400 font-medium">
                  <span>Tax Amount</span>
                  <span>{getCurrencySymbol(draft.currency || 'USD')}{calculateTotals(draft.items, draft.discount, draft.suggestedTaxRate).tax.toLocaleString()}</span>
                </div>

                <div className="flex justify-between w-full sm:w-64 text-xl font-black text-gray-900 dark:text-white pt-3 border-t-2 border-gray-900 dark:border-zinc-700 sm:border-gray-100 dark:sm:border-zinc-800 tracking-tighter italic">
                  <span>Total</span>
                  <span>{getCurrencySymbol(draft.currency || 'USD')}{calculateTotals(draft.items, draft.discount, draft.suggestedTaxRate).total.toLocaleString()}</span>
                </div>
              </div>
            </div>

              <div className="flex items-center justify-between pt-4">
                <button 
                  onClick={onClose}
                  className="px-6 py-2 text-gray-400 dark:text-zinc-500 font-bold hover:text-gray-600 dark:hover:text-zinc-300 transition-colors uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={async () => {
                      if (!draft) return;
                      setSaving(true);
                      try {
                        await dbService.saveInvoiceTemplate(userId, {
                          name: `Template - ${draft.clientName || 'Unnamed'}`,
                          items: draft.items,
                          currency: draft.currency,
                          taxRate: draft.suggestedTaxRate,
                          notes: draft.notes
                        });
                        alert("Template saved successfully!");
                      } catch (e) {
                          console.error(e);
                          alert("Failed to save template.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border border-gray-100 dark:border-zinc-700 font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all active:scale-95 text-sm"
                  >
                    <Plus size={16} />
                    Save Template
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-md transform transition-all active:scale-95 text-sm"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save as Draft
                  </button>
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}

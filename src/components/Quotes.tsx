import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Loader2,
  FileText,
  Trash2,
  FileCheck,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/dbService';
import type { QuoteData } from '../services/dbService';
import { format } from 'date-fns';
import CreateQuoteForm from './CreateQuoteForm';


const makeConvertedInvoiceNumber = () => `INV-${Date.now().toString().slice(-4)}`;

export default function Quotes({ userId }: { userId: string }) {
  const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbService.getQuotes(userId);
      setQuotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQuotes();
  }, [fetchQuotes]);

    const handleConvertToInvoice = async (quote: QuoteData) => {
    if (!quote.id) return;
    setConverting(quote.id);
    try {
      const invoiceNumber = makeConvertedInvoiceNumber();

      // Resolve the client â€” the seed quote may not carry a clientId, so we
      // look it up (or create it on the fly) to satisfy invoice validation.
      let { clientId } = quote;
      if (!clientId) {
        const client = await dbService.getOrCreateClient(userId, quote.clientName?.trim() || 'Unknown Client');
        clientId = client.id;
      }

      // Compute total from items + tax if the quote didn't carry one.
      const itemsTotal = (quote.items || []).reduce(
        (sum, i) => sum + (Number(i.amount) || 0),
        0,
      );
      const safeTotal = quote.total != null ? quote.total : itemsTotal;

      await dbService.saveInvoice(userId, {
        ...quote,
        clientId: clientId as string,
        status: 'draft',
        invoiceNumber,
        total: safeTotal,
        items: quote.items || [],
        currency: quote.currency || 'USD',
      });
      await dbService.deleteQuote(userId, quote.id);
      fetchQuotes();
      alert("Quote successfully converted to Invoice draft!");
    } catch {
      alert("Failed to convert quote");
    } finally {
      setConverting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quote?")) return;
    try {
      await dbService.deleteQuote(userId, id);
      fetchQuotes();
    } catch {
      alert("Failed to delete quote");
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">Estimates & Quotes</h2>
          <p className="text-gray-500 dark:text-zinc-400 font-medium mt-2">Manage your project proposals and estimates</p>
        </div>
        
                <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 sm:px-8 py-3.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl active:scale-95 disabled:opacity-50 w-full sm:w-auto"
        >
          <Plus size={20} />
          Create Quote
        </button>
      </div>

      <div className="bg-white md:bg-transparent md:border-none border border-gray-200 rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden">
        {loading ? (
          <div className="bg-white rounded-[2rem] p-12 sm:p-20 text-center dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 shadow-sm">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" size={32} />
            <p className="text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest text-xs">Fetching estimates...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-12 sm:p-16 text-center space-y-6 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 dark:bg-zinc-800 text-gray-200 rounded-[2rem] flex items-center justify-center mx-auto">
              <FileText size={48} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white italic tracking-tight">No Quotes Found</h4>
              <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">
                Proposals you create for clients will appear here.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-zinc-800/50 text-left border-b border-gray-100 dark:border-zinc-800">
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Quote Info</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Client</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Status</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none text-right">Amount</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="group hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-black">Q</div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{quote.quoteNumber || 'QT-2024-001'}</p>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{format(quote.createdAt ? new Date(quote.createdAt) : new Date(), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="font-bold text-gray-900 dark:text-white uppercase tracking-tighter italic">{quote.clientName}</p>
                        <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 leading-none mt-1">{quote.clientEmail}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-block px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-yellow-200/50 dark:border-yellow-800/30 shadow-sm">
                          Pending
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-lg font-black text-gray-900 dark:text-white tracking-tighter italic">
                          {quote.currency === 'USD' ? '$' : quote.currency}{(quote.total || 0).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2 transition-all">
                          <button 
                            onClick={() => handleConvertToInvoice(quote)}
                            disabled={converting === quote.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-green-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                          >
                            {converting === quote.id ? <Loader2 className="animate-spin" size={14} /> : <FileCheck size={14} />}
                            Invoice
                          </button>
                          <button onClick={() => handleDelete(quote.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Grid View */}
            <div className="md:hidden space-y-4">
              {quotes.map((quote) => (
                <div key={quote.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-black">Q</div>
                      <div>
                        <h4 className="text-sm font-black text-gray-900 dark:text-white tracking-tight">{quote.quoteNumber || 'QT-2024-001'}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{format(quote.createdAt ? new Date(quote.createdAt) : new Date(), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-yellow-100 dark:border-yellow-800/30 shadow-sm">
                      Pending
                    </span>
                  </div>

                  <div className="py-3 border-y border-gray-50 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Client</span>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tighter italic">{quote.clientName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Amount</span>
                      <span className="text-lg font-black text-gray-900 dark:text-white tracking-tighter italic">
                        {quote.currency === 'USD' ? '$' : quote.currency}{(quote.total || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleConvertToInvoice(quote)}
                      disabled={converting === quote.id}
                      className="flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-green-100"
                    >
                      {converting === quote.id ? <Loader2 className="animate-spin" size={14} /> : <FileCheck size={14} />}
                      Convert to Invoice
                    </button>
                    <button 
                      onClick={() => handleDelete(quote.id)}
                      className="flex items-center justify-center gap-2 py-3.5 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all border border-gray-100 dark:border-zinc-700 active:scale-95"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Create Quote Modal */}
    <AnimatePresence>
      {showCreateModal && (
        <CreateQuoteForm
          userId={userId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchQuotes();
          }}
        />
      )}
    </AnimatePresence>
    </>
  );
}



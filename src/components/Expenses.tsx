import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Loader2, Receipt, 
  Trash2, Download, TrendingUp, Calendar, 
  Camera, FileText, Sparkles, DollarSign,
  ChevronRight, ArrowDownLeft
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { parseReceipt, getFinancialInsights } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function Expenses({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newExpense, setNewExpense] = useState({
    merchant: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'General',
    notes: '',
    currency: 'USD'
  });

  useEffect(() => {
    fetchExpenses();
  }, [userId]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await dbService.getExpenses(userId);
      setExpenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      // Note: In a real app we'd convert image to base64
      // Mocking AI parsing for demo purposes
      const result = await parseReceipt(file);
      if (result) {
        setNewExpense({
          ...newExpense,
          merchant: result.merchant || '',
          amount: result.amount || 0,
          date: result.date || format(new Date(), 'yyyy-MM-dd'),
          category: result.category || 'General',
          currency: result.currency || 'USD'
        });
        setShowAddModal(true);
      }
    } catch (err) {
      console.error("AI Component failed", err);
      alert("Failed to parse receipt. Please enter manually.");
      setShowAddModal(true);
    } finally {
      setParsing(false);
    }
  };

  const handleSaveExpense = async () => {
    try {
      await dbService.addExpense(userId, newExpense);
      setShowAddModal(false);
      fetchExpenses();
      setNewExpense({
        merchant: '',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        category: 'General',
        notes: '',
        currency: 'USD'
      });
    } catch (err) {
      alert("Failed to save expense");
    }
  };

  const categories = ['General', 'Travel', 'Food', 'Software', 'hardware', 'Marketing', 'Taxes', 'Office'];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">Expense Tracker</h2>
          <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm mt-2">AI-powered receipt management</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 w-full sm:w-auto">
          <label className={cn(
            "flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white font-bold rounded-2xl cursor-pointer hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-100 dark:shadow-none text-sm",
            parsing && "opacity-50 pointer-events-none"
          )}>
            {parsing ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
            {parsing ? "Parsing..." : "Scan Receipt"}
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 dark:bg-zinc-800 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-zinc-700 transition-all active:scale-95 shadow-xl shadow-gray-200 dark:shadow-none text-sm"
          >
            <Plus size={18} />
            Add Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Expense List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-widest text-[10px] sm:text-xs">Recent Transactions</h3>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Search expenses..." 
                  className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                />
              </div>
            </div>
            
            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
              {loading ? (
                <div className="p-12 text-center text-gray-400 dark:text-zinc-500">
                  <Loader2 className="animate-spin mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Loading transactions...</p>
                </div>
              ) : expenses.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-zinc-800 text-gray-300 dark:text-zinc-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Receipt size={28} />
                  </div>
                  <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm">No expenses recorded yet.</p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <div key={expense.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold shrink-0">
                        {expense.merchant?.[0]?.toUpperCase() || 'E'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">{expense.merchant}</h4>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 truncate">
                          <span className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-zinc-400">{expense.category}</span>
                          <span>{expense.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3 sm:gap-6 shrink-0">
                      <div>
                        <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white">-${expense.amount.toLocaleString()}</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{expense.currency}</p>
                      </div>
                      <button className="sm:opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Expense Summary & AI Insights */}
        <div className="space-y-6 sm:gap-8 flex flex-col md:flex-row lg:flex-col items-stretch">
          <div className="flex-1 bg-gray-900 dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl border border-transparent dark:border-zinc-800">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-600 rounded-full blur-[60px] opacity-20" />
            <h3 className="text-xl font-bold italic tracking-tight mb-6 sm:mb-8">AI Audit</h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Status</p>
                  <p className="text-xs sm:text-sm font-medium leading-relaxed dark:text-zinc-300">
                    Your expenses are trending 5% higher this month, primarily due to subscriptions.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-800 dark:border-zinc-800 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1">Total Burn</p>
                  <p className="text-lg sm:text-xl font-black">${expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1">Audit Score</p>
                  <p className="text-lg sm:text-xl font-black text-green-400">92/100</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white border-b border-gray-50 dark:border-zinc-800 pb-4">Categories</h3>
            <div className="space-y-4">
              {categories.map(cat => {
                const total = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
                if (total === 0) return null;
                const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
                const perc = totalAmount > 0 ? (total / totalAmount) * 100 : 0;
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-500">
                      <span>{cat}</span>
                      <span>${total.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.max(5, perc)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-transparent dark:border-zinc-800"
            >
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-50 dark:shadow-none">
                      <Receipt size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white italic tracking-tight">Record Expense</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Verify AI Extraction</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400 dark:text-zinc-500">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Merchant / Vendor</label>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" 
                      value={newExpense.merchant}
                      onChange={e => setNewExpense({...newExpense, merchant: e.target.value})}
                      placeholder="e.g. AWS, Starbucks, Uber"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="number" 
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" 
                        value={newExpense.amount}
                        onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Category</label>
                    <select 
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all appearance-none"
                      value={newExpense.category}
                      onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Date</label>
                    <input 
                      type="date" 
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all" 
                      value={newExpense.date}
                      onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Currency</label>
                    <select 
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-900 dark:text-white outline-none transition-all appearance-none"
                      value={newExpense.currency}
                      onChange={e => setNewExpense({...newExpense, currency: e.target.value})}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveExpense}
                    className="flex-[2] py-4 bg-gray-900 dark:bg-blue-600 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-gray-200 dark:shadow-none active:scale-95"
                  >
                    <CheckCircle size={20} />
                    Confirm Expense
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function CheckCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

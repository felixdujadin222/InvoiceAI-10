import React, { useState } from 'react';
import { Save, X, Repeat, Loader2, Calendar } from 'lucide-react';
import { dbService } from '../services/dbService';

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecurringInvoiceForm({ userId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    frequency: 'monthly',
    amount: '',
    paymentMethod: 'Bank Transfer',
    startDate: new Date().toISOString().split('T')[0],
  });
  const paymentMethods = ['Bank Transfer', 'Stripe', 'PayPal', 'Crypto'];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const client = await dbService.getOrCreateClient(userId, formData.clientName);
      
      // Calculate next run date based on frequency
      const nextRun = new Date(formData.startDate);
      
      await dbService.saveRecurringInvoice(userId, {
        userId,
        clientId: client.id,
        clientName: client.name,
        frequency: formData.frequency,
        total: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        items: [{ description: "Monthly Retainer", quantity: 1, rate: parseFloat(formData.amount), amount: parseFloat(formData.amount) }],
        nextRunDate: nextRun.toISOString(),
        active: true,
        startDate: nextRun.toISOString(),
      });
      
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to save recurring template.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-6 sm:p-8 w-full max-w-xl mx-auto overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
            <Repeat size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight italic">Recurring Setup</h2>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Automation Engine</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-300 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Client Name</label>
          <input 
            required
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-gray-900"
            value={formData.clientName}
            onChange={e => setFormData({...formData, clientName: e.target.value})}
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Billing Frequency</label>
            <select 
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-900 appearance-none"
              value={formData.frequency}
              onChange={e => setFormData({...formData, frequency: e.target.value})}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom (Check settings)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Bill Amount</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-gray-400">$</span>
              <input 
                required
                type="number"
                className="w-full pl-10 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-black text-gray-900"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div>
           <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Payment Method</label>
           <select 
              className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-900 appearance-none"
              value={formData.paymentMethod}
              onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
            >
              {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="date"
              className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-900"
              value={formData.startDate}
              onChange={e => setFormData({...formData, startDate: e.target.value})}
            />
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-4">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={loading}
            className="flex-[2] py-4 bg-gray-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-gray-200 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin text-white" size={20} /> : <Save size={18} />}
            Enable Automation
          </button>
        </div>
      </form>
    </div>
  );
}

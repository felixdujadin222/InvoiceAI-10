import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { auth } from '../lib/firebase';
import { Plus, Repeat, Calendar, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function RecurringInvoices({ onNew }: { onNew: () => void }) {
  const [recurring, setRecurring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!auth.currentUser) return;
      try {
        const data = await dbService.getRecurringInvoices(auth.currentUser.uid);
        setRecurring(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    if (!auth.currentUser) return;
    try {
      await dbService.toggleRecurringActive(auth.currentUser.uid, id, !current);
      setRecurring(recurring.map(r => r.id === id ? { ...r, active: !current } : r));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Recurring Invoices</h2>
        <button 
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {recurring.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-500">
            <Repeat size={40} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">No recurring invoices set up yet.</p>
            <p className="text-sm">Automate your retainers and subscriptions.</p>
          </div>
        ) : (
          recurring.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all hover:border-blue-100 group">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl transition-colors ${item.active ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' : 'bg-gray-50 text-gray-400'}`}>
                  <Repeat size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">{item.clientName}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-300" />
                      {item.frequency}
                    </span>
                    <span className="text-xs font-black text-blue-600 uppercase tracking-widest">
                      ${item.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-6 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Next Run</p>
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(item.nextRunDate).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleActive(item.id, item.active)}
                    className={cn(
                      "transition-all active:scale-95",
                      item.active ? 'text-blue-600' : 'text-gray-300'
                    )}
                  >
                    {item.active ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </button>
                  
                  <button className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

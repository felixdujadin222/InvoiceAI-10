import React, { useState, useEffect } from 'react';
import { dbService, ClientData } from '../services/dbService';
import { auth } from '../lib/firebase';
import { 
  UserPlus, 
  Mail, 
  Phone, 
  Edit2, 
  Loader2, 
  Search, 
  Plus, 
  X,
  User,
  Trash2,
  MoreVertical,
  ChevronDown,
  ArrowUpDown,
  MapPin,
  Calendar,
  Filter,
  Tags,
  History,
  Download,
  Upload,
  Activity,
  CreditCard,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

type SortOption = 'name_asc' | 'name_desc' | 'newest';

export default function ClientList() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    status: 'active' as any,
    tags: [] as string[]
  });

  const [viewHistoryClient, setViewHistoryClient] = useState<ClientData | null>(null);
  const [historyTab, setHistoryTab] = useState<'ledger' | 'activity'>('ledger');
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const fetchClients = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const data = await dbService.getClients(auth.currentUser.uid);
      setClients(data);
    } catch (error) {
      console.error("Failed to fetch clients", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (editingClient) {
      setFormData({
        name: editingClient.name,
        email: editingClient.email,
        phone: editingClient.phone || '',
        address: editingClient.address || '',
        category: editingClient.category || '',
        status: editingClient.status || 'active',
        tags: editingClient.tags || []
      });
      setShowForm(true);
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        category: '',
        status: 'active',
        tags: []
      });
    }
  }, [editingClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      if (editingClient) {
        await dbService.updateClient(auth.currentUser.uid, editingClient.id, formData);
        await dbService.addClientActivity(auth.currentUser.uid, editingClient.id, {
          action: 'Profile Updated',
          notes: 'Manually edited client details'
        });
      } else {
        await dbService.addClient(auth.currentUser.uid, formData);
      }
      setShowForm(false);
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error("Failed to save client", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await dbService.deleteClient(auth.currentUser.uid, id);
      setDeletingId(null);
      fetchClients();
    } catch (error) {
      console.error("Failed to delete client", error);
    }
  };

  const openHistory = async (client: ClientData) => {
    setViewHistoryClient(client);
    setHistoryTab('ledger');
    setLoadingHistory(true);
    try {
      if (!auth.currentUser) return;
      const data = await dbService.getClientInvoices(auth.currentUser.uid, client.id);
      setClientInvoices(data);
    } catch (error) {
      console.error("Failed to fetch client invoices", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Phone', 'Address', 'Category', 'Status', 'Tags'];
    const rows = filteredAndSortedClients.map(c => [
      c.name,
      c.email,
      c.phone || '',
      `"${c.address || ''}"`,
      c.category || '',
      c.status || '',
      `"${(c.tags || []).join(',')}"`
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',');
      
      const newClients = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((h, i) => {
           const key = h.toLowerCase().trim();
           let val = values[i]?.replace(/^"|"$/g, '').trim();
           if (key === 'tags') {
             obj[key] = val ? val.split(';') : [];
           } else {
             obj[key] = val;
           }
        });
        return obj;
      });

      try {
        await dbService.batchAddClients(auth.currentUser!.uid, newClients);
        alert(`Successfully imported ${newClients.length} clients`);
        fetchClients();
      } catch (err) {
        console.error(err);
        alert("Import failed. Ensure CSV format matches export.");
      }
    };
    reader.readAsText(file);
  };

  const categories = Array.from(new Set(clients.map(c => c.category).filter(Boolean)));
  const allTagsAvailable = Array.from(new Set(clients.flatMap(c => c.tags || []).filter(Boolean)));
  const statuses = ['active', 'inactive', 'lead', 'archived'];

  const filteredAndSortedClients = clients
    .filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            client.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || client.category === categoryFilter;
      const matchesTag = tagFilter === 'all' || (client.tags && client.tags.includes(tagFilter));
      return matchesSearch && matchesStatus && matchesCategory && matchesTag;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'newest') {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      }
      return 0;
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none font-display">Your Clients</h2>
          <p className="text-gray-500 dark:text-zinc-400 font-medium mt-2 text-sm sm:text-base">Segmented CRM & Billing History</p>
        </div>
        <div className="flex flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex gap-2 flex-1 sm:flex-none">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 rounded-2xl font-bold text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95 cursor-pointer">
              <Upload size={16} />
              <span className="xs:inline hidden">Import</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </label>
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 rounded-2xl font-bold text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
            >
              <Download size={16} />
              <span className="xs:inline hidden">Export</span>
            </button>
          </div>
          <button
            onClick={() => {
              setEditingClient(null);
              setShowForm(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-blue-600 text-white rounded-2xl font-bold text-xs sm:text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 group"
          >
            <UserPlus size={18} className="group-hover:rotate-12 transition-transform" />
            <span className="whitespace-nowrap">New Client</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search clients..."
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm transition-all text-sm font-medium dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-4">
           <div className="flex-1 min-w-[200px] relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-10 py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-sm font-bold text-gray-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
           </div>

           <div className="flex-1 min-w-[200px] relative">
              <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-10 pr-10 py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-sm font-bold text-gray-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
           </div>

           <div className="flex-1 min-w-[200px] relative">
              <Tags className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full pl-10 pr-10 py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-sm font-bold text-gray-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="all">All Tags</option>
                {allTagsAvailable.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
           </div>

           <div className="flex-1 min-w-[200px] relative">
              <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full pl-10 pr-10 py-4 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm text-sm font-bold text-gray-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="newest">Recently Added</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
           </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-32 text-center border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Loading clientele...</p>
        </div>
      ) : filteredAndSortedClients.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-32 text-center border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="w-20 h-20 bg-gray-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center mx-auto text-gray-200 dark:text-zinc-700">
            <User size={48} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xl font-bold text-gray-900 dark:text-white italic tracking-tight">No Clients Found</h4>
            <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-xs mx-auto font-medium">Add your first client to start automating your invoices.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all"
          >
            Create Client Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedClients.map((client) => (
            <motion.div 
              layout
              key={client.id} 
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative group overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-100 dark:shadow-none">
                    {client.name[0]}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white leading-none truncate max-w-[150px] italic tracking-tight text-lg">{client.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                        client.status === 'active' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30" :
                        client.status === 'lead' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" :
                        client.status === 'inactive' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                        "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-100 dark:border-zinc-700"
                      )}>
                        {client.status || 'active'}
                      </span>
                      {client.category && (
                        <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 rounded-full text-[8px] font-black uppercase tracking-widest">
                          {client.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingClient(client)}
                    className="p-2.5 text-gray-300 dark:text-zinc-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all active:scale-95"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setDeletingId(client.id)}
                    className="p-2.5 text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-95"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-50 dark:border-zinc-800">
                <div className="flex items-center gap-4 group/item">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-500 group-hover/item:bg-blue-50 dark:group-hover/item:bg-blue-900/40 group-hover/item:text-blue-500 dark:group-hover/item:text-blue-400 transition-colors">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Email Address</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-zinc-300 truncate">{client.email}</p>
                  </div>
                </div>

                {client.phone && (
                  <div className="flex items-center gap-4 group/item">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-500 group-hover/item:bg-blue-50 dark:group-hover/item:bg-blue-900/40 group-hover/item:text-blue-500 dark:group-hover/item:text-blue-400 transition-colors">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Phone Number</p>
                      <p className="text-sm font-bold text-gray-700 dark:text-zinc-300">{client.phone}</p>
                    </div>
                  </div>
                )}

                {client.address && (
                  <div className="flex items-center gap-4 group/item">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-400 dark:text-zinc-500 group-hover/item:bg-blue-50 dark:group-hover/item:bg-blue-900/40 group-hover/item:text-blue-500 dark:group-hover/item:text-blue-400 transition-colors">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-0.5">Billing Address</p>
                      <p className="text-sm font-bold text-gray-700 dark:text-zinc-300 truncate">{client.address}</p>
                    </div>
                  </div>
                )}

                {client.tags && client.tags.length > 0 && (
                   <div className="flex flex-wrap gap-1.5 pt-2">
                     {client.tags.map(tag => (
                       <span key={tag} className="px-2 py-0.5 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 rounded-lg text-[9px] font-bold uppercase tracking-widest">
                         {tag}
                       </span>
                     ))}
                   </div>
                )}
              </div>
              
              <div className="mt-8 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-gray-300 dark:text-zinc-700">
                    <Calendar size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Added {client.createdAt ? format(client.createdAt.toDate(), 'MMM yyyy') : 'Recently'}</span>
                 </div>
                 <button 
                   onClick={() => openHistory(client)}
                   className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
                 >
                   View Ledger
                 </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Client History Modal */}
      <AnimatePresence>
        {viewHistoryClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-gray-50/30 dark:bg-zinc-800/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">
                    {viewHistoryClient.name[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tight">{viewHistoryClient.name}</h3>
                    <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Client Insights & History</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button 
                      onClick={() => setHistoryTab('ledger')}
                      className={cn(
                        "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                        historyTab === 'ledger' ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
                      )}
                    >
                      Ledger
                    </button>
                    <button 
                      onClick={() => setHistoryTab('activity')}
                      className={cn(
                        "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                        historyTab === 'activity' ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
                      )}
                    >
                      Activity
                    </button>
                  </div>
                  <button onClick={() => setViewHistoryClient(null)} className="p-3 text-gray-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all shadow-sm">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {historyTab === 'ledger' ? (
                  <>
                    {loadingHistory ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compiling history...</p>
                      </div>
                    ) : clientInvoices.length === 0 ? (
                      <div className="text-center py-20 space-y-3">
                        <div className="text-gray-200 flex justify-center">
                          <Calendar size={48} />
                        </div>
                        <p className="text-sm font-bold text-gray-400 leading-relaxed max-w-xs mx-auto italic">No transaction history found for this client.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 mb-8">
                           <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Billed</p>
                              <p className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                ${clientInvoices.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}
                              </p>
                           </div>
                           <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-900/30">
                              <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Paid Invoices</p>
                              <p className="text-xl font-black text-green-600 dark:text-green-400 tracking-tight">
                                {clientInvoices.filter(i => i.status === 'paid').length}
                              </p>
                           </div>
                           <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl border border-gray-100 dark:border-zinc-700">
                              <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Total Records</p>
                              <p className="text-xl font-black text-gray-600 dark:text-zinc-300 tracking-tight">
                                {clientInvoices.length}
                              </p>
                           </div>
                        </div>

                        <div className="space-y-2">
                           {clientInvoices.map((inv) => (
                             <div key={inv.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 rounded-2xl hover:border-blue-100 dark:hover:border-blue-900/50 transition-colors group">
                               <div>
                                 <p className="text-sm font-bold text-gray-900 dark:text-white">{inv.invoiceNumber}</p>
                                 <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                                   {new Date(inv.dueDate).toLocaleDateString()}
                                 </p>
                               </div>
                               <div className="text-right">
                                 <p className="text-sm font-black text-gray-900 dark:text-white">${inv.total?.toLocaleString()}</p>
                                 <span className={cn(
                                   "text-[8px] font-black uppercase tracking-widest",
                                   inv.status === 'paid' ? "text-green-500" : "text-amber-500"
                                 )}>
                                   {inv.status}
                                 </span>
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-6">
                    {viewHistoryClient.activityLog && viewHistoryClient.activityLog.length > 0 ? (
                       <div className="relative border-l-2 border-gray-100 dark:border-zinc-800 ml-4 space-y-8 pb-8">
                         {viewHistoryClient.activityLog.map((log, idx) => (
                           <div key={idx} className="relative pl-8">
                              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border-2 border-blue-500" />
                              <div>
                                <div className="flex items-center justify-between">
                                  <h5 className="text-sm font-black text-gray-900 dark:text-white tracking-tight italic">{log.action}</h5>
                                  <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500">{format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}</span>
                                </div>
                                {log.notes && (
                                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-medium bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-gray-100 dark:border-zinc-700">{log.notes}</p>
                                )}
                              </div>
                           </div>
                         ))}
                       </div>
                    ) : (
                       <div className="text-center py-20 space-y-3">
                        <div className="text-gray-200 flex justify-center">
                          <Activity size={48} />
                        </div>
                        <p className="text-sm font-bold text-gray-400 leading-relaxed max-w-xs mx-auto italic">No activity recorded for this client yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex justify-center">
                 <button 
                  onClick={() => setViewHistoryClient(null)}
                  className="px-8 py-3 bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all border border-gray-200 dark:border-zinc-700"
                 >
                  Close Ledger
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-[1.5rem] flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white italic tracking-tight underline decoration-red-100 dark:decoration-red-900/30 decoration-4">Delete Client?</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">This will permanently remove the client and their details. This action cannot be undone.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="py-3.5 bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-sm font-bold rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-95"
                >
                  Keep Client
                </button>
                <button 
                  onClick={() => handleDelete(deletingId)}
                  className="py-3.5 bg-red-500 text-white text-sm font-bold rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-100 dark:shadow-none active:scale-95"
                >
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight italic">
                      {editingClient ? 'Edit Information' : 'New Client Profile'}
                    </h3>
                    <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Client Management System</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Full Name / Business</label>
                  <input
                    required
                    type="text"
                    className="w-full px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. John Doe / Acme Corp"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Primary Email</label>
                  <input
                    required
                    type="email"
                    className="w-full px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Direct Phone</label>
                  <input
                    type="tel"
                    className="w-full px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Billing Address</label>
                  <textarea
                    className="w-full px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all resize-none font-bold text-gray-900 dark:text-white"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="123 Main St, City, Country"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Status</label>
                    <select
                      className="w-full px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    >
                      {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 focus-within:z-10">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                    <div className="relative group/cat">
                      <select
                        className="w-full px-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                        value={['Retainer', 'One-off', 'Subscription', ''].includes(formData.category) ? formData.category : 'custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            setFormData({...formData, category: 'New Category'});
                          } else {
                            setFormData({...formData, category: val});
                          }
                        }}
                      >
                        <option value="">Uncategorized</option>
                        <option value="Retainer">Retainer</option>
                        <option value="One-off">One-off</option>
                        <option value="Subscription">Subscription</option>
                        {!['Retainer', 'One-off', 'Subscription', ''].includes(formData.category) && (
                          <option value={formData.category}>{formData.category}</option>
                        )}
                        <option value="custom" className="text-blue-600 dark:text-blue-400 font-black">+ Custom Category...</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                {!['Retainer', 'One-off', 'Subscription', ''].includes(formData.category) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-1.5"
                  >
                    <label className="block text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Custom Category Name</label>
                    <input
                      autoFocus
                      type="text"
                      className="w-full px-6 py-4 bg-blue-50/10 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/30 outline-none transition-all font-bold text-gray-900 dark:text-white"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      placeholder="Enter custom category..."
                    />
                  </motion.div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Tags</label>
                    <div className="flex gap-1">
                      {['VIP', 'Prospect', 'Regular'].map(suggested => (
                        <button
                          key={suggested}
                          type="button"
                          onClick={() => {
                            if (!formData.tags.includes(suggested)) {
                              setFormData({...formData, tags: [...formData.tags, suggested]});
                            }
                          }}
                          className="px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          + {suggested}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 p-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl">
                     {formData.tags.map(tag => (
                       <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm">
                         {tag}
                         <button type="button" onClick={() => setFormData({...formData, tags: formData.tags.filter(t => t !== tag)})}>
                           <X size={12} className="text-gray-400 hover:text-red-500" />
                         </button>
                       </span>
                     ))}
                     <input
                       type="text"
                       className="bg-transparent outline-none flex-1 min-w-[120px] text-xs font-bold dark:text-white"
                       value={tagInput}
                       onChange={(e) => setTagInput(e.target.value)}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           e.preventDefault();
                           const tag = tagInput.trim();
                           if (tag && !formData.tags.includes(tag)) {
                             setFormData({...formData, tags: [...formData.tags, tag]});
                             setTagInput('');
                           }
                         }
                       }}
                       placeholder="Add tag..."
                     />
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-4 text-sm font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none active:scale-95"
                  >
                    {editingClient ? 'Sync Changes' : 'Initialize Client'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

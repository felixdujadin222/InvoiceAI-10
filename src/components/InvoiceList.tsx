import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Search, Filter, MoreVertical, ExternalLink, Download, Loader2, X, FileText, Calendar, User, DollarSign, CheckCircle2, ChevronDown, Trash2, ArrowUpDown, ChevronUp, MessageSquare, Eye, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/dbService';
import { auth } from '../lib/firebase';
import { generateInvoicePDF } from '../services/pdfService';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceListProps {
  showToast?: (message: string, type: 'success' | 'info' | 'error') => void;
}

export default function InvoiceList({ showToast }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);
  const [sharingInvoice, setSharingInvoice] = useState<any>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false);
  const [isCustomPayment, setIsCustomPayment] = useState(false);
  const paymentMethods = ['Bank Transfer', 'Stripe', 'PayPal', 'Crypto'];
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });
  const batchMenuRef = useRef<HTMLDivElement>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (batchMenuRef.current && !batchMenuRef.current.contains(event.target as Node)) {
        setIsBatchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      try {
        const [invoiceData, settingsData, clientsData] = await Promise.all([
          dbService.getInvoices(auth.currentUser.uid),
          dbService.getUserSettings(auth.currentUser.uid),
          dbService.getClients(auth.currentUser.uid)
        ]);
        setInvoices(invoiceData);
        setUserSettings(settingsData);
        setClients(clientsData);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'NGN': '₦', 'KES': 'KSh' };
    return symbols[code] || '$';
  };

  const handleWhatsAppReminder = (invoice: any) => {
    const client = clients.find(c => c.name === invoice.clientName || c.id === invoice.clientId);
    const phone = client?.phone || '';
    
    if (!phone) {
      alert("No phone number found for this client. Please add one in 'Manage Clients'.");
      return;
    }

    const message = `Hi ${invoice.clientName}, this is a friendly reminder for invoice ${invoice.invoiceNumber}. The total amount is $${invoice.total.toLocaleString()} and it was due on ${new Date(invoice.dueDate).toLocaleDateString()}. You can pay via ${userSettings?.businessName || 'our secure portal'}. Thank you!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDownload = (invoice: any) => {
    generateInvoicePDF({
      invoiceNumber: invoice.invoiceNumber,
      date: new Date(invoice.createdAt?.toDate?.() || Date.now()).toLocaleDateString(),
      dueDate: new Date(invoice.dueDate).toLocaleDateString(),
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail || 'client@example.com',
      items: invoice.items || [],
      subtotal: invoice.subtotal || 0,
      tax: invoice.tax || 0,
      discount: invoice.discount || 0,
      total: invoice.total || 0,
      currency: invoice.currency || 'USD',
      businessName: userSettings?.businessName || 'InvoiceFlow AI',
      businessEmail: auth.currentUser?.email || undefined,
      logoUrl: userSettings?.logoUrl,
      terms: userSettings?.terms,
      bankDetails: userSettings?.bankDetails
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
      case 'overdue': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
      case 'sent': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
      default: return 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-400';
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(invoice => {
      const matchesSearch = 
        invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || invoice.status?.toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Normalizing data for comparison
        if (sortConfig.key === 'dueDate' || sortConfig.key === 'createdAt') {
          aValue = new Date(aValue?.toDate?.() || aValue).getTime();
          bValue = new Date(bValue?.toDate?.() || bValue).getTime();
        }
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [invoices, searchQuery, statusFilter, sortConfig]);

  const statuses = [
    { id: 'all', label: 'All Invoices' },
    { id: 'draft', label: 'Draft' },
    { id: 'sent', label: 'Sent' },
    { id: 'paid', label: 'Paid' },
    { id: 'overdue', label: 'Overdue' },
  ];

  const handleSelectInvoice = (id: string, e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvoices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const batchMarkAsPaid = async () => {
    if (!auth.currentUser || selectedInvoices.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const userId = auth.currentUser.uid;
      const updates = Array.from(selectedInvoices).map((id: string) => 
        dbService.updateInvoiceStatus(userId, id, 'paid')
      );
      await Promise.all(updates);
      
      // Refresh local state
      setInvoices(prev => prev.map(inv => 
        selectedInvoices.has(inv.id) ? { ...inv, status: 'paid' } : inv
      ));
      setSelectedInvoices(new Set());
      showToast?.(`Marked ${selectedInvoices.size} invoices as paid`, 'success');
    } catch (error) {
      console.error("Batch update failed", error);
      showToast?.("Failed to update invoices", 'error');
    } finally {
      setIsBatchProcessing(false);
      setIsBatchMenuOpen(false);
    }
  };

  const batchDeleteInvoices = async () => {
    if (!auth.currentUser || selectedInvoices.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedInvoices.size} invoices? This action cannot be undone.`)) return;
    
    setIsBatchProcessing(true);
    try {
      const userId = auth.currentUser.uid;
      const deletions = Array.from(selectedInvoices).map((id: string) => 
        dbService.deleteInvoice(userId, id)
      );
      await Promise.all(deletions);
      
      // Refresh local state
      setInvoices(prev => prev.filter(inv => !selectedInvoices.has(inv.id)));
      const count = selectedInvoices.size;
      setSelectedInvoices(new Set());
      showToast?.(`Successfully deleted ${count} invoices`, 'success');
    } catch (error) {
      console.error("Batch deletion failed", error);
      showToast?.("Failed to delete records", 'error');
    } finally {
      setIsBatchProcessing(false);
      setIsBatchMenuOpen(false);
    }
  };

  const batchDownloadPDFs = async () => {
    const selectedData = filteredInvoices.filter(inv => selectedInvoices.has(inv.id));
    for (const invoice of selectedData) {
      handleDownload(invoice);
    }
    const count = selectedInvoices.size;
    setSelectedInvoices(new Set());
    setIsBatchMenuOpen(false);
    showToast?.(`Processing ${count} PDF downloads`, 'info');
  };

  const batchWhatsAppReminders = async () => {
    const selectedData = filteredInvoices.filter(inv => selectedInvoices.has(inv.id) && inv.status !== 'paid');
    if (selectedData.length === 0) {
      showToast?.("No unpaid invoices selected for reminders", 'info');
      return;
    }

    for (const invoice of selectedData) {
      handleWhatsAppReminder(invoice);
      // Small delay to help browser handle multiple window calls
      await new Promise(r => setTimeout(r, 600));
    }
    
    showToast?.(`Generated reminders for ${selectedData.length} clients`, 'success');
    setSelectedInvoices(new Set());
    setIsBatchMenuOpen(false);
  };

  const handlePreviewPDF = (invoice: any) => {
    const url = generateInvoicePDF({
      invoiceNumber: invoice.invoiceNumber,
      date: new Date(invoice.createdAt?.toDate?.() || Date.now()).toLocaleDateString(),
      dueDate: new Date(invoice.dueDate).toLocaleDateString(),
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail || 'client@example.com',
      items: invoice.items || [],
      subtotal: invoice.subtotal || 0,
      tax: invoice.tax || 0,
      discount: invoice.discount || 0,
      total: invoice.total || 0,
      currency: invoice.currency || 'USD',
      businessName: userSettings?.businessName,
      businessEmail: userSettings?.businessEmail,
      logoUrl: userSettings?.logoUrl,
      terms: userSettings?.terms,
      bankDetails: userSettings?.bankDetails
    }, 'preview');
    
    if (url) {
      setPdfPreviewUrl(url as any as string);
    }
  };

  const getPublicUrl = (invoice: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/p/${auth.currentUser?.uid}/${invoice.id}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Public link copied to clipboard!");
  };

  const handleUpdatePaymentMethod = async (method: string) => {
    if (!selectedInvoice || !auth.currentUser) return;
    setIsUpdatingInvoice(true);
    try {
      await dbService.updateInvoice(auth.currentUser.uid, selectedInvoice.id, { paymentMethod: method });
      setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? { ...inv, paymentMethod: method } : inv));
      setSelectedInvoice({ ...selectedInvoice, paymentMethod: method });
    } catch (e) {
      console.error(e);
      showToast?.("Failed to update payment method", 'error');
    } finally {
      setIsUpdatingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search invoices, clients..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-900 dark:text-white shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {statuses.map(status => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                statusFilter === status.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none"
                  : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-900 hover:text-blue-600 dark:hover:text-blue-400"
              )}
            >
              {status.label}
              {statusFilter === status.id && (
                <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-md text-[10px]">
                  {filteredInvoices.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions HUD */}
      <AnimatePresence>
        {selectedInvoices.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 100, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 100, x: '-50%' }}
            className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[45] w-[calc(100%-2rem)] max-w-2xl"
          >
            <div className="bg-gray-900 dark:bg-zinc-950 text-white rounded-2xl shadow-2xl p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 border border-gray-800 dark:border-zinc-800 backdrop-blur-md overflow-hidden">
              <div className="flex items-center gap-3 sm:gap-4 pl-2 shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-sm sm:text-base">
                  {selectedInvoices.size}
                </div>
                <div className="hidden xs:block">
                  <p className="text-[9px] sm:text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-widest font-black">Selection</p>
                  <p className="text-xs sm:text-sm font-bold">Active</p>
                </div>
              </div>
              
              <div className="relative flex-1 min-w-0" ref={batchMenuRef}>
                <button 
                  onClick={() => setIsBatchMenuOpen(!isBatchMenuOpen)}
                  disabled={isBatchProcessing}
                  className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 border border-white/10 truncate font-display"
                >
                  {isBatchProcessing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                  <span className="truncate">Batch Actions</span>
                  <ChevronDown className={cn("transition-transform duration-200 shrink-0", isBatchMenuOpen ? "rotate-180" : "")} size={16} />
                </button>

                <AnimatePresence>
                  {isBatchMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute bottom-full mb-4 left-0 right-0 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden py-2 z-50 shadow-blue-500/10"
                    >
                      <button
                        onClick={batchMarkAsPaid}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                      >
                        <CheckCircle2 size={18} />
                        Mark as Paid
                      </button>
                      <button
                        onClick={batchDownloadPDFs}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Download size={18} />
                        Download PDFs
                      </button>
                      <button
                        onClick={batchWhatsAppReminders}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                      >
                        <MessageSquare size={18} />
                        Send WhatsApp Reminders
                      </button>
                      <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
                      <button
                        onClick={batchDeleteInvoices}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={18} />
                        Delete Selected
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setSelectedInvoices(new Set())}
                className="p-3 text-gray-400 hover:text-white transition-colors shrink-0"
                title="Deselect All"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-transparent md:bg-transparent md:border-none border border-gray-200 dark:border-zinc-800 rounded-xl md:rounded-none shadow-sm md:shadow-none overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm">
            <div className="text-gray-400 dark:text-zinc-500 mb-2 font-bold uppercase tracking-widest text-xs">No matching invoices</div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800">
                    <th className="px-6 py-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-800 cursor-pointer"
                        checked={selectedInvoices.size > 0 && selectedInvoices.size === filteredInvoices.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4">
                      <button 
                        onClick={() => requestSort('invoiceNumber')}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Invoice
                        {sortConfig?.key === 'invoiceNumber' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : <ArrowUpDown size={14} className="opacity-30" />}
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <button 
                        onClick={() => requestSort('clientName')}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Client
                        {sortConfig?.key === 'clientName' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : <ArrowUpDown size={14} className="opacity-30" />}
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <button 
                        onClick={() => requestSort('createdAt')}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Date
                        {sortConfig?.key === 'createdAt' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : <ArrowUpDown size={14} className="opacity-30" />}
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <button 
                        onClick={() => requestSort('total')}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Amount
                        {sortConfig?.key === 'total' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : <ArrowUpDown size={14} className="opacity-30" />}
                      </button>
                    </th>
                    <th className="px-6 py-4">
                      <button 
                        onClick={() => requestSort('status')}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Status
                        {sortConfig?.key === 'status' ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : <ArrowUpDown size={14} className="opacity-30" />}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                  {filteredInvoices.map((invoice) => (
                    <tr 
                      key={invoice.id} 
                      onClick={() => setSelectedInvoice(invoice)}
                      className={cn(
                        "transition-colors cursor-pointer group",
                        selectedInvoices.has(invoice.id) ? "bg-blue-50/50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                      )}
                    >
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-800 cursor-pointer"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={(e) => handleSelectInvoice(invoice.id, e as any)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{invoice.invoiceNumber}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-zinc-300">{invoice.clientName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                        {getCurrencySymbol(invoice.currency || 'USD')}{invoice.total?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <AnimatePresence mode="wait">
                          <motion.span 
                            key={invoice.status}
                            layout
                            initial={{ opacity: 0, scale: 0.8, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -5 }}
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase transition-colors whitespace-nowrap ${getStatusStyle(invoice.status)}`}
                          >
                            {invoice.status}
                          </motion.span>
                        </AnimatePresence>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleWhatsAppReminder(invoice);
                             }}
                             className={cn(
                               "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all",
                               invoice.status === 'overdue' 
                                 ? "bg-green-600 text-white shadow-lg shadow-green-100 dark:shadow-none hover:bg-green-700 active:scale-95" 
                                 : "text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-800/40 hover:text-green-600"
                             )}
                             title="Send WhatsApp Reminder"
                           >
                             <MessageSquare size={14} />
                             <span>Remind</span>
                           </button>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setSharingInvoice(invoice);
                             }}
                             className="p-1.5 text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors"
                             title="Share Public Link & QR Code"
                           >
                             <Share2 size={16} />
                           </button>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleDownload(invoice);
                             }}
                             className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800"
                             title="Download PDF"
                           >
                             <Download size={16} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-5">
              {filteredInvoices.map((invoice) => (
                <div 
                  key={invoice.id}
                  onClick={() => setSelectedInvoice(invoice)}
                  className={cn(
                    "bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border transition-all active:scale-[0.98] relative",
                    selectedInvoices.has(invoice.id) ? "border-blue-500 bg-blue-50/20 dark:bg-zinc-900 ring-2 ring-blue-500/20 shadow-blue-100 dark:shadow-none" : "border-gray-100 dark:border-zinc-800 shadow-sm"
                  )}
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4">
                      <div onClick={(e) => e.stopPropagation()} className="pt-0.5 relative z-10 transition-transform active:scale-125">
                        <input 
                          type="checkbox" 
                          className="w-6 h-6 rounded-lg border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-800 cursor-pointer shadow-sm"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={(e) => handleSelectInvoice(invoice.id, e as any)}
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-gray-900 dark:text-white tracking-tight italic flex items-center gap-2">
                          #{invoice.invoiceNumber.split('-')[1] || invoice.invoiceNumber}
                          <span className="w-1 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full" />
                          <span className="text-gray-400 dark:text-zinc-500 truncate text-xs not-italic">{invoice.clientName}</span>
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Sent {format(invoice.createdAt?.toDate?.() || new Date(), 'MMM d')}</p>
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm border",
                      invoice.status === 'paid' ? "bg-green-500 text-white border-green-600" :
                      invoice.status === 'sent' ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" :
                      invoice.status === 'overdue' ? "bg-red-500 text-white border-red-600" :
                      "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700"
                    )}>
                      {invoice.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-end bg-gray-50 dark:bg-zinc-950/50 -mx-5 px-5 py-4 mb-5">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 leading-none">Total Receivable</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter italic">
                        {getCurrencySymbol(invoice.currency || 'USD')}{invoice.total?.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 leading-none">Due By</p>
                      <p className="text-xs font-black text-gray-700 dark:text-zinc-300">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         handleWhatsAppReminder(invoice);
                       }}
                       className="flex flex-col items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-800 text-green-600 dark:text-green-400 rounded-2xl transition-all active:scale-95 border border-gray-100 dark:border-zinc-700 shadow-sm"
                    >
                      <MessageSquare size={18} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Remind</span>
                    </button>
                    <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         setSharingInvoice(invoice);
                       }}
                       className="flex flex-col items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 rounded-2xl transition-all active:scale-95 border border-gray-100 dark:border-zinc-700 shadow-sm"
                    >
                      <Share2 size={18} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Portal</span>
                    </button>
                    <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDownload(invoice);
                       }}
                       className="flex flex-col items-center justify-center gap-2 py-3 bg-gray-900 dark:bg-zinc-700 text-white rounded-2xl transition-all active:scale-95 shadow-lg shadow-gray-200 dark:shadow-none"
                    >
                      <Download size={18} />
                      <span className="text-[9px] font-black uppercase tracking-widest">PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {sharingInvoice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                    <Share2 size={20} />
                  </div>
                  <button 
                    onClick={() => setSharingInvoice(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-400 dark:text-zinc-500"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share Invoice</h3>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Clients can scan to view instantly</p>
                </div>

                <div className="bg-gray-50 dark:bg-white p-6 rounded-3xl inline-block border border-gray-100 dark:border-zinc-800">
                  <QRCodeSVG 
                    value={getPublicUrl(sharingInvoice)} 
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700">
                    <LinkIcon size={16} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                    <p className="text-[10px] font-mono text-gray-500 dark:text-zinc-400 truncate text-left flex-1">
                      {getPublicUrl(sharingInvoice)}
                    </p>
                    <button 
                      onClick={() => copyToClipboard(getPublicUrl(sharingInvoice))}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                      title="Copy Link"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => window.open(getPublicUrl(sharingInvoice), '_blank')}
                    className="w-full py-4 bg-gray-900 dark:bg-blue-600 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl"
                  >
                    <ExternalLink size={18} />
                    Open Public View
                  </button>
                </div>
              </div>
              
              <div className="bg-blue-600 p-4 text-center">
                <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">
                  Secure Client Portal • Invoice No. {sharingInvoice.invoiceNumber}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Preview Side Panel */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-500/30 dark:bg-black/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setSelectedInvoice(null)} 
            />
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white dark:bg-zinc-950 shadow-2xl transition-all"
            >
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-blue-400 rounded-lg">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">Invoice Preview</h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-500">{selectedInvoice.invoiceNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleDownload(selectedInvoice)}
                      className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Download PDF"
                    >
                      <Download size={20} />
                    </button>
                    <button 
                      onClick={() => setSelectedInvoice(null)}
                      className="p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Branding & Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      {userSettings?.logoUrl && (
                        <img 
                          src={userSettings.logoUrl} 
                          alt="Logo" 
                          className="w-16 h-16 rounded-xl object-contain bg-gray-50 dark:bg-zinc-800 p-2"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">
                          {userSettings?.businessName || 'InvoiceFlow AI'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{auth.currentUser?.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <AnimatePresence mode="wait">
                        <motion.span 
                          key={selectedInvoice.status}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 600, 
                            damping: 35,
                            layout: { duration: 0.2 }
                          }}
                          className={cn(
                            "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap",
                            getStatusStyle(selectedInvoice.status)
                          )}
                        >
                          {selectedInvoice.status}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-100 dark:border-zinc-800">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Bill To</p>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">{selectedInvoice.clientName}</h4>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">{selectedInvoice.clientEmail || 'No email provided'}</p>
                    </div>
                    <div className="text-right">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Date Issued</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {new Date(selectedInvoice.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="space-y-1 mt-4">
                        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Due Date</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-gray-100 dark:border-zinc-800">
                    <label className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3 block">Payment Method</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select 
                        className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none dark:text-white appearance-none"
                        value={paymentMethods.includes(selectedInvoice.paymentMethod || '') ? selectedInvoice.paymentMethod : (selectedInvoice.paymentMethod ? 'custom' : '')}
                        disabled={isUpdatingInvoice}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setIsCustomPayment(true);
                          } else {
                            setIsCustomPayment(false);
                            handleUpdatePaymentMethod(e.target.value);
                          }
                        }}
                      >
                        <option value="">No Payment Method Set</option>
                        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                        <option value="custom">Other / Custom...</option>
                      </select>
                      
                      {(isCustomPayment || (selectedInvoice.paymentMethod && !paymentMethods.includes(selectedInvoice.paymentMethod))) && (
                        <div className="flex-1 flex gap-2">
                          <input 
                            type="text"
                            className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none dark:text-white"
                            placeholder="Custom method name"
                            defaultValue={selectedInvoice.paymentMethod}
                            onBlur={(e) => handleUpdatePaymentMethod(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdatePaymentMethod((e.target as any).value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="mt-8">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-100 dark:border-zinc-800 text-left">
                          <th className="py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Description</th>
                          <th className="py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-center">Qty</th>
                          <th className="py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-right">Price</th>
                          <th className="py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-right">Tax</th>
                          <th className="py-4 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                        {(selectedInvoice.items || []).map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-4">
                              <p className="font-bold text-gray-900 dark:text-white">{item.description}</p>
                            </td>
                            <td className="py-4 text-center font-medium text-gray-600 dark:text-zinc-400">{item.quantity}</td>
                            <td className="py-4 text-right font-medium text-gray-600 dark:text-zinc-400">
                              {getCurrencySymbol(selectedInvoice.currency || 'USD')}{item.rate?.toLocaleString()}
                            </td>
                            <td className="py-4 text-right text-xs font-bold text-gray-400 dark:text-zinc-500">
                              {item.taxRate !== undefined ? item.taxRate : '5'}%
                            </td>
                            <td className="py-4 text-right font-bold text-gray-900 dark:text-white">
                              {getCurrencySymbol(selectedInvoice.currency || 'USD')}{item.amount?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="border-t-2 border-gray-100 dark:border-zinc-800 pt-6 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-400 dark:text-zinc-500">Subtotal</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {getCurrencySymbol(selectedInvoice.currency || 'USD')}{selectedInvoice.subtotal?.toLocaleString()}
                      </span>
                    </div>
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between text-sm text-red-500">
                        <span className="font-medium">Discount</span>
                        <span className="font-bold">
                          -{getCurrencySymbol(selectedInvoice.currency || 'USD')}{selectedInvoice.discount?.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-400 dark:text-zinc-500">Tax</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {getCurrencySymbol(selectedInvoice.currency || 'USD')}{selectedInvoice.tax?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-zinc-800">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">Total Amount</span>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                        {getCurrencySymbol(selectedInvoice.currency || 'USD')}{selectedInvoice.total?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Terms */}
                  {userSettings?.terms && (
                    <div className="mt-8 pt-8 border-t border-gray-50 dark:border-zinc-800">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Terms & Conditions</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed font-serif italic">
                        {userSettings.terms}
                      </p>
                    </div>
                  )}

                  {/* Payment Instructions */}
                  {userSettings?.bankDetails?.bankName && (
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3">Payment Instructions</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase">Bank</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.bankName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase">Account Name</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.accountName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase">Account Number</p>
                          <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.accountNumber}</p>
                        </div>
                        {userSettings.bankDetails.iban && (
                          <div>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase">IBAN</p>
                            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.iban}</p>
                          </div>
                        )}
                        {userSettings.bankDetails.swiftCode && (
                          <div>
                            <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase">SWIFT/BIC</p>
                            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.swiftCode}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedInvoice.notes && (
                    <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-4">
                      <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Notes</p>
                      <p className="text-sm text-gray-600 dark:text-zinc-400 italic">"{selectedInvoice.notes}"</p>
                    </div>
                  )}
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex flex-col gap-3">
                  {selectedInvoice.status !== 'paid' && (
                    <button 
                      onClick={() => {
                        if (userSettings?.customPaymentLink) {
                          window.open(userSettings.customPaymentLink, '_blank');
                        } else {
                          alert("Please configure your custom payment link in Settings > Generic Payments to enable the Pay Now button.");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:from-blue-700 hover:to-indigo-800 transition-all shadow-xl active:scale-[0.98] group"
                    >
                      <DollarSign size={20} className="group-hover:scale-110 transition-transform" />
                      Pay Now
                    </button>
                  )}
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleDownload(selectedInvoice)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700 transition active:scale-95 shadow-sm"
                    >
                      <Download size={18} />
                      Download PDF
                    </button>
                    <button 
                      onClick={() => handleWhatsAppReminder(selectedInvoice)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-zinc-800 border border-green-200 dark:border-green-900 text-green-600 dark:text-green-400 font-bold rounded-xl hover:bg-green-50 dark:hover:bg-zinc-700 transition active:scale-95 shadow-sm"
                    >
                      <MessageSquare size={18} />
                      Reminder
                    </button>
                  </div>
                  <button 
                    onClick={() => handlePreviewPDF(selectedInvoice)}
                    className="w-full py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                  >
                    <Eye size={18} />
                    Preview Actual PDF
                  </button>
                  <button 
                    onClick={() => setSelectedInvoice(null)}
                    className="w-full py-3 text-gray-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-gray-600 dark:hover:text-zinc-300 transition"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Actual PDF Viewer Modal */}
      <AnimatePresence>
        {pdfPreviewUrl && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-lg">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white leading-none">PDF Document Preview</h3>
                    <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Official Document View</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                       const link = document.createElement('a');
                       link.href = pdfPreviewUrl;
                       link.download = `Invoice_Preview_${Date.now()}.pdf`;
                       link.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                  >
                    <Download size={14} />
                    Download
                  </button>
                  <button 
                    onClick={() => setPdfPreviewUrl(null)} 
                    className="p-2 text-gray-400 dark:text-zinc-500 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-800">
                 <iframe 
                   src={pdfPreviewUrl} 
                   className="w-full h-full border-none"
                   title="PDF Preview"
                 />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


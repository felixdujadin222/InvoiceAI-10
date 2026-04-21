import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { Loader2, FileText, Download, CheckCircle2, AlertTriangle, ShieldCheck, CreditCard, Landmark, PenTool, X } from 'lucide-react';

// Simplified Signature Pad inside the component
const SignaturePad = ({ onSave }: { onSave: (data: string) => void }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="space-y-2">
      <div className="relative bg-gray-50 dark:bg-zinc-800 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl h-32 overflow-hidden">
        <canvas 
          ref={canvasRef}
          width={400}
          height={128}
          className="w-full h-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button 
          onClick={clear}
          className="absolute top-2 right-2 p-1.5 bg-white dark:bg-zinc-900 shadow-sm border border-gray-100 dark:border-zinc-800 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center font-bold uppercase tracking-widest">Draw your signature above to approve</p>
    </div>
  );
};
import { generateInvoicePDF } from '../services/pdfService';

export default function PublicInvoice() {
  const { userId, invoiceId } = useParams<{ userId: string; invoiceId: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!userId || !invoiceId) return;
      try {
        const [invoiceData, settingsData] = await Promise.all([
          dbService.getPublicInvoice(userId, invoiceId),
          dbService.getUserSettings(userId)
        ]);

        if (invoiceData) {
          setInvoice(invoiceData);
          setUserSettings(settingsData);
        } else {
          setError("Invoice not found.");
        }
      } catch (err) {
        console.error("Public fetch failed", err);
        setError("Failed to load invoice. It might be private or deleted.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [userId, invoiceId]);

  const handlePayment = async () => {
    if (!userId || !invoiceId) return;
    setIsPaying(true);
    try {
      // Simulate payment network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await dbService.updateInvoiceStatus(userId, invoiceId, 'paid');
      setInvoice((prev: any) => ({ ...prev, status: 'paid' }));
      setPaymentSuccess(true);
    } catch (err) {
      console.error("Payment update failed", err);
      alert("Simulation failed: Check your permissions or connection.");
    } finally {
      setIsPaying(false);
    }
  };

  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'NGN': '₦', 'KES': 'KSh' };
    return symbols[code] || '$';
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleDownload = () => {
    if (!invoice) return;
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
      businessEmail: userSettings?.businessEmail,
      logoUrl: userSettings?.logoUrl,
      terms: userSettings?.terms,
      bankDetails: userSettings?.bankDetails
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 transition-colors duration-500">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" size={40} />
          <p className="text-gray-500 dark:text-zinc-400 font-medium">Securing connection to invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6 transition-colors duration-500">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl dark:shadow-none p-8 text-center border border-gray-100 dark:border-zinc-800">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500 dark:text-zinc-400 mb-8">{error || "This invoice is no longer available."}</p>
          <a href="/" className="inline-block px-8 py-3 bg-gray-900 dark:bg-zinc-800 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-zinc-700 transition-all">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950 py-12 px-4 transition-colors duration-500">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Branding */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200 dark:shadow-none">I</div>
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">InvoiceFlow AI</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest bg-white dark:bg-zinc-900 px-4 py-2 rounded-full border border-gray-100 dark:border-zinc-800">
            <ShieldCheck size={14} className="text-green-500" />
            Verified Secure Portal
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl shadow-blue-100/50 dark:shadow-none border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {/* Main Content (Similar to preview) */}
          <div className="p-8 md:p-12 space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-start gap-8">
              <div className="space-y-4">
                {userSettings?.logoUrl && (
                  <img 
                    src={userSettings.logoUrl} 
                    alt="Logo" 
                    className="h-16 w-auto object-contain bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic leading-none">
                    {userSettings?.businessName || 'InvoiceFlow AI'}
                  </h1>
                  <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm mt-2">{userSettings?.businessEmail}</p>
                  <p className="text-gray-400 dark:text-zinc-500 text-xs mt-1">{userSettings?.businessAddress}</p>
                </div>
              </div>
              <div className="text-right space-y-2">
                <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${getStatusStyle(invoice.status)}`}>
                  {invoice.status}
                </span>
                <p className="text-sm font-bold text-gray-400 dark:text-zinc-500 block pt-2">Invoice No.</p>
                <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{invoice.invoiceNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-12 border-t border-gray-100 dark:border-zinc-800">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Bill To</p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{invoice.clientName}</h4>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 font-medium italic">{invoice.clientEmail}</p>
              </div>
              <div className="text-right grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Date Issued</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-zinc-300">{new Date(invoice.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Due Date</p>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-50 dark:border-zinc-800 text-left">
                    <th className="py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Description</th>
                    <th className="py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-center w-16">Qty</th>
                    <th className="py-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {invoice.items.map((item: any, i: number) => (
                    <tr key={i} className="group">
                      <td className="py-6">
                        <p className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.description}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 font-medium">Rate: {getCurrencySymbol(invoice.currency)}{item.rate.toLocaleString()}</p>
                      </td>
                      <td className="py-6 text-center font-bold text-gray-600 dark:text-zinc-400">{item.quantity}</td>
                      <td className="py-6 text-right font-black text-gray-900 dark:text-white text-lg">
                        {getCurrencySymbol(invoice.currency)}{item.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="flex flex-col md:flex-row gap-12 pt-8 border-t border-gray-100 dark:border-zinc-800">
              <div className="flex-1 space-y-6">
                {/* Payment Instructions Inline */}
                {userSettings?.bankDetails?.bankName && (
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl p-6 border border-blue-100 dark:border-blue-900/20 relative overflow-hidden">
                    <Landmark className="absolute -right-4 -bottom-4 text-blue-100 dark:text-blue-900/20 w-24 h-24 rotate-12" />
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <CreditCard size={14} />
                       Secure Payment Instructions
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                      <div>
                        <p className="text-[10px] text-blue-400 dark:text-blue-500 font-bold uppercase mb-1">Bank Name</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.bankName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-blue-400 dark:text-blue-500 font-bold uppercase mb-1">Beneficiary</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.accountName}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[10px] text-blue-400 dark:text-blue-500 font-bold uppercase mb-1">Account Number / IBAN</p>
                        <p className="text-sm font-mono font-bold text-gray-900 dark:text-white break-all">
                          {userSettings.bankDetails.iban || userSettings.bankDetails.accountNumber}
                        </p>
                      </div>
                      {userSettings.bankDetails.swiftCode && (
                        <div>
                          <p className="text-[10px] text-blue-400 dark:text-blue-500 font-bold uppercase mb-1">SWIFT / BIC</p>
                          <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{userSettings.bankDetails.swiftCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {invoice.notes && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Note from Sender</p>
                    <p className="text-sm text-gray-600 dark:text-zinc-300 font-medium italic border-l-4 border-gray-100 dark:border-zinc-800 pl-4 py-1">"{invoice.notes}"</p>
                  </div>
                )}
              </div>

              <div className="w-full md:w-80 space-y-3 bg-gray-50 dark:bg-zinc-800/50 rounded-3xl p-8">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-[10px]">Subtotal</span>
                  <span className="font-bold text-gray-900 dark:text-white">{getCurrencySymbol(invoice.currency)}{invoice.subtotal.toLocaleString()}</span>
                </div>
                {invoice.paymentMethod && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-[10px]">Payment Method</span>
                    <span className="font-bold text-gray-900 dark:text-white">{invoice.paymentMethod}</span>
                  </div>
                )}
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-500 dark:text-red-400">
                    <span className="font-bold uppercase tracking-widest text-[10px]">Discount</span>
                    <span className="font-bold">-{getCurrencySymbol(invoice.currency)}{invoice.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-b border-gray-200 dark:border-zinc-700 pb-3">
                  <span className="font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-[10px]">Tax</span>
                  <span className="font-bold text-gray-900 dark:text-white">{getCurrencySymbol(invoice.currency)}{invoice.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xl font-black text-gray-900 dark:text-white">TOTAL</span>
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                    {getCurrencySymbol(invoice.currency)}{invoice.total.toLocaleString()}
                  </span>
                </div>
                
                {invoice.status !== 'paid' && (
                  <div className="pt-6 border-t border-gray-200 dark:border-zinc-700">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Approval</p>
                    <SignaturePad onSave={(data) => console.log("Signature saved", data)} />
                  </div>
                )}
                
                <button 
                  onClick={handleDownload}
                  className="w-full mt-8 flex items-center justify-center gap-3 py-4 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-700 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
                >
                  <Download size={20} />
                  Download PDF
                </button>

                {invoice.status !== 'paid' && (
                  <button 
                    onClick={handlePayment}
                    disabled={isPaying}
                    className="w-full mt-3 flex items-center justify-center gap-3 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 disabled:opacity-50"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard size={20} />
                        Pay Now ({getCurrencySymbol(invoice.currency)}{invoice.total.toLocaleString()})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer Terms */}
          {userSettings?.terms && (
            <div className="px-8 py-6 bg-gray-900 dark:bg-zinc-800 text-white flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-400" />
                <p className="text-xs font-bold leading-relaxed max-w-lg">
                  Terms: {userSettings.terms}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Securely processed by InvoiceFlow AI</p>
            </div>
          )}
        </div>
        
        <p className="text-center text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-[0.2em] pt-4">
          This is a verified secure payment request. 
        </p>
      </div>

      {/* Payment Success Overlay */}
      {paymentSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl dark:shadow-none animate-in zoom-in-95 duration-500 border border-gray-100 dark:border-zinc-800">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-900/10 text-green-500 dark:text-green-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase italic tracking-tight">Payment Complete!</h3>
            <p className="text-gray-500 dark:text-zinc-400 font-medium leading-relaxed mb-8">
              Thank you for your payment. Your receipt has been generated and the invoice status updated.
            </p>
            <button 
              onClick={() => setPaymentSuccess(false)}
              className="w-full py-4 bg-gray-900 dark:bg-blue-600 text-white font-bold rounded-2xl hover:bg-black dark:hover:bg-blue-700 transition-all active:scale-95"
            >
              Continue to Portal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

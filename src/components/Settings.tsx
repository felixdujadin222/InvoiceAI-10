import React, { useState, useEffect } from 'react';
import { CreditCard, Bell, Save, MessageSquare, Shield, Loader2, Smartphone, ExternalLink } from 'lucide-react';
import { dbService } from '../services/dbService';
import { cn } from '../lib/utils';

export default function Settings({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('business');
  const [settings, setSettings] = useState({
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    stripeKey: '',
    paystackKey: '',
    flutterwaveKey: '',
    paypalClientId: '',
    paypalSecret: '',
    bankDetails: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      swiftCode: '',
      iban: ''
    },
    cryptoWallets: {
      btc: '',
      eth: '',
      sol: ''
    },
    customPaymentLink: '',
    logoUrl: '',
    currency: 'USD',
    defaultTaxRate: 5,
    terms: 'Please pay within 14 days of receiving this invoice.',
    defaultPaymentMethod: 'Bank Transfer',
    autoReminders: {
      enabled: false,
      upcomingDays: 3,
      overdueIntervals: [3, 7, 14]
    }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await dbService.getUserSettings(userId);
        if (data) {
          setSettings(prev => ({
            ...prev,
            ...data,
            bankDetails: { ...prev.bankDetails, ...(data.bankDetails || {}) },
            cryptoWallets: { ...prev.cryptoWallets, ...(data.cryptoWallets || {}) },
            reminderIntervals: data.reminderIntervals || [3, 7, 14]
          }));
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dbService.updateUserSettings(userId, settings);
      alert("Settings saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const tabs = [
    { id: 'business', label: 'Business Profile', icon: Shield },
    { id: 'payments', label: 'Payment Gateways', icon: CreditCard },
    { id: 'reminders', label: 'Automated Reminders', icon: Bell },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Account Settings</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Manage your business profile and preferences.</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100/50 dark:bg-zinc-900 rounded-2xl overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-800/50"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {activeTab === 'business' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="dashboard-card">
              <div className="flex items-center gap-2 mb-6 text-blue-600 dark:text-blue-400">
                <Shield size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Business Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Owner Display Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.displayName || ''}
                    onChange={e => setSettings({...settings, displayName: e.target.value})}
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Business Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.businessName}
                    onChange={e => setSettings({...settings, businessName: e.target.value})}
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Business Email</label>
                  <input 
                    type="email"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.businessEmail}
                    onChange={e => setSettings({...settings, businessEmail: e.target.value})}
                    placeholder="contact@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Business Phone</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.businessPhone}
                    onChange={e => setSettings({...settings, businessPhone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Business Address</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.businessAddress}
                    onChange={e => setSettings({...settings, businessAddress: e.target.value})}
                    placeholder="123 Business St, City"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Business Logo URL</label>
                  <input 
                    type="url"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.logoUrl}
                    onChange={e => setSettings({...settings, logoUrl: e.target.value})}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Default Currency</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.currency}
                    onChange={e => setSettings({...settings, currency: e.target.value})}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="NGN">NGN (₦)</option>
                    <option value="KES">KES (KSh)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Default Tax Rate (%)</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.defaultTaxRate}
                    onChange={e => setSettings({...settings, defaultTaxRate: Number(e.target.value)})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Standard Payment Terms</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm resize-none bg-white dark:bg-zinc-950 dark:text-white"
                    rows={2}
                    value={settings.terms}
                    onChange={e => setSettings({...settings, terms: e.target.value})}
                    placeholder="e.g. Please pay within 15 days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Default Payment Method</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all shadow-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.defaultPaymentMethod}
                    onChange={e => setSettings({...settings, defaultPaymentMethod: e.target.value})}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Stripe">Stripe</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Crypto">Crypto</option>
                  </select>
                </div>
              </div>
            </div>

            {/* WhatsApp Reminder Info */}
            <div className="dashboard-card bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900 flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-green-900 dark:text-green-100">WhatsApp Reminders Active</h4>
                <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed font-medium">
                  Manual WhatsApp reminders are now active for all your invoices. 
                  You can trigger them directly from the <span className="underline font-bold">Invoices</span> list or the invoice details panel. 
                  No configuration required!
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="dashboard-card">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Bell size={20} />
                  <h3 className="font-bold text-gray-900 dark:text-white">Automation Preferences</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Master Switch</span>
                  <button 
                    type="button"
                    onClick={() => setSettings({
                      ...settings, 
                      autoReminders: { ...settings.autoReminders, enabled: !settings.autoReminders.enabled }
                    })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      settings.autoReminders.enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-zinc-800"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      settings.autoReminders.enabled ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className={cn("space-y-8 transition-all", !settings.autoReminders.enabled && "opacity-40 pointer-events-none")}>
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
                   <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                      <Smartphone size={20} />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">In-App & Email Flow</h4>
                      <p className="text-xs text-blue-700/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                        When active, InvoiceFlow will automatically notify your clients based on the schedule below. 
                        Reminders are sent via your verified business email address.
                      </p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">Upcoming Reminder</label>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 font-medium">Send a nudge before the actual due date</p>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-xl font-bold text-sm dark:text-white"
                      value={settings.autoReminders.upcomingDays}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoReminders: { ...settings.autoReminders, upcomingDays: Number(e.target.value) }
                      })}
                    >
                      <option value="1">1 Day Before</option>
                      <option value="3">3 Days Before</option>
                      <option value="7">1 Week Before</option>
                      <option value="0">Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">Overdue Cadence</label>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 font-medium">How often to follow up when late</p>
                    <div className="flex flex-wrap gap-2">
                       {[3, 7, 14, 30].map(days => (
                         <button
                           key={days}
                           type="button"
                           onClick={() => {
                             const current = settings.autoReminders.overdueIntervals;
                             const next = current.includes(days) 
                               ? current.filter(d => d !== days)
                               : [...current, days].sort((a, b) => a - b);
                             setSettings({
                               ...settings,
                               autoReminders: { ...settings.autoReminders, overdueIntervals: next }
                             });
                           }}
                           className={cn(
                             "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                             settings.autoReminders.overdueIntervals.includes(days)
                               ? "bg-blue-600 border-blue-600 text-white"
                               : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 text-gray-400 dark:text-zinc-500 hover:border-blue-200 dark:hover:border-blue-900"
                           )}
                         >
                           {days} Days Late
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="dashboard-card bg-amber-50/30 dark:bg-amber-900/10 border-amber-100/50 dark:border-amber-900/30">
               <div className="flex gap-4">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">GDPR & Compliance</h4>
                    <p className="text-xs text-amber-700/70 dark:text-amber-400 leading-relaxed max-w-xl">
                      Automated reminders will only be sent to clients who have opted-in to receive billing communications. 
                      You can disable reminders for specific invoices in the individual invoice settings.
                    </p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Payment Gateways */}
            <div className="dashboard-card">
              <div className="flex items-center gap-2 mb-6 text-blue-600 dark:text-blue-400">
                <CreditCard size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Payment Gateways</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Stripe Secret Key</label>
                  <input 
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.stripeKey}
                    onChange={e => setSettings({...settings, stripeKey: e.target.value})}
                    placeholder="sk_live_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Paystack Secret Key</label>
                  <input 
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.paystackKey}
                    onChange={e => setSettings({...settings, paystackKey: e.target.value})}
                    placeholder="sk_live_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Flutterwave Secret Key</label>
                  <input 
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.flutterwaveKey}
                    onChange={e => setSettings({...settings, flutterwaveKey: e.target.value})}
                    placeholder="FLWSECK_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">PayPal Client ID</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.paypalClientId}
                    onChange={e => setSettings({...settings, paypalClientId: e.target.value})}
                    placeholder="Client ID"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">PayPal Client Secret</label>
                  <input 
                    type="password"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.paypalSecret}
                    onChange={e => setSettings({...settings, paypalSecret: e.target.value})}
                    placeholder="Client Secret"
                  />
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-400 dark:text-zinc-500">
                <Shield size={12} className="inline mr-1" />
                Your keys are stored securely and never exposed to the frontend.
              </p>
            </div>

            {/* Bank Transfer Details */}
            <div className="dashboard-card border-l-4 border-amber-500">
              <div className="flex items-center gap-2 mb-6 text-amber-600 dark:text-amber-400">
                <Smartphone size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Direct Bank Transfer</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Account Name (Beneficiary)</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500 transition-all bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.bankDetails.accountName}
                    onChange={e => setSettings({...settings, bankDetails: {...settings.bankDetails, accountName: e.target.value}})}
                    placeholder="Full Legal Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Bank Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500 transition-all bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.bankDetails.bankName}
                    onChange={e => setSettings({...settings, bankDetails: {...settings.bankDetails, bankName: e.target.value}})}
                    placeholder="Choice Bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Account Number</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500 transition-all font-mono bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.bankDetails.accountNumber}
                    onChange={e => setSettings({...settings, bankDetails: {...settings.bankDetails, accountNumber: e.target.value}})}
                    placeholder="Numbers only"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">IBAN</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500 transition-all font-mono bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.bankDetails.iban}
                    onChange={e => setSettings({...settings, bankDetails: {...settings.bankDetails, iban: e.target.value}})}
                    placeholder="International Bank Account Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">SWIFT / BIC Code</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500 transition-all font-mono bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.bankDetails.swiftCode}
                    onChange={e => setSettings({...settings, bankDetails: {...settings.bankDetails, swiftCode: e.target.value}})}
                    placeholder="SWIFT or BIC"
                  />
                </div>
              </div>
            </div>

            {/* Crypto Wallets */}
            <div className="dashboard-card border-l-4 border-indigo-500">
              <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400">
                <Shield size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Crypto Wallets</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    Bitcoin (BTC) Address
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.cryptoWallets.btc}
                    onChange={e => setSettings({...settings, cryptoWallets: {...settings.cryptoWallets, btc: e.target.value}})}
                    placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Ethereum (ETH / USDC / USDT) Address
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs bg-white dark:bg-zinc-950 dark:text-white"
                    value={settings.cryptoWallets.eth}
                    onChange={e => setSettings({...settings, cryptoWallets: {...settings.cryptoWallets, eth: e.target.value}})}
                    placeholder="0x71C7656EC7..."
                  />
                </div>
              </div>
            </div>

            {/* Custom Payment Link */}
            <div className="dashboard-card border-l-4 border-gray-400 dark:border-zinc-600">
              <div className="flex items-center gap-2 mb-6 text-gray-600 dark:text-zinc-400">
                <ExternalLink size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Custom Payment Link</h3>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">External Checkout URL</label>
                <input 
                  type="url"
                  className="w-full px-4 py-2 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-gray-500 transition-all font-mono bg-white dark:bg-zinc-950 dark:text-white"
                  value={settings.customPaymentLink}
                  onChange={e => setSettings({...settings, customPaymentLink: e.target.value})}
                  placeholder="https://buymeacoffee.com/name"
                />
              </div>
            </div>
          </div>
        )}


        {/* Action Bar */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-zinc-800">
          <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">Last synced: Just now</p>
          <button 
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-10 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-xl active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

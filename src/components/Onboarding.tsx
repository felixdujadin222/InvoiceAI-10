import React, { useState } from 'react';
import { dbService } from '../services/dbService';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  Coins, 
  ArrowRight, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Briefcase,
  Globe,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    currency: 'USD',
    taxRate: 0,
    address: '',
  });

  const [error, setError] = useState<string | null>(null);

  const totalSteps = 3;

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      setError("User session lost. Please refresh.");
      return;
    }
    setLoading(true);
    setError(null);
    console.log("Finalizing onboarding...", formData);
    try {
      await dbService.updateUserSettings(auth.currentUser.uid, {
        ...formData,
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      });
      console.log("Onboarding complete!");
      onComplete();
    } catch (err: any) {
      console.error("Onboarding submission failed:", err);
      setError(err.message || "Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    console.log(`Advancing from step ${step} to ${step + 1}`);
    if (step < totalSteps) {
      setStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isStepValid() && !loading) {
      nextStep();
    }
  };

  const isStepValid = () => {
    // Make Step 1 optional or very lenient to ensure nobody gets stuck
    if (step === 1) return formData.businessName.trim().length > 0;
    return true;
  };

  return (
    <div 
      className="fixed inset-0 z-[2000] bg-[#fafafa] dark:bg-zinc-950 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 overflow-y-auto pointer-events-auto transition-colors duration-500"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-[3rem] shadow-2xl shadow-blue-100/50 dark:shadow-none border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row min-h-[600px] relative transition-colors">
        {/* Skip for now button */}
        <button 
          onClick={onComplete}
          className="absolute top-6 right-6 z-50 text-[10px] font-black text-gray-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase tracking-widest bg-white/80 dark:bg-zinc-800/80 backdrop-blur px-3 py-1 rounded-full border border-gray-100 dark:border-zinc-800"
        >
          Skip for now
        </button>

        {/* Left Side: Form */}
        <div className="flex-1 p-8 sm:p-12 lg:p-16 flex flex-col bg-white dark:bg-zinc-900 rounded-[3rem]">
          <div className="flex-1 space-y-12">
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-gray-50 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <div className="w-14 h-14 bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
                      <Building2 size={28} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight font-display italic leading-none">Setup your business</h2>
                      <p className="text-gray-500 dark:text-zinc-400 font-medium text-lg leading-tight">What's the name of your brand? This will lead every invoice you send.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Legal Entity / Brand Name</label>
                    <input
                      type="text"
                      className="w-full px-8 py-5 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-3xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-xl text-gray-900 dark:text-white"
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. Acme Design Studio"
                      autoFocus
                    />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <div className="w-14 h-14 bg-purple-50 dark:bg-zinc-800 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-100 dark:shadow-none">
                      <Coins size={28} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight font-display italic leading-none">Financials</h2>
                      <p className="text-gray-500 dark:text-zinc-400 font-medium text-lg leading-tight">Set your default currency and tax. These can be adjusted per-invoice later.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Currency</label>
                      <select
                        className="w-full px-6 py-5 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-3xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-lg text-gray-900 dark:text-white appearance-none"
                        value={formData.currency}
                        onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="NGN">NGN (₦)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Default Tax (%)</label>
                      <input
                        type="number"
                        className="w-full px-6 py-5 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-3xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-lg text-gray-900 dark:text-white"
                        value={formData.taxRate}
                        onChange={(e) => setFormData({...formData, taxRate: parseFloat(e.target.value) || 0})}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <div className="w-14 h-14 bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 dark:shadow-none">
                      <MapPin size={28} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight font-display italic leading-none">Almost ready!</h2>
                      <p className="text-gray-500 dark:text-zinc-400 font-medium text-lg leading-tight">Where is your work based? This adds a professional touch to your header.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Business Address</label>
                    <textarea
                      className="w-full px-8 py-5 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-3xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-xl text-gray-900 dark:text-white resize-none"
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="e.g. 123 Tech Lane, San Francisco, CA"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-12">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[...Array(totalSteps)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      step === i + 1 ? "bg-blue-600 w-8" : "bg-gray-100 dark:bg-zinc-800"
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Button clicked!");
                  nextStep();
                }}
                disabled={loading || !isStepValid()}
                className={cn(
                  "px-10 py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-zinc-800 disabled:shadow-none relative z-[100]",
                  !isStepValid() && "opacity-50 grayscale cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {step === totalSteps ? 'Finalize Setup' : 'Continue'}
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold"
                >
                  <AlertCircle size={18} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Preview */}
        <div className="hidden md:flex md:w-[400px] lg:w-[480px] bg-gray-50 dark:bg-zinc-800/30 p-8 border-l border-gray-100 dark:border-zinc-800 flex flex-col relative overflow-hidden transition-colors">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-full text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-8">
                <Sparkles size={12} className="text-blue-600 dark:text-blue-400" />
                Live Brand Preview
              </div>

              {/* Mock Invoice Card */}
              <motion.div 
                layout
                className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl shadow-gray-200 dark:shadow-none border border-gray-100 dark:border-zinc-800 p-8 space-y-8"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-100">
                      {formData.businessName ? formData.businessName.charAt(0).toUpperCase() : 'I'}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight font-display break-words max-w-[200px]">
                        {formData.businessName || 'Your Brand Name'}
                      </h4>
                      <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                        Tax ID: 123-456-789
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Invoice</span>
                    <p className="text-xs font-bold text-gray-400 dark:text-zinc-500">#INV-2024-001</p>
                  </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-zinc-800" />

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">From</p>
                      <p className="text-xs font-bold text-gray-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line max-w-[150px]">
                        {formData.address || 'Your Business Address\nCity, Country'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Amount Due</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                        {formData.currency === 'USD' ? '$' : formData.currency === 'EUR' ? '€' : formData.currency === 'GBP' ? '£' : '₦'}
                        1,250.00
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-full bg-gray-50 dark:bg-zinc-800 rounded-full" />
                  <div className="h-2 w-2/3 bg-gray-50 dark:bg-zinc-800 rounded-full" />
                </div>
              </motion.div>
            </div>

            <div className="pt-8">
              <div className="p-6 bg-blue-600 rounded-[2rem] text-blue-50 space-y-2 shadow-xl shadow-blue-100">
                <blockquote className="text-sm font-bold leading-relaxed italic">
                  "This setup took me less than a minute. The AI handles the rest."
                </blockquote>
                <cite className="text-[10px] font-black uppercase tracking-widest opacity-60 not-italic">— Sarah, Freelance Designer</cite>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

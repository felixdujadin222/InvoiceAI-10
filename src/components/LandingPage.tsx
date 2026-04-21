import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, ArrowRight, FileText, CheckCircle, 
  Zap, Shield, Globe, Coins, ReceiptText
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-6 py-6 font-display">
        <div className="max-w-7xl mx-auto flex items-center justify-between bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800/50 px-6 py-4 rounded-3xl shadow-xl shadow-gray-100/50 dark:shadow-none">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">I</div>
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight italic uppercase">InvoiceFlow<span className="text-blue-600">AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-500">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
            <a href="#templates" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Templates</a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/auth"
              className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Login
            </Link>
            <Link
              to="/auth"
              className="px-6 py-3 bg-gray-900 dark:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black dark:hover:bg-zinc-600 transition-all shadow-xl hover:-translate-y-0.5 active:scale-95"
            >
              Join Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-40 lg:pt-56 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12 relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm"
              >
                <Sparkles size={14} className="animate-pulse" />
                The Future of Billing
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[80px] lg:text-[112px] font-black text-gray-900 dark:text-white leading-[0.85] tracking-[-0.04em] font-display uppercase italic"
              >
                Smart.<br/>
                Fast.<br/>
                <span className="text-blue-600 dark:text-blue-500">Paid.</span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl text-gray-500 dark:text-zinc-400 font-medium max-w-md leading-relaxed border-l-2 border-blue-600/20 pl-8"
              >
                Focus on your craft. We handle the math, compliance, and reminders. 
                The most intelligent invoicing platform for elite freelancers.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col sm:flex-row gap-6 pt-4"
              >
                <Link
                  to="/auth"
                  className="group px-10 py-6 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 dark:shadow-none hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-4"
                >
                  Get Started
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <div className="flex flex-col justify-center">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                        <img src={`https://picsum.photos/seed/user${i}/40/40`} alt="user" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-600 mt-2 ml-1">Trusted by 2,000+ teams</p>
                </div>
              </motion.div>
            </div>

            <div className="relative">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                className="bg-white dark:bg-zinc-900 p-2 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] dark:shadow-none border border-white dark:border-zinc-800 relative z-20"
              >
                <div className="bg-gray-900 dark:bg-black rounded-[3rem] p-12 lg:p-20 aspect-square flex flex-col items-center justify-center text-center space-y-10 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                  
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 360 }}
                    className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/50"
                  >
                    <ReceiptText size={48} />
                  </motion.div>
                  
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black text-white tracking-tight font-display uppercase italic">Gemini AI Engine</h3>
                    <p className="text-gray-400 dark:text-zinc-500 font-medium px-4">
                      Describe your work logs. Build professional invoices in seconds.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
                      AI-Powered
                    </div>
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-white uppercase tracking-widest">
                      Encrypted
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Feature Grid */}
      <section id="features" className="py-32 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Sparkles />, title: "AI-Drafting", desc: "Just talk. Describe your daily tasks and watch the invoice generate instantly.", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" },
              { icon: <Zap />, title: "Batch Actions", desc: "Download, send, or mark hundreds of invoices as paid in a single click.", color: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" },
              { icon: <Shield />, title: "Bank-Grade", desc: "Your financial data is protected by enterprise encryption and modern auth.", color: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" }
            ].map((feature, i) => (
              <div 
                key={i}
                className="p-10 bg-[#fafafa] dark:bg-zinc-900/50 rounded-[2.5rem] border border-transparent hover:border-gray-200 dark:hover:border-zinc-800 transition-all space-y-6"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm", feature.color)}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase italic">{feature.title}</h3>
                <p className="text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <h2 className="text-5xl lg:text-7xl font-black tracking-tighter font-display italic leading-tight uppercase">
            Paid faster. <br/> Built smarter.
          </h2>
          <Link
            to="/auth"
            className="inline-flex px-12 py-6 bg-white text-gray-900 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-50 transition-all shadow-2xl active:scale-95 gap-4 items-center"
          >
            Join the flow
            <ArrowRight size={18} />
          </Link>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-widest text-gray-500">
             <span>© 2024 InvoiceFlow AI</span>
             <div className="flex gap-8">
               <a href="#" className="hover:text-white transition-colors">Privacy</a>
               <a href="#" className="hover:text-white transition-colors">Terms</a>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

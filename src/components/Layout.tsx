import React, { useState } from 'react';
import { LayoutDashboard, ReceiptText, Users, Settings, LogOut, PlusCircle, Bell, Repeat, BarChart3, Receipt, Sun, Moon, FileSearch, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, user, onLogout }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const groupedNavItems = [
    {
      group: 'General',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ]
    },
    {
      group: 'Sales & Billing',
      items: [
        { id: 'quotes', label: 'Quotes', icon: FileSearch },
        { id: 'invoices', label: 'Invoices', icon: ReceiptText },
        { id: 'recurring', label: 'Recurring', icon: Repeat },
      ]
    },
    {
      group: 'Management',
      items: [
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'expenses', label: 'Expenses', icon: Receipt },
        { id: 'clients', label: 'Clients', icon: Users },
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    },
  ];

  const allNavItems = groupedNavItems.flatMap(g => g.items);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-950 overflow-hidden relative">
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex-col shrink-0">
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">I</div>
            <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white">InvoiceFlow<span className="text-blue-600">AI</span></span>
          </div>
          
          <nav className="space-y-8">
            {groupedNavItems.map((group) => (
              <div key={group.group} className="space-y-2">
                <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-600">
                  {group.group}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold rounded-xl transition-all",
                        activeTab === item.id
                          ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm"
                          : "text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-gray-100"
                      )}
                    >
                      <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xs font-bold">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">Free Plan</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
        <header className="h-20 bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-900 px-6 sm:px-8 flex items-center justify-between flex-shrink-0 z-30 transition-colors">
          <div className="flex items-center gap-4 lg:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-xl transition-colors"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className="w-6 h-0.5 bg-current rounded-full" />
                <span className="w-4 h-0.5 bg-current rounded-full" />
                <span className="w-6 h-0.5 bg-current rounded-full" />
              </div>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100 dark:shadow-none">I</div>
              <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight capitalize italic">
                {activeTab === 'dashboard' ? 'Overview' : activeTab}
              </h1>
            </div>
          </div>
          
          <h1 className="hidden lg:block text-2xl font-black text-gray-900 dark:text-white capitalize tracking-tighter italic">
            {activeTab === 'dashboard' ? 'Overview' : activeTab}
          </h1>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all active:scale-95"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="hidden sm:p-2.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900 transition-all active:scale-95">
              <Bell size={20} />
            </button>
            <button 
              onClick={() => setActiveTab('create-invoice')}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white text-xs sm:text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none active:scale-95"
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">New Invoice</span>
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 pb-32 lg:pb-10 scroll-smooth">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Sidebar Overlay (Drawer) */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[100] lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-950 shadow-2xl flex flex-col"
              >
                <div className="p-8 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl">I</div>
                    <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white uppercase italic">InvoiceFlow</span>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                  <nav className="space-y-10">
                    {groupedNavItems.map((group) => (
                      <div key={group.group} className="space-y-4">
                        <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 dark:text-zinc-600">
                          {group.group}
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id);
                                setIsMobileMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-4 px-4 py-3.5 text-sm font-black uppercase tracking-widest rounded-2xl transition-all",
                                activeTab === item.id
                                  ? "bg-blue-600 text-white shadow-xl shadow-blue-100 dark:shadow-none"
                                  : "text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-900"
                              )}
                            >
                              <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </nav>
                </div>

                <div className="p-8 border-t border-gray-100 dark:border-zinc-900">
                  <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-3 py-4 text-sm font-black uppercase tracking-[0.2em] text-red-500 bg-red-50 dark:bg-red-900/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Mobile Tab Bar - Redined Version */}
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 flex items-center justify-around lg:hidden z-40 px-4 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] transition-colors">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
            { id: 'invoices', icon: ReceiptText, label: 'Invoices' },
            { id: 'expenses', icon: Receipt, label: 'Wallet' },
            { id: 'clients', icon: Users, label: 'Clients' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-2xl transition-all active:scale-90",
                activeTab === item.id 
                  ? "text-blue-600 dark:text-blue-400" 
                  : "text-gray-400 dark:text-zinc-600"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                activeTab === item.id ? "bg-blue-50 dark:bg-blue-900/20 shadow-inner" : ""
              )}>
                <item.icon size={20} className={cn(activeTab === item.id ? "fill-blue-600/10 dark:fill-blue-400/10" : "")} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">{item.label}</span>
            </button>
          ))}
          <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 px-3 py-2 rounded-2xl transition-all active:scale-90 text-gray-400 dark:text-zinc-600"
              )}
            >
              <div className="p-1.5 rounded-xl group-active:bg-gray-100 transition-all">
                <div className="w-5 h-5 flex flex-col justify-between py-1 px-0.5">
                  <span className="w-full h-0.5 bg-current rounded-full" />
                  <span className="w-full h-0.5 bg-current rounded-full opacity-60" />
                  <span className="w-full h-0.5 bg-current rounded-full opacity-30" />
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">More</span>
            </button>
        </nav>
      </main>
    </div>
  );
}

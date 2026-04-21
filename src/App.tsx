/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { auth } from "./lib/firebase";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import InvoiceList from "./components/InvoiceList";
import AIInvoiceGenerator from "./components/AIInvoiceGenerator";
import RecurringInvoices from "./components/RecurringInvoices";
import RecurringInvoiceForm from "./components/RecurringInvoiceForm";
import ClientList from "./components/ClientList";
import Settings from "./components/Settings";
import Reports from "./components/Reports";
import Expenses from "./components/Expenses";
import Quotes from "./components/Quotes";
import Auth from "./components/Auth";
import Onboarding from "./components/Onboarding";
import { dbService } from "./services/dbService";
import { Loader2, Plus, UserPlus, Sparkles, LayoutDashboard, FileText, Users, Repeat, Settings as SettingsIcon, LogOut, CheckCircle, Info, AlertTriangle, X, BarChart3, Receipt, FileSearch, ArrowRight, Coins, Globe } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import PublicInvoice from "./components/PublicInvoice";

import LandingPage from './components/LandingPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setCheckingOnboarding(true);
        Promise.all([
          dbService.getInvoices(user.uid),
          dbService.getExpenses(user.uid),
          dbService.getUserSettings(user.uid)
        ]).then(([inv, exp, settings]) => {
          setInvoices(inv);
          setExpenses(exp);
          setUserSettings(settings);
          setCheckingOnboarding(false);
          setLoading(false);
        }).catch(err => {
          console.error("Initialization failed", err);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setInvoices([]);
      setExpenses([]);
      setUserSettings(null);
      setActiveTab("dashboard");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading || checkingOnboarding) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Initializing InvoiceFlow...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!user) return null;
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onAction={(tab) => setActiveTab(tab)} userSettings={userSettings} />;
      case "invoices":
        return <InvoiceList showToast={showToast} />;
      case "reports":
        return <Reports invoices={invoices} userSettings={userSettings} />;
      // ... rest of cases
    }
  };

  // Skip the inner AuthenticatedApp component and use Routes directly
  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/app" /> : <LandingPage />} />
        <Route path="/p/:userId/:invoiceId" element={<PublicInvoice />} />
        <Route path="/auth" element={user ? <Navigate to="/app" /> : <Auth onSuccess={(msg) => showToast(msg, 'success')} />} />
        <Route path="/app/*" element={
          !user ? <Navigate to="/auth" /> : (
            !userSettings?.onboardingCompleted ? (
              <Onboarding onComplete={() => dbService.getUserSettings(user.uid).then(setUserSettings)} />
            ) : (
              <Layout 
                user={user} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onLogout={handleLogout}
              >
                {(() => {
                  switch (activeTab) {
                    case "dashboard":
                      return <Dashboard onAction={(tab) => setActiveTab(tab)} userSettings={userSettings} />;
                    case "invoices":
                      return <InvoiceList showToast={showToast} />;
                    case "reports":
                      return <Reports invoices={invoices} userSettings={userSettings} />;
                    case "quotes":
                      return <Quotes userId={user.uid} />;
                    case "expenses":
                      return <Expenses userId={user.uid} />;
                    case "clients":
                      return <ClientList />;
                    case "recurring":
                      return <RecurringInvoices onNew={() => setActiveTab('create-recurring')} />;
                    case "settings":
                      return <Settings userId={user.uid} />;
                    case "create-recurring":
                      return (
                        <div className="flex items-center justify-center min-h-[60vh]">
                          <RecurringInvoiceForm 
                            userId={user.uid} 
                            onClose={() => setActiveTab('recurring')} 
                            onSuccess={() => setActiveTab('recurring')} 
                          />
                        </div>
                      );
                    case "create-invoice":
                      return (
                        <div className="flex items-center justify-center min-h-[60vh]">
                          <div className="w-full max-w-3xl">
                            <AIInvoiceGenerator 
                              userId={user.uid} 
                              onClose={() => setActiveTab('dashboard')} 
                              onSuccess={() => {
                                setActiveTab('invoices');
                                dbService.getInvoices(user.uid).then(setInvoices);
                              }}
                            />
                          </div>
                        </div>
                      );
                    default:
                      return <div>Coming Soon</div>;
                  }
                })()}
              </Layout>
            )
          )
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      
      {/* Toasts ... */}
      <AnimatePresence>
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border min-w-[300px]",
                toast.type === 'success' ? "bg-white dark:bg-zinc-900 border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400" :
                toast.type === 'error' ? "bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400" :
                "bg-white dark:bg-zinc-900 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400"
              )}
            >
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertTriangle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{toast.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-400 dark:text-zinc-500"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </Router>
  );
}



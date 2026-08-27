/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { getLocalAuthUser, setLocalAuthUser, AppUser } from './lib/authHelper';
import Layout from './components/Layout';
import { dbService, InvoiceData, ExpenseData, UserSettings } from './services/dbService';
import { Loader2, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Route-level code-splitting: heavy pages (Recharts, jsPDF, html2canvas) load
// on demand instead of inflating the initial bundle.
const Dashboard = lazy(() => import('./components/Dashboard'));
const InvoiceList = lazy(() => import('./components/InvoiceList'));
const AIInvoiceGenerator = lazy(() => import('./components/AIInvoiceGenerator'));
const RecurringInvoices = lazy(() => import('./components/RecurringInvoices'));
const RecurringInvoiceForm = lazy(() => import('./components/RecurringInvoiceForm'));
const ClientList = lazy(() => import('./components/ClientList'));
const Settings = lazy(() => import('./components/Settings'));
const Reports = lazy(() => import('./components/Reports'));
const Expenses = lazy(() => import('./components/Expenses'));
const Quotes = lazy(() => import('./components/Quotes'));
const Auth = lazy(() => import('./components/Auth'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const PublicInvoice = lazy(() => import('./components/PublicInvoice'));
const LandingPage = lazy(() => import('./components/LandingPage'));

/** Lightweight themed fallback shown while a lazy route/chunk is loading. */
function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={28} />
        <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest animate-pulse">
          {label}
        </p>
      </div>
    </div>
  );
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  const [user, setUser] = useState<AppUser | User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [, setExpenses] = useState<ExpenseData[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const loadUserData = useCallback(async (activeUid: string) => {
    setCheckingOnboarding(true);
    try {
      const [inv, exp, settings] = await Promise.all([
        dbService.getInvoices(activeUid),
        dbService.getExpenses(activeUid),
        dbService.getUserSettings(activeUid),
      ]);
      setInvoices(inv || []);
      setExpenses(exp || []);
      setUserSettings(settings);
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setCheckingOnboarding(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Check Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, fbUser => {
      if (!isMounted) return;
      if (fbUser) {
        setUser(fbUser);
        loadUserData(fbUser.uid);
      } else {
        // Fallback to local session
        const localUser = getLocalAuthUser();
        if (localUser) {
          setUser(localUser);
          loadUserData(localUser.uid);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    });

    // Listen to local session changes
    const handleAuthChange = (e: Event) => {
      const newUser = (e as CustomEvent<AppUser | null>).detail || getLocalAuthUser();
      setUser(newUser);
      if (newUser) {
        loadUserData(newUser.uid);
      } else {
        setInvoices([]);
        setExpenses([]);
        setUserSettings(null);
      }
    };

    window.addEventListener('invoiceflow_auth_changed', handleAuthChange);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('invoiceflow_auth_changed', handleAuthChange);
    };
  }, [loadUserData]);

  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);

  const handleLogout = async () => {
    try {
      setLocalAuthUser(null);
      await signOut(auth);
      setUser(null);
      setInvoices([]);
      setExpenses([]);
      setUserSettings(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading || checkingOnboarding) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest animate-pulse">
            Initializing InvoiceFlow...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Suspense fallback={<PageLoader label="Loading InvoiceFlow…" />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/app" /> : <LandingPage />} />
          <Route path="/p/:userId/:invoiceId" element={<PublicInvoice />} />
          <Route
            path="/auth"
            element={
              user ? <Navigate to="/app" /> : <Auth onSuccess={msg => showToast(msg, 'success')} />
            }
          />
        <Route
          path="/app/*"
          element={
            !user ? (
              <Navigate to="/auth" />
            ) : !userSettings?.onboardingCompleted ? (
              <Onboarding
                onComplete={() => dbService.getUserSettings(user.uid).then(setUserSettings)}
              />
            ) : (
              <Layout
                user={user}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onLogout={handleLogout}
              >
                {(() => {
                  switch (activeTab) {
                    case 'dashboard':
                      return (
                        <Dashboard
                          onAction={tab => setActiveTab(tab)}
                          userSettings={userSettings}
                          user={user}
                        />
                      );
                    case 'invoices':
                      return (
                        <InvoiceList
                          showToast={showToast}
                          onEditInvoice={inv => {
                            setEditingInvoice(inv);
                            setActiveTab('edit-invoice');
                          }}
                        />
                      );
                    case 'reports':
                      return <Reports invoices={invoices} userSettings={userSettings} />;
                    case 'quotes':
                      return <Quotes userId={user.uid} />;
                    case 'expenses':
                      return <Expenses userId={user.uid} />;
                    case 'clients':
                      return <ClientList userId={user.uid} showToast={showToast} />;
                    case 'recurring':
                      return (
                        <RecurringInvoices
                          userId={user.uid}
                          onNew={() => setActiveTab('create-recurring')}
                        />
                      );
                    case 'settings':
                      return <Settings userId={user.uid} />;
                    case 'create-recurring':
                      return (
                        <div className="flex items-center justify-center min-h-[60vh]">
                          <RecurringInvoiceForm
                            userId={user.uid}
                            onClose={() => setActiveTab('recurring')}
                            onSuccess={() => setActiveTab('recurring')}
                          />
                        </div>
                      );
                    case 'create-invoice':
                      return (
                        <div className="flex items-center justify-center min-h-[60vh]">
                          <div className="w-full max-w-6xl">
                            <AIInvoiceGenerator
                              userId={user.uid}
                              onClose={() => setActiveTab('dashboard')}
                              onSuccess={() => {
                                setActiveTab('invoices');
                                showToast('Invoice created successfully', 'success');
                                dbService
                                  .getInvoices(user.uid)
                                  .then(setInvoices)
                                  .catch(e => console.warn('Invoice list refresh failed', e));
                              }}
                            />
                          </div>
                        </div>
                      );
                    case 'edit-invoice':
                      return editingInvoice ? (
                        <div className="flex items-center justify-center min-h-[60vh]">
                          <div className="w-full max-w-6xl">
                            <AIInvoiceGenerator
                              userId={user.uid}
                              initialInvoice={editingInvoice}
                              onClose={() => {
                                setEditingInvoice(null);
                                setActiveTab('invoices');
                              }}
                              onSuccess={() => {
                                setEditingInvoice(null);
                                setActiveTab('invoices');
                                showToast('Invoice updated successfully', 'success');
                                dbService
                                  .getInvoices(user.uid)
                                  .then(setInvoices)
                                  .catch(e => console.warn('Invoice list refresh failed', e));
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <InvoiceList showToast={showToast} />
                      );
                    default:
                      return (
                        <Dashboard
                          onAction={tab => setActiveTab(tab)}
                          userSettings={userSettings}
                          user={user}
                        />
                      );
                  }
                })()}
              </Layout>
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>

      {/* Notifications / Toasts */}
      <AnimatePresence>
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                'pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border min-w-[300px]',
                toast.type === 'success'
                  ? 'bg-white dark:bg-zinc-900 border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400'
                  : toast.type === 'error'
                    ? 'bg-white dark:bg-zinc-900 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-white dark:bg-zinc-900 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400'
              )}
            >
              {toast.type === 'success' && <CheckCircle size={20} />}
              {toast.type === 'error' && <AlertTriangle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {toast.message}
              </span>
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

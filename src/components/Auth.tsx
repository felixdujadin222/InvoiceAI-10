import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Chrome,
  UserPlus,
  LogIn,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate, Link } from 'react-router-dom';

interface AuthProps {
  onSuccess: (message: string) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  });

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onSuccess('Logged in successfully with Google');
      navigate('/app');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        onSuccess('Welcome back!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(userCredential.user, {
          displayName: formData.displayName
        });
        onSuccess('Account created successfully!');
      }
      navigate('/app');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100 dark:bg-blue-900/10 rounded-full blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-100 dark:bg-purple-900/10 rounded-full blur-3xl opacity-30 translate-x-1/2 translate-y-1/2" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl shadow-blue-100/50 dark:shadow-none p-8 sm:p-10 relative z-10 border border-gray-100 dark:border-zinc-800"
      >
        <div className="text-center space-y-2 mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200 dark:shadow-none group-hover:scale-110 transition-transform">I</div>
            <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight font-display">InvoiceFlow AI</span>
          </Link>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight font-display italic leading-tight">
            {isLogin ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p className="text-gray-500 dark:text-zinc-400 font-medium text-sm">
            {isLogin ? 'Enter your details to access your dashboard' : 'Join thousands of pros automating their billing'}
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-2xl flex items-center justify-center gap-3 font-bold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700/80 transition-all active:scale-95 shadow-sm group disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
            Continue with Google
          </button>

          <div className="flex items-center gap-4 text-gray-300 dark:text-zinc-700">
            <div className="flex-1 h-px bg-gray-100 dark:bg-zinc-800" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-zinc-500">Or use email</span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-zinc-800" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" size={18} />
                    <input
                      required
                      type="text"
                      className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white"
                      value={formData.displayName}
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      placeholder="John Doe"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" size={18} />
                <input
                  required
                  type="email"
                  className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500" size={18} />
                <input
                  required
                  type="password"
                  className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/20 outline-none transition-all font-bold text-gray-900 dark:text-white"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-start gap-3 text-red-600 dark:text-red-400 text-xs font-bold leading-relaxed"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {isLogin ? 'Sign In Now' : 'Create Account'}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="pt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-bold text-gray-500 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {isLogin ? (
                <>Don't have an account? <span className="text-blue-600 dark:text-blue-400 underline underline-offset-4">Create one for free</span></>
              ) : (
                <>Already have an account? <span className="text-blue-600 dark:text-blue-400 underline underline-offset-4">Sign in here</span></>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

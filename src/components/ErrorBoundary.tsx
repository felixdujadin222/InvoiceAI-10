import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare state: State;
  declare props: Props;
  declare setState: (state: Partial<State> | ((prevState: State) => Partial<State>), callback?: () => void) => void;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Something went wrong</h2>
            <p className="text-gray-500 dark:text-zinc-400 mb-6">
              We&apos;re sorry, but an unexpected error occurred. Our team has been notified.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm font-medium text-gray-500 dark:text-zinc-400 cursor-pointer">
                  Error Details (for debugging)
                </summary>
                <pre className="mt-3 p-4 bg-gray-100 dark:bg-zinc-800 rounded-xl text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40 text-left">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl",
                  "hover:bg-blue-700 transition-all active:scale-95 shadow-lg"
                )}
              >
                <RefreshCw size={18} />
                Try Again
              </button>
              <a
                href="/"
                className={cn(
                  "flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold rounded-xl",
                  "hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                )}
              >
                <Home size={18} />
                Go Home
              </a>
            </div>

            <p className="mt-6 text-xs text-gray-400 dark:text-zinc-500">
              If this persists, please{' '}
              <a href="mailto:support@invoiceflow.ai" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 mt-2">
                <Mail size={14} />
                contact support
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
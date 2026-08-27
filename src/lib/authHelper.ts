export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
}

const DEMO_USER_KEY = 'invoiceflow_auth_user';

export function getLocalAuthUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLocalAuthUser(user: AppUser | null) {
  if (user) {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEMO_USER_KEY);
  }
  window.dispatchEvent(new CustomEvent('invoiceflow_auth_changed', { detail: user }));
}

export function formatAuthError(error: unknown): { message: string; isFirebaseSetupError: boolean } {
  if (!error) return { message: 'An unknown error occurred.', isFirebaseSetupError: false };

  const err = error as { code?: string; message?: string };
  const code = err.code || '';
  const rawMsg = err.message || '';

  if (code === 'auth/configuration-not-found' || rawMsg.includes('configuration-not-found')) {
    return {
      message: 'Firebase Authentication is not activated in your Firebase Console yet. In the Firebase Console, go to Authentication > Get Started > Sign-in method to enable Email/Password or Google.',
      isFirebaseSetupError: true,
    };
  }

  if (code === 'auth/operation-not-allowed' || rawMsg.includes('operation-not-allowed')) {
    return {
      message: 'This sign-in provider is disabled in your Firebase project. In the Firebase Console, go to Authentication > Sign-in method and enable Email/Password or Google.',
      isFirebaseSetupError: true,
    };
  }

  if (code === 'auth/unauthorized-domain' || rawMsg.includes('unauthorized-domain')) {
    return {
      message: 'localhost is not in your Firebase authorized domains list. In Firebase Console, go to Authentication > Settings > Authorized domains and add localhost.',
      isFirebaseSetupError: true,
    };
  }

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return {
      message: 'Invalid email or password. Please check your credentials or create a new account.',
      isFirebaseSetupError: false,
    };
  }

  if (code === 'auth/email-already-in-use') {
    return {
      message: 'An account with this email already exists. Please sign in instead.',
      isFirebaseSetupError: false,
    };
  }

  if (code === 'auth/weak-password') {
    return {
      message: 'Password should be at least 6 characters long.',
      isFirebaseSetupError: false,
    };
  }

  if (code === 'auth/invalid-email') {
    return {
      message: 'Please enter a valid email address.',
      isFirebaseSetupError: false,
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      message: 'Google Sign-in popup was closed before completing.',
      isFirebaseSetupError: false,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      message: 'Network error. Please check your internet connection.',
      isFirebaseSetupError: false,
    };
  }

  return {
    message: rawMsg || 'Authentication failed. Please try again.',
    isFirebaseSetupError: false,
  };
}

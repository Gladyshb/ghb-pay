import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const BlockedScreen = ({ onLogout }) => (
  <div className="fixed inset-0 flex items-center justify-center p-6 bg-background">
    <div className="max-w-sm w-full rounded-2xl p-6 text-center border border-red-500/20 bg-red-500/5">
      <div className="w-14 h-14 rounded-2xl bg-red-500/15 mx-auto flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </div>
      <h2 className="text-xl font-bold text-foreground">Compte bloqué</h2>
      <p className="text-sm text-muted-foreground mt-2">Votre compte a été suspendu par l'administrateur. Contactez le support pour plus d'informations.</p>
      <button onClick={onLogout} className="mt-5 w-full h-11 rounded-xl bg-red-500/80 text-white font-semibold">Se déconnecter</button>
    </div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, user, logout } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (user?.disabled) {
    return <BlockedScreen onLogout={logout} />;
  }

  return <Outlet />;
}
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto"></div>
      <p className="text-sm text-muted-foreground">Chargement en cours...</p>
    </div>
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement = <Navigate to="/login" replace /> }) {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  // Still loading auth
  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // Authenticated - render protected content
  return <Outlet />;
}

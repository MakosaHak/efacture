import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4f6f8]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#006d41] border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/connexion" replace />;

  return <Outlet />;
}

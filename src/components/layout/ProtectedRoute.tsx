import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui/Feedback';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Spinner />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/connexion" replace />;

  return <Outlet />;
}

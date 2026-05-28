import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/Loading';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

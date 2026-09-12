import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from './Loading.jsx';

export default function ProtectedRoute({ expectedRole, children }) {
  const { role, loading } = useAuth();
  if (loading) return <Loading />;
  if (role !== expectedRole) {
    return <Navigate to={role === 'student' ? '/student/dashboard' : role === 'admin' ? '/admin/dashboard' : expectedRole === 'student' ? '/student/login' : '/admin/login'} replace />;
  }
  return children;
}
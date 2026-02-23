import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole } from '../utils/navigation';
const ProtectedRoute = ({
  children,
  allowedRoles
}) => {
  const {
    user,
    loading
  } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace state={{
      from: location.pathname
    }} />;
  }
  return children;
};
export default ProtectedRoute;

import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../utils/roles";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loading">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return children;
}

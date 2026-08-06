import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types";
import { homeForRole } from "../utils/roles";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
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

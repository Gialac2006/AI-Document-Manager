import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute.tsx";
import MainLayout from "./layouts/MainLayout.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import DocumentDetailPage from "./pages/DocumentDetailPage.tsx";
import DocumentsPage from "./pages/DocumentsPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import SearchPage from "./pages/SearchPage.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AuditLogsAdminPage from "./pages/admin/AuditLogsAdminPage.tsx";
import TenantsAdminPage from "./pages/admin/TenantsAdminPage.tsx";
import UsersAdminPage from "./pages/admin/UsersAdminPage.tsx";
import { useAuth } from "./hooks/useAuth";

// Chuyển hướng trang quản trị theo vai trò (super_admin sang dashboard, còn lại sang users)
function AdminIndexRedirect() {
  const { user } = useAuth();
  return (
    <Navigate
      to={user?.role === "super_admin" ? "/admin/dashboard" : "/admin/users"}
      replace
    />
  );
}

// Component route chính của ứng dụng, khai báo toàn bộ route + phân quyền theo vai trò
function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* Nhóm route public: đăng nhập, đăng ký, quên/đặt lại mật khẩu */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Nhóm route protected: yêu cầu đăng nhập, bọc trong MainLayout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/chat" element={<ChatPage />} />
        {/* Nhóm route admin: chỉ super_admin và manager truy cập được */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["super_admin", "manager"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminIndexRedirect />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute roles={["super_admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="users" element={<UsersAdminPage />} />
          <Route
            path="tenants"
            element={
              <ProtectedRoute roles={["super_admin"]}>
                <TenantsAdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="audit-logs" element={<AuditLogsAdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

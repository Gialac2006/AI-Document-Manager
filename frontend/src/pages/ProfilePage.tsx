import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi } from "../api/authApi";
import Button from "../components/ui/Button.tsx";
import PasswordInput from "../components/ui/PasswordInput.tsx";
import { useAuth } from "../hooks/useAuth";
import { formatDate } from "../utils/format";
import { ROLE_LABELS } from "../utils/roles";

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Vui lòng nhập họ và tên");
      return;
    }
    if (password && password !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await authApi.updateMe({
        full_name: fullName.trim(),
        email: email.trim(),
        password: password || undefined,
      });
      updateUser(updated);
      setPassword("");
      setConfirm("");
      setSuccess("Đã lưu thông tin thành công.");
    } catch (err) {
      setError((err as Error).message || "Không thể cập nhật thông tin");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="profile-wrap">
      <div className="page-header">
        <div>
          <h1>Hồ sơ</h1>
          <p className="page-header-desc">
            Xem và chỉnh sửa thông tin tài khoản của bạn
          </p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-banner" />
        <div className="profile-head">
          <div className="profile-avatar">{initials(user.full_name)}</div>
          <div className="profile-head-text">
            <h2 className="profile-name">{user.full_name}</h2>
            <p className="profile-email">{user.email}</p>
            <span className={`role-badge role-${user.role}`}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label htmlFor="profile_name">Họ và tên</label>
            <input
              id="profile_name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile_email">Email</label>
            <input
              id="profile_email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile_password">Mật khẩu mới (bỏ trống nếu không đổi)</label>
            <PasswordInput
              id="profile_password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile_confirm">Xác nhận mật khẩu mới</label>
            <PasswordInput
              id="profile_confirm"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="profile-meta">
            <div className="profile-meta-item">
              <span className="profile-meta-label">Vai trò</span>
              <span className="profile-meta-value">
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Tổ chức</span>
              <span className="profile-meta-value">
                {user.organization_id ? "Thuộc tổ chức" : "Cá nhân"}
              </span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Tham gia</span>
              <span className="profile-meta-value">
                {formatDate(user.created_at)}
              </span>
            </div>
            <div className="profile-meta-item">
              <span className="profile-meta-label">Mã tài khoản</span>
              <span className="profile-meta-value">#{user.id}</span>
            </div>
          </div>

          <div className="profile-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button type="button" variant="danger" onClick={handleLogout}>
              Đăng xuất
            </Button>
            <Link to="/dashboard" className="text-button">
              Về trang chủ
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
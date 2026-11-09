import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Save, LogOut, UserRound, LockKeyhole } from "lucide-react";
import "../profile-page.css";

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

// Trang hồ sơ người dùng: xem thông tin, cập nhật họ tên/email/mật khẩu
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
  const saving = useRef(false);

  // Đăng xuất và chuyển về trang đăng nhập
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Gửi form cập nhật thông tin cá nhân sau khi kiểm tra dữ liệu hợp lệ
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving.current) return;
    setError("");
    setSuccess("");

    if (!fullName.trim()) {
      setError("Vui lòng nhập họ và tên");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    saving.current = true;
    setSubmitting(true);
    try {
      const updated = await authApi.updateMe({
        full_name: fullName.trim(),
        email: email.trim(),
        password: password || undefined,
      });
      updateUser(updated);
      setFullName(updated.full_name);
      setEmail(updated.email);
      setPassword("");
      setConfirm("");
      setSuccess("Đã lưu thông tin thành công.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật thông tin");
    } finally {
      saving.current = false;
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="profile-wrap account-profile">
      <p className="account-profile-description">Xem và cập nhật thông tin tài khoản của bạn.</p>

      <div className="profile-card">
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
          {error && <div className="error-message" role="alert">{error}</div>}
          {success && <div className="alert alert-success" role="status">{success}</div>}

          <section className="account-profile-section" aria-labelledby="account-info-title">
          <h2 id="account-info-title"><UserRound size={18} aria-hidden="true" /> Thông tin cá nhân</h2>
          <div className="account-profile-fields">
          <div className="form-group">
            <label htmlFor="profile_name">Họ và tên</label>
            <input
              id="profile_name"
              autoComplete="name"
              disabled={submitting}
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
              autoComplete="email"
              disabled={submitting}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          </div>
          </section>
          <section className="account-profile-section" aria-labelledby="account-password-title">
          <h2 id="account-password-title"><LockKeyhole size={18} aria-hidden="true" /> Đổi mật khẩu</h2>
          <p className="account-profile-help">Để trống nếu không đổi mật khẩu. Mật khẩu mới cần ít nhất 8 ký tự.</p>
          <div className="account-profile-fields">
          <div className="form-group">
            <label htmlFor="profile_password">Mật khẩu mới</label>
            <PasswordInput
              id="profile_password"
              autoComplete="new-password"
              disabled={submitting}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile_confirm">Xác nhận mật khẩu mới</label>
            <PasswordInput
              id="profile_confirm"
              autoComplete="new-password"
              disabled={submitting}
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          </div>
          </section>
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
              <Save size={17} aria-hidden="true" /> {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleLogout} disabled={submitting}>
              <LogOut size={17} aria-hidden="true" /> Đăng xuất
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

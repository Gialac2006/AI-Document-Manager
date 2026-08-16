import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authApi } from "../api/authApi";
import Button from "../components/ui/Button.tsx";
import PasswordInput from "../components/ui/PasswordInput.tsx";

import "../styles/auth/AuthBackground.css";
import "../styles/auth/LoginPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    authApi
      .validateResetToken(token)
      .then((data) => setValid(Boolean(data.valid)))
      .catch(() => setValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Không thể đặt lại mật khẩu");
    } finally {
      setSubmitting(false);
    }
  };

  let content: ReactNode;
  if (validating) {
    content = <p className="auth-description">Đang kiểm tra link...</p>;
  } else if (!valid) {
    content = (
      <>
        <div className="error-message">
          Link không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu link mới.
        </div>
        <p className="switch-page">
          <Link to="/forgot-password">Gửi lại yêu cầu</Link>
        </p>
      </>
    );
  } else if (success) {
    content = (
      <>
        <div className="alert alert-success">
          Mật khẩu đã được đặt lại thành công.
        </div>
        <p className="switch-page">
          <Link to="/login">Về trang đăng nhập</Link>
        </p>
      </>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">Mật khẩu mới (tối thiểu 6 ký tự)</label>
          <PasswordInput
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm">Xác nhận mật khẩu</label>
          <PasswordInput
            id="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? "Đang xử lý..." : "Đặt lại mật khẩu"}
        </Button>
      </form>
    );
  }

  return (
    <div className="auth-page login-page">
      <div className="auth-container login-card">
        <section className="auth-form login-form-panel">
          <div className="login-brand">
            <span className="login-brand-mark">AI</span>

            <span className="login-brand-name">
              <strong>AI Document</strong>
              <small>Manager</small>
            </span>
          </div>

          <div className="login-user-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              <path d="m10 15 1.5 1.5L14 14" />
            </svg>
          </div>

          <div className="login-heading">
            <h1>Đặt lại mật khẩu</h1>
            <p>Nhập mật khẩu mới cho tài khoản của bạn</p>
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {content}

          <p className="switch-page">
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </section>

        <aside className="login-welcome">
          <div className="login-welcome-content">
            <span className="login-welcome-label">AI DOCUMENT MANAGER</span>

            <h2>Tạo mật khẩu mới</h2>

            <p>
              Đặt một mật khẩu mạnh để bảo vệ tài liệu của bạn. Sau khi hoàn
              tất, bạn có thể đăng nhập và tiếp tục làm việc ngay lập tức.
            </p>

            <Link to="/login" className="login-register-link">
              Về trang đăng nhập
            </Link>
          </div>

          <div className="login-document-preview" aria-hidden="true">
            <div className="login-document-header">
              <span>AI</span>
              <i></i>
            </div>

            <div className="login-document-line line-long"></div>
            <div className="login-document-line line-medium"></div>
            <div className="login-document-line line-short"></div>

            <div className="login-document-status">
              <span>✓</span>
              Tài khoản an toàn
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

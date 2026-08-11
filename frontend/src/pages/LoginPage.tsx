import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import PasswordInput from "../components/ui/PasswordInput.tsx";
import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../utils/roles";

import "../styles/auth/AuthBackground.css";
import "../styles/auth/LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const user = await login({ email, password });
      navigate(from || homeForRole(user.role), { replace: true });
    } catch (err) {
      setError((err as Error).message || "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  };

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
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5" />
            </svg>
          </div>

          <div className="login-heading">
            <h1>Đăng nhập</h1>
            <p>Chào mừng bạn quay trở lại</p>
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>

              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
              />
            </div>

            <div className="form-options">
              <Link
                to="/forgot-password"
                className="text-button login-forgot"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </form>

          <p className="switch-page">
            Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
          </p>
        </section>

        <aside className="login-welcome">
          <div className="login-welcome-content">
            <span className="login-welcome-label">
              AI DOCUMENT MANAGER
            </span>

            <h2>Chào mừng trở lại!</h2>

            <p>
              Đăng nhập để tiếp tục quản lý, tìm kiếm và hỏi đáp với tài
              liệu của bạn bằng AI.
            </p>

            <Link to="/register" className="login-register-link">
              Tạo tài khoản
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
              Tài liệu đã sẵn sàng
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { authApi } from "../api/authApi";
import Button from "../components/ui/Button.tsx";
import type { ForgotPasswordResponse } from "../types";

import "../styles/auth/AuthBackground.css";
import "../styles/auth/LoginPage.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const data = await authApi.forgotPassword(email);
      setResult(data);
    } catch (err) {
      setError((err as Error).message || "Không thể gửi yêu cầu");
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
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              <circle cx="12" cy="16" r="1.4" />
            </svg>
          </div>

          <div className="login-heading">
            <h1>Quên mật khẩu</h1>
            <p>Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu</p>
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {result ? (
            <>
              <div className="alert alert-success">{result.detail}</div>
              {result.reset_url && (
                <div className="form-group reset-box">
                  <label>Link đặt lại mật khẩu (chế độ dev)</label>
                  <input readOnly value={result.reset_url} />
                  <a className="primary-link" href={result.reset_url}>
                    Mở link đặt lại mật khẩu
                  </a>
                </div>
              )}
              <p className="switch-page">
                Nhớ mật khẩu? <Link to="/login">Đăng nhập</Link>
              </p>
            </>
          ) : (
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

              <Button
                type="submit"
                className="login-submit"
                disabled={submitting}
              >
                {submitting ? "Đang xử lý..." : "Gửi link đặt lại"}
              </Button>
            </form>
          )}

          <p className="switch-page">
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </section>

        <aside className="login-welcome">
          <div className="login-welcome-content">
            <span className="login-welcome-label">AI DOCUMENT MANAGER</span>

            <h2>Khôi phục quyền truy cập của bạn</h2>

            <p>
              Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu an toàn.
              Bạn sẽ quay lại quản lý tài liệu của mình ngay sau đó.
            </p>

            <Link to="/login" className="login-register-link">
              Quay lại đăng nhập
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
              Mật khẩu an toàn
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

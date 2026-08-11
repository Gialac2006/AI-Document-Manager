import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import PasswordInput from "../components/ui/PasswordInput.tsx";
import { useAuth } from "../hooks/useAuth";

import "../styles/auth/AuthBackground.css";
import "../styles/auth/RegisterPage.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerOrg, setRegisterOrg] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await register({
        full_name: fullName,
        email,
        password,
        organization_name: registerOrg ? organizationName : undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Đăng ký thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-container register-card">
        <section className="auth-form register-form-panel">
          <div className="register-brand">
            <span className="register-brand-mark">AI</span>

            <span className="register-brand-name">
              <strong>AI Document</strong>
              <small>Manager</small>
            </span>
          </div>

          {success ? (
            <div className="register-success">
              <div className="register-success-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </div>

              <h1>Đăng ký thành công!</h1>
              <p>Tài khoản của bạn đã sẵn sàng. Hãy đăng nhập để tiếp tục.</p>

              <Button
                type="button"
                className="register-submit"
                onClick={() => navigate("/login")}
              >
                Về trang đăng nhập
              </Button>
            </div>
          ) : (
            <>
              <div className="register-user-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="9" cy="8" r="4" />
                  <path d="M2.5 21c.6-4.2 2.8-6.5 6.5-6.5 2 0 3.6.7 4.7 1.9" />
                  <path d="M18 14v7M14.5 17.5h7" />
                </svg>
              </div>

              <div className="register-heading">
                <h1>Tạo tài khoản</h1>
                <p>Bắt đầu quản lý tài liệu thông minh cùng AI</p>
              </div>

              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="full_name">Họ và tên</label>

                  <input
                    id="full_name"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                  />
                </div>

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
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                </div>

                <div className="register-org-section">
                  <label className="register-org-checkbox">
                    <input
                      type="checkbox"
                      checked={registerOrg}
                      onChange={(e) => setRegisterOrg(e.target.checked)}
                    />

                    <span className="register-checkbox-mark" aria-hidden="true">
                      <svg viewBox="0 0 12 10">
                        <path d="m1 5 3 3 7-7" />
                      </svg>
                    </span>

                    <span>
                      <strong>Đăng ký cho tổ chức</strong>
                      <small>Tôi là người quản lý</small>
                    </span>
                  </label>

                  {registerOrg && (
                    <div className="register-org-field">
                      <label htmlFor="organization_name">Tên tổ chức</label>

                      <input
                        id="organization_name"
                        type="text"
                        required
                        autoComplete="organization"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Công ty ABC"
                      />
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="register-submit"
                  disabled={submitting}
                >
                  {submitting ? "Đang xử lý..." : "Đăng ký"}
                </Button>
              </form>

              <p className="switch-page">
                Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
              </p>
            </>
          )}
        </section>

        <aside className="register-welcome">
          <div className="register-welcome-content">
            <span className="register-welcome-label">AI DOCUMENT MANAGER</span>

            <h2>Bắt đầu hành trình cùng tài liệu của bạn</h2>

            <p>
              Tạo tài khoản để lưu trữ, tìm kiếm và khai thác nội dung tài
              liệu nhanh chóng bằng AI.
            </p>
          </div>

          <div className="register-feature-list" aria-hidden="true">
            <div className="register-feature-card feature-one">
              <span>01</span>
              <div>
                <strong>Tải tài liệu</strong>
                <small>Lưu trữ tập trung và an toàn</small>
              </div>
            </div>

            <div className="register-feature-card feature-two">
              <span>02</span>
              <div>
                <strong>AI xử lý</strong>
                <small>Phân tích nội dung tự động</small>
              </div>
            </div>

            <div className="register-feature-card feature-three">
              <span>03</span>
              <div>
                <strong>Tìm kiếm & hỏi đáp</strong>
                <small>Nhận câu trả lời từ tài liệu</small>
              </div>
            </div>
          </div>

          <Link to="/login" className="register-login-link">
            Tôi đã có tài khoản
          </Link>
        </aside>
      </div>
    </div>
  );
}
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthIntro from "../components/ui/AuthIntro.tsx";
import Button from "../components/ui/Button.tsx";
import PasswordInput from "../components/ui/PasswordInput.tsx";
import { useAuth } from "../hooks/useAuth";

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
    <div className="auth-page">
      <div className="auth-container">
        <AuthIntro
          title="Đăng ký tài khoản"
          description="Đăng ký cá nhân để dùng riêng, hoặc tạo tổ chức để quản lý tài liệu chung cho đội nhóm của bạn."
        />

        <div className="auth-form">
          <h2>Đăng ký</h2>
          <p className="auth-description">Tạo tài khoản mới</p>

          {error && <div className="error-message">{error}</div>}

          {success ? (
            <div>
              <div className="alert alert-success">
                Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.
              </div>
              <Button
                type="button"
                onClick={() => navigate("/login")}
              >
                Về trang đăng nhập
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="full_name">Họ và tên</label>
                <input
                  id="full_name"
                  type="text"
                  required
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Mật khẩu (tối thiểu 6 ký tự)</label>
                <PasswordInput
                  id="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={registerOrg}
                    onChange={(e) => setRegisterOrg(e.target.checked)}
                  />
                  Đăng ký cho tổ chức (tôi là quản lý)
                </label>

                {registerOrg && (
                  <div className="org-field">
                    <label htmlFor="organization_name">Tên tổ chức</label>
                    <input
                      id="organization_name"
                      type="text"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Công ty ABC"
                    />
                  </div>
                )}
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang xử lý..." : "Đăng ký"}
              </Button>
            </form>
          )}

          <p className="switch-page">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

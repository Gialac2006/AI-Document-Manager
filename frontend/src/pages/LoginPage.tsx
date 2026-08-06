import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthIntro from "../components/ui/AuthIntro.tsx";
import Button from "../components/ui/Button.tsx";
import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../utils/roles";

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
    <div className="auth-page">
      <div className="auth-container">
        <AuthIntro
          title="Quản lý tài liệu thông minh"
          description="Lưu trữ, tìm kiếm ngữ nghĩa và hỏi đáp theo tài liệu bằng AI cho doanh nghiệp, trường học và cơ quan."
        />

        <div className="auth-form">
          <h2>Đăng nhập</h2>
          <p className="auth-description">Nhập email và mật khẩu để tiếp tục</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
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
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="form-options">
              <span></span>
              <Link to="/forgot-password" className="text-button">
                Quên mật khẩu?
              </Link>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </form>

          <p className="switch-page">
            Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

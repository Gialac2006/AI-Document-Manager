import { useState } from "react";
import { Link } from "react-router-dom";

import { authApi } from "../api/authApi";
import Button from "../components/ui/Button.jsx";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const data = await authApi.forgotPassword(email);
      setResult(data);
    } catch (err) {
      setError(err.message || "Không thể gửi yêu cầu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-introduction">
          <h1>AI Document Manager</h1>
          <p>Nhập email của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
        </div>

        <div className="auth-form">
          <h2>Quên mật khẩu</h2>
          <p className="auth-description">Nhập email đã đăng ký tài khoản</p>

          {error && <div className="error-message">{error}</div>}

          {result ? (
            <div>
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
            </div>
          ) : (
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

              <Button type="submit" disabled={submitting}>
                {submitting ? "Đang xử lý..." : "Gửi link đặt lại"}
              </Button>
            </form>
          )}

          <p className="switch-page">
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

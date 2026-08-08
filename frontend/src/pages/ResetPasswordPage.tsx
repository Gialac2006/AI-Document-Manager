import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authApi } from "../api/authApi";
import AuthIntro from "../components/ui/AuthIntro.tsx";
import Button from "../components/ui/Button.tsx";
import PasswordInput from "../components/ui/PasswordInput.tsx";

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
            minLength={6}
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
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang xử lý..." : "Đặt lại mật khẩu"}
        </Button>
      </form>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <AuthIntro
          title="Đặt lại mật khẩu"
          description="Nhập mật khẩu mới cho tài khoản của bạn."
        />

        <div className="auth-form">
          <h2>Đặt lại mật khẩu</h2>
          {error && <div className="error-message">{error}</div>}
          {content}
        </div>
      </div>
    </div>
  );
}

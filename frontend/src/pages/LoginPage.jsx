import { Link } from "react-router-dom";

function LoginPage() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>Đăng nhập</h1>

      <input type="email" placeholder="Email" />
      <br />
      <br />

      <input type="password" placeholder="Mật khẩu" />
      <br />
      <br />

      <button type="button">Đăng nhập</button>

      <p>
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </p>
    </div>
  );
}

export default LoginPage;
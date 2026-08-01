import { Link } from "react-router-dom";

function RegisterPage() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>Đăng ký</h1>

      <input type="text" placeholder="Họ và tên" />
      <br />
      <br />

      <input type="email" placeholder="Email" />
      <br />
      <br />

      <input type="password" placeholder="Mật khẩu" />
      <br />
      <br />

      <button type="button">Đăng ký</button>

      <p>
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </div>
  );
}

export default RegisterPage;
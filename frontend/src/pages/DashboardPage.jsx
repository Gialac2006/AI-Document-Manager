import { Link } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Chào mừng, {user?.full_name}</h1>
      <p className="muted">
        Đây là trang tổng quan. Các tính năng tài liệu, tìm kiếm ngữ nghĩa và
        chat (RAG) sẽ được bổ sung ở các giai đoạn sau.
      </p>

      <div className="card-grid">
        <Link to="/documents" className="card">
          <h3>Tài liệu</h3>
          <p>Upload và quản lý tài liệu</p>
        </Link>
        <Link to="/search" className="card">
          <h3>Tìm kiếm</h3>
          <p>Tìm kiếm ngữ nghĩa theo nội dung</p>
        </Link>
        <Link to="/chat" className="card">
          <h3>Chat</h3>
          <p>Hỏi đáp theo tài liệu (RAG)</p>
        </Link>
      </div>
    </div>
  );
}

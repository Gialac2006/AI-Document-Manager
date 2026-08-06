const FEATURES = ["Lưu trữ và quản lý tài liệu tập trung", "Tìm kiếm ngữ nghĩa bằng AI", "Chat hỏi đáp theo tài liệu (RAG)"];

interface AuthIntroProps {
  title: string;
  description: string;
}

export default function AuthIntro({ title, description }: AuthIntroProps) {
  return (
    <div className="auth-introduction">
      <div className="auth-logo">
        <span className="auth-logo-mark">📄</span>
        AI Document Manager
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
      <ul className="auth-feature-list">
        {FEATURES.map((feature) => (
          <li key={feature}>
            <span>✅</span> {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

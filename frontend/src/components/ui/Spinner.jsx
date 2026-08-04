export default function Spinner({ label = "Đang xử lý..." }) {
  return (
    <div className="page-loading">
      <div className="muted">{label}</div>
    </div>
  );
}

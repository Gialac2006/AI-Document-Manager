interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = "Đang xử lý..." }: SpinnerProps) {
  return (
    <div className="loading-block">
      <div className="spinner-ring"></div>
      <div className="muted">{label}</div>
    </div>
  );
}

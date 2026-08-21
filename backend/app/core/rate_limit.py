import threading
import time


# Giới hạn số lần gọi các endpoint nhạy cảm trong một khoảng thời gian
class RateLimiter:
    """Rate limiter in-memory đơn giản (không cần dependency bên ngoài)."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._attempts: dict[str, list[float]] = {}

    # Xóa các lần gọi đã hết hạn trong cửa sổ thời gian
    def _prune(self, key: str, now: float) -> list[float]:
        stamps = self._attempts.get(key, [])
        stamps = [t for t in stamps if now - t < self.window_seconds]
        if stamps:
            self._attempts[key] = stamps
        else:
            self._attempts.pop(key, None)
        return stamps

    # Kiểm tra key có bị chặn do quá số lần gọi không
    def is_blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._prune(key, time.monotonic())) >= self.max_attempts

    # Ghi nhận một lần gọi
    def hit(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            stamps = self._prune(key, now)
            stamps.append(now)
            self._attempts[key] = stamps

    # Xóa toàn bộ lịch sử gọi của key (đặt lại bộ đếm)
    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)
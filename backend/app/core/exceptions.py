from fastapi import HTTPException, status


# Lỗi dữ liệu không hợp lệ (400)
class BadRequestError(HTTPException):
    def __init__(self, detail: str = "Dữ liệu không hợp lệ"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# Lỗi không tìm thấy tài nguyên (404)
class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Không tìm thấy"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


# Lỗi dữ liệu đã tồn tại trùng lặp (409)
class DuplicateError(HTTPException):
    def __init__(self, detail: str = "Đã tồn tại"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


# Lỗi chưa xác thực/đăng nhập (401)
class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Không có quyền truy cập"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


# Lỗi không đủ quyền truy cập (403)
class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Không được phép thực hiện"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


# Lỗi quá nhiều yêu cầu, bị giới hạn tốc độ (429)
class TooManyRequestsError(HTTPException):
    def __init__(self, detail: str = "Quá nhiều lần thử, vui lòng thử lại sau"):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": "60"},
        )
# Dịch vụ bên ngoài tạm thời không khả dụng (503)
class ServiceUnavailableError(HTTPException):
    def __init__(self, detail: str = "Dịch vụ tạm thời không khả dụng"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )
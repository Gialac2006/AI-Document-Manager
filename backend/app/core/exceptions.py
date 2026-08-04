from fastapi import HTTPException, status


class BadRequestError(HTTPException):
    def __init__(self, detail: str = "Dữ liệu không hợp lệ"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Không tìm thấy"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class DuplicateError(HTTPException):
    def __init__(self, detail: str = "Đã tồn tại"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Không có quyền truy cập"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Không được phép thực hiện"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

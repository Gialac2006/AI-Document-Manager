from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User, UserRole


class Scope:
    """Xác định phạm vi dữ liệu một người dùng được phép nhìn/ghi."""

    def __init__(self, user: User):
        self.user = user

    @property
    def is_super_admin(self) -> bool:
        return self.user.role == UserRole.SUPER_ADMIN

    @property
    def organization_id(self) -> int | None:
        if self.user.role in (UserRole.MANAGER, UserRole.STAFF):
            return self.user.organization_id
        return None

    @property
    def owner_id(self) -> int | None:
        if self.user.role == UserRole.INDIVIDUAL:
            return self.user.id
        return None

    def filters(self) -> dict:
        if self.is_super_admin:
            return {}
        if self.organization_id is not None:
            return {"organization_id": self.organization_id}
        return {"owner_id": self.owner_id}

    def belongs(self, organization_id: int | None, owner_id: int | None) -> bool:
        if self.is_super_admin:
            return True
        if self.organization_id is not None:
            return organization_id == self.organization_id
        return owner_id == self.user.id


def check_folder_scope(folder, user: User):
    if folder is None:
        raise NotFoundError("Thư mục không tồn tại")
    if not Scope(user).belongs(folder.organization_id, folder.owner_id):
        raise ForbiddenError("Không có quyền truy cập thư mục này")
    return folder


def check_document_scope(document, user: User):
    if document is None:
        raise NotFoundError("Tài liệu không tồn tại")
    if not Scope(user).belongs(document.organization_id, document.owner_id):
        raise ForbiddenError("Không có quyền truy cập tài liệu này")
    return document
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User, UserRole


# Định nghĩa các mức quyền truy cập và thứ tự xếp hạng
class AccessLevel:
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"

    _RANK = {VIEW: 1, EDIT: 2, ADMIN: 3}

    # Trả về thứ bậc số để so sánh mức quyền
    @classmethod
    def rank(cls, level: str) -> int:
        return cls._RANK.get(level, 0)


# Xác định phạm vi dữ liệu và quyền truy cập của người dùng
class Scope:
    """Xác định phạm vi dữ liệu + mức quyền (view/edit/admin) của một người dùng."""

    def __init__(self, user: User, db=None):
        self.user = user
        self.db = db

    # Kiểm tra user có phải super admin
    @property
    def is_super_admin(self) -> bool:
        return self.user.role == UserRole.SUPER_ADMIN

    # Trả về id tổ chức của manager/staff
    @property
    def organization_id(self) -> int | None:
        if self.user.role in (UserRole.MANAGER, UserRole.STAFF):
            return self.user.organization_id
        return None

    # Trả về id chủ sở hữu của tài khoản cá nhân
    @property
    def owner_id(self) -> int | None:
        if self.user.role == UserRole.INDIVIDUAL:
            return self.user.id
        return None

    # Trả về bộ lọc truy vấn theo phạm vi quyền
    def filters(self) -> dict:
        if self.is_super_admin:
            return {}
        if self.organization_id is not None:
            return {"organization_id": self.organization_id}
        return {"owner_id": self.owner_id}

    # Kiểm tra tài nguyên có thuộc phạm vi của user
    def belongs(self, organization_id: int | None, owner_id: int | None) -> bool:
        if self.is_super_admin:
            return True
        if self.organization_id is not None:
            return organization_id == self.organization_id
        return owner_id == self.user.id

    # Kiểm tra user có quyền chia sẻ trực tiếp với tài liệu
    def has_explicit(self, document_id: int) -> bool:
        if self.db is None:
            return False
        from app.models.permission import Permission

        return (
            self.db.query(Permission.id)
            .filter(
                Permission.document_id == document_id,
                Permission.user_id == self.user.id,
            )
            .first()
            is not None
        )

    # Tính mức quyền truy cập hiệu lực cho user
    def access_level(
        self,
        *,
        document_id: int | None = None,
        kind: str = "document",
        organization_id: int | None = None,
        owner_id: int | None = None,
    ) -> str:
        if self.is_super_admin:
            return AccessLevel.ADMIN
        if document_id is not None and self.db is not None:
            from app.models.permission import Permission

            permission = (
                self.db.query(Permission)
                .filter(
                    Permission.document_id == document_id,
                    Permission.user_id == self.user.id,
                )
                .one_or_none()
            )
            if permission is not None:
                return permission.access_level
        return self._fallback_access_level(kind, organization_id, owner_id)

    # Mức quyền mặc định theo vai trò khi không có quyền cụ thể
    def _fallback_access_level(
        self, kind: str, organization_id: int | None, owner_id: int | None
    ) -> str:
        if self.user.role == UserRole.MANAGER:
            return AccessLevel.ADMIN
        if self.user.role == UserRole.INDIVIDUAL:
            if owner_id == self.user.id:
                return AccessLevel.ADMIN
            return ""
        if kind == "folder":
            return AccessLevel.VIEW
        return AccessLevel.EDIT

    # Kiểm tra user có đủ mức quyền yêu cầu
    def can(
        self,
        required: str,
        *,
        document_id: int | None = None,
        kind: str = "document",
        organization_id: int | None = None,
        owner_id: int | None = None,
    ) -> bool:
        return AccessLevel.rank(
            self.access_level(
                document_id=document_id,
                kind=kind,
                organization_id=organization_id,
                owner_id=owner_id,
            )
        ) >= AccessLevel.rank(required)


# Kiểm tra quyền truy cập thư mục của user
def check_folder_scope(folder, user: User, required: str = AccessLevel.VIEW, db=None):
    if folder is None:
        raise NotFoundError("Thư mục không tồn tại")
    scope = Scope(user, db=db)
    if not scope.belongs(folder.organization_id, folder.owner_id):
        raise ForbiddenError("Không có quyền truy cập thư mục này")
    if not scope.can(
        required,
        kind="folder",
        organization_id=folder.organization_id,
        owner_id=folder.owner_id,
    ):
        raise ForbiddenError("Không đủ quyền hạn để thực hiện hành động này")
    return folder


# Kiểm tra quyền truy cập tài liệu của user
def check_document_scope(document, user: User, required: str = AccessLevel.VIEW, db=None):
    if document is None:
        raise NotFoundError("Tài liệu không tồn tại")
    scope = Scope(user, db=db)
    if not scope.belongs(document.organization_id, document.owner_id):
        if not scope.has_explicit(document.id):
            raise ForbiddenError("Không có quyền truy cập tài liệu này")
    if not scope.can(
        required,
        kind="document",
        document_id=document.id,
        organization_id=document.organization_id,
        owner_id=document.owner_id,
    ):
        raise ForbiddenError("Không đủ quyền hạn để thực hiện hành động này")
    return document
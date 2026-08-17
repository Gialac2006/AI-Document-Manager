from app.repositories import audit_log_repository


# Các hành động được ghi vào nhật ký kiểm toán
class AuditAction:
    CREATE = "create"
    VIEW = "view"
    EDIT = "edit"
    UPLOAD_VERSION = "upload_version"
    DELETE = "delete"
    APPROVE = "approve"
    REJECT = "reject"
    SHARE_GRANT = "share_grant"
    SHARE_REVOKE = "share_revoke"


# Ghi log hành động liên quan đến tài liệu
def log_document(
    db,
    *,
    user_id: int | None,
    action: str,
    document_id: int | None = None,
    details: str | None = None,
):
    return audit_log_repository.create(
        db,
        user_id=user_id,
        action=action,
        entity_type="document",
        entity_id=document_id,
        details=details,
    )
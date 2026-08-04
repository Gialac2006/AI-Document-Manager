# ERD — AI Document Manager

> Sơ đồ quan hệ thực thể (ERD) của toàn bộ schema. DB quản lý bằng Alembic (`backend/alembic/versions/`).

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : "có thành viên"
    ORGANIZATIONS ||--o{ FOLDERS : "chứa thư mục"
    ORGANIZATIONS ||--o{ DOCUMENTS : "chứa tài liệu"
    ORGANIZATIONS ||--o{ CHATS : "chứa hội thoại"

    USERS ||--o{ FOLDERS : "sở hữu (cá nhân)"
    USERS ||--o{ DOCUMENTS : "sở hữu (cá nhân)"
    USERS ||--o{ AUDIT_LOGS : "thực hiện"
    USERS ||--o{ CHATS : "tạo"
    USERS ||--o{ PERMISSIONS : "được cấp quyền"
    USERS ||--o{ DOCUMENT_VERSIONS : "tạo phiên bản"

    FOLDERS ||--o{ FOLDERS : "parent_id (cây phân cấp)"
    FOLDERS ||--o{ DOCUMENTS : "chứa"

    DOCUMENTS ||--o{ DOCUMENT_VERSIONS : "có lịch sử"
    DOCUMENTS ||--o{ PERMISSIONS : "có phân quyền"

    CHATS ||--o{ CHAT_MESSAGES : "chứa tin nhắn"

    ORGANIZATIONS {
        int id PK
        string name "tên tổ chức"
        datetime created_at
        datetime updated_at
    }
    USERS {
        int id PK
        string full_name
        string email UK
        string hashed_password
        string role "super_admin | manager | staff | individual"
        int organization_id FK "NULL với super_admin/individual"
        datetime created_at
        datetime updated_at
    }
    FOLDERS {
        int id PK
        string name
        int parent_id FK "NULL = thư mục gốc"
        int organization_id FK "NULL với cá nhân"
        int owner_id FK "chủ sở hữu"
        datetime created_at
        datetime updated_at
    }
    DOCUMENTS {
        int id PK
        string title
        string file_path
        string file_name
        string file_type "pdf/docx/..."
        int folder_id FK "NULL = ngoài thư mục"
        int organization_id FK "NULL với cá nhân"
        int owner_id FK
        string status "uploaded | processing | done"
        int current_version
        datetime created_at
        datetime updated_at
    }
    DOCUMENT_VERSIONS {
        int id PK
        int document_id FK
        int version "tăng dần theo tài liệu"
        string file_path
        string file_name
        int created_by FK
        datetime created_at
    }
    PERMISSIONS {
        int id PK
        int document_id FK
        int user_id FK
        string access_level "view | edit"
        datetime created_at
    }
    AUDIT_LOGS {
        int id PK
        int user_id FK
        string action
        string entity_type
        int entity_id
        string details
        datetime created_at
    }
    CHATS {
        int id PK
        int user_id FK "người tạo"
        int organization_id FK "NULL với cá nhân"
        string title
        datetime created_at
        datetime updated_at
    }
    CHAT_MESSAGES {
        int id PK
        int chat_id FK
        string role "user | assistant"
        string content
        datetime created_at
    }
```

## Ghi chú thiết kế

- **Phạm vi dữ liệu theo vai trò**: bảng `folders`, `documents`, `chats` có `organization_id` (nullable).
  - `organization_id` khác NULL → dữ liệu dùng chung trong tổ chức (manager/staff).
  - `organization_id` NULL → dữ liệu riêng của `owner_id` (cá nhân).
- **`users.role`**: `super_admin` không thuộc tổ chức; `manager`/`staff` thuộc tổ chức; `individual` không thuộc tổ chức.
- **Quan hệ `folders.parent_id`** tự tham chiếu tạo cây thư mục phân cấp.
- **Ràng buộc duy nhất**: `users.email`, `(document_id, version)`, `(document_id, user_id)`.
- **`permissions`** (phân quyền chi tiết theo tài liệu) sẽ được dùng ở Giai đoạn 5.

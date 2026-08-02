# AI Document Manager

Hệ thống quản lý tài liệu thông minh cho doanh nghiệp, trường đại học và cơ quan nhà nước — hỗ trợ lưu trữ, tìm kiếm và khai thác tài liệu bằng AI.

## Tổng quan

AI Document Manager là một ứng dụng web giúp tổ chức lưu trữ và quản lý tài liệu tập trung, kết hợp AI để tự động hoá quy trình xử lý văn bản:

- **Trích xuất nội dung**: chuyển PDF/ảnh thành văn bản bằng OCR.
- **Tìm kiếm ngữ nghĩa**: tìm tài liệu theo ý nghĩa câu hỏi, không chỉ theo từ khoá.
- **Hỏi đáp theo tài liệu (RAG)**: đặt câu hỏi và nhận câu trả lời dựa trên nội dung tài liệu đã lưu.
- **Quản lý phiên bản**: theo dõi lịch sử chỉnh sửa của từng tài liệu.

Sản phẩm gồm: Website, REST API, Docker và tài liệu kỹ thuật.

## Tính năng

### Quản lý tài liệu
- Upload tài liệu (PDF, DOCX, ảnh...)
- Quản lý thư mục theo cây phân cấp
- Phân quyền người dùng (admin, editor, viewer)
- OCR và chuyển PDF thành văn bản
- Phiên bản tài liệu (versioning)
- Nhật ký chỉnh sửa (audit log)

### AI tích hợp
- Tóm tắt tài liệu
- Tìm kiếm ngữ nghĩa
- Hỏi đáp theo tài liệu
- Phân loại tài liệu
- Trích xuất thông tin (entity, ngày tháng, số liệu...)

### Chức năng nâng cao
- RAG (Retrieval-Augmented Generation)
- Vector Database
- Chat với PDF

## Tech stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19, React Router, Vite 8 |
| Backend | FastAPI (Python) |
| Cơ sở dữ liệu | PostgreSQL |
| Vector Database | Qdrant (hoặc Chroma) |
| OCR | Tesseract / PyMuPDF |
| LLM | LLM API (OpenAI, Gemini...) |
| Triển khai | Docker Compose, Nginx |

## Cấu trúc dự án

```
ai-document-manager/
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── api/                 # authApi, documentApi, folderApi, chatApi
│   │   ├── components/          # DocumentCard, UploadDocument, FolderTree, SearchBar, ChatBox
│   │   ├── pages/               # Login, Register, Dashboard, Documents, Chat, Search, Admin
│   │   ├── layouts/             # MainLayout
│   │   ├── hooks/               # useAuth
│   │   ├── utils/               # format
│   │   ├── styles/              # auth, login
│   │   ├── App.jsx              # định nghĩa routes
│   │   └── main.jsx
│   ├── Dockerfile
│   └── nginx.conf               # SPA + proxy /api
│
├── backend/                     # FastAPI
│   └── app/
│       ├── main.py              # entry point
│       ├── api/
│       │   ├── dependencies.py  # get_current_user, get_db
│       │   └── routes/          # auth, users, folders, documents, search, chat, admin
│       ├── core/                # config, security, exceptions
│       ├── database/            # connection, base
│       ├── models/              # user, folder, document, document_version, permission, audit_log, chat
│       ├── schemas/             # Pydantic request/response
│       ├── repositories/        # truy vấn DB
│       ├── services/            # auth, document, storage, extraction, ocr, chunking, embedding, vector, summary, rag
│       └── utils/               # file_utils, text_utils
│
├── database/
│   └── init.sql                 # schema khởi tạo
├── storage/
│   └── uploads/                 # file tài liệu lưu trữ
├── scripts/                     # init_database.sql, seed_data.py
├── docs/                        # requirements, diagrams, api, database, test-cases
├── compose.yaml                 # frontend + backend + PostgreSQL + Qdrant
└── .env.example
```

## Cài đặt & chạy

### Yêu cầu
- Node.js >= 20
- Python >= 3.11
- Docker (khuyến nghị)

### Cấu hình môi trường
```bash
cp .env.example .env
```

### Cách 1: Docker Compose (khuyến nghị)
```bash
docker compose up --build
```
- Website: http://localhost
- API + Swagger: http://localhost:8000/docs

### Cách 2: Chạy thủ công

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## API endpoints

| Method | Endpoint | Mô tả | Trạng thái |
|---|---|---|---|
| GET | `/` | Thông tin API | ✅ |
| GET | `/health` | Kiểm tra sức khoẻ | ✅ |
| POST | `/api/v1/auth/register` | Đăng ký | ⏳ |
| POST | `/api/v1/auth/login` | Đăng nhập, nhận token | ⏳ |
| GET | `/api/v1/auth/me` | Thông tin người dùng hiện tại | ⏳ |
| GET | `/api/v1/users` | Danh sách người dùng (admin) | ⏳ |
| GET/POST | `/api/v1/folders` | Danh sách / tạo thư mục | ⏳ |
| PUT/DELETE | `/api/v1/folders/{id}` | Đổi tên / xoá thư mục | ⏳ |
| GET/POST | `/api/v1/documents` | Danh sách / upload tài liệu | ⏳ |
| GET/PUT/DELETE | `/api/v1/documents/{id}` | Chi tiết / cập nhật / xoá tài liệu | ⏳ |
| GET | `/api/v1/documents/{id}/download` | Tải tài liệu | ⏳ |
| GET | `/api/v1/documents/{id}/versions` | Lịch sử phiên bản | ⏳ |
| GET | `/api/v1/search?q=...` | Tìm kiếm ngữ nghĩa | ⏳ |
| POST | `/api/v1/chat` | Hỏi đáp theo tài liệu (RAG) | ⏳ |
| GET | `/api/v1/admin/*` | Quản trị hệ thống | ⏳ |

> ✅ = đã triển khai, ⏳ = đang phát triển. Tài liệu API đầy đủ tại `/docs` (Swagger UI).

## Cơ sở dữ liệu

Schema được khởi tạo từ `database/init.sql` (PostgreSQL):

| Bảng | Mô tả |
|---|---|
| `users` | Người dùng (full_name, email, hashed_password, role) |
| `folders` | Thư mục, hỗ trợ cây phân cấp (parent_id) |
| `documents` | Tài liệu (title, file_path, folder_id, owner_id, status) |
| `document_versions` | Phiên bản tài liệu |
| `permissions` | Phân quyền truy cập |
| `audit_logs` | Nhật ký chỉnh sửa |
| `chats` | Hội thoại hỏi đáp |

Ngoài ra, embeddings của tài liệu được lưu trong **Qdrant** (vector database) phục vụ tìm kiếm ngữ nghĩa và RAG.

## Luồng sử dụng

```
Đăng ký / Đăng nhập
        │
        ▼
Upload tài liệu (PDF/ảnh/DOCX)
        │
        ▼
Xử lý tự động:
  OCR / trích xuất văn bản → chunk (chia đoạn)
        → embedding (vector hoá) → lưu vào Qdrant
        │
        ▼
Người dùng khai thác:
  ├── Tìm kiếm ngữ nghĩa → truy vấn vector → kết quả tài liệu liên quan
  ├── Chat với tài liệu (RAG) → truy vấn vector → gửi LLM → câu trả lời kèm nguồn
  ├── Tóm tắt / phân loại / trích xuất thông tin
  └── Quản lý phiên bản + nhật ký chỉnh sửa
        │
        ▼
Admin: quản lý người dùng, phân quyền, giám sát hệ thống
```

## Sản phẩm

- Website (React)
- REST API (FastAPI, Swagger UI tại `/docs`)
- Docker (frontend + backend + PostgreSQL + Qdrant)
- Tài liệu kỹ thuật (`docs/`)

## Trạng thái phát triển

> Dự án đang ở giai đoạn khung (scaffold). Frontend có cấu trúc trang và routing; backend có khung route, model, service; `GET /` và `GET /health` đã hoạt động. Các tính năng còn lại đang được triển khai.

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
- Phân quyền theo vai trò (admin hệ thống, quản lý, nhân viên, cá nhân)
- **Phê duyệt tài liệu**: nhân viên upload → "Chờ duyệt" (chưa công khai), quản lý duyệt/từ chối mới chính thức
- **Chia sẻ tài liệu**: cấp quyền (Xem / Chỉnh sửa / Quản lý) cho người dùng cụ thể qua email
- **Nhật ký hoạt động (audit log)** theo tài liệu và theo người dùng
- OCR ảnh và PDF scan (Tesseract, hỗ trợ tiếng Việt), chuyển PDF có lớp văn bản thành text trực tiếp
- Trích xuất văn bản Word/Excel/PowerPoint (`.docx`, `.xlsx`, `.xls`, `.pptx`); `.doc`/`.ppt` tự chuyển đổi qua LibreOffice headless
- Phiên bản tài liệu (versioning)

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

## Vai trò người dùng

Hệ thống phân biệt **admin hệ thống** và **người dùng trong tổ chức / cá nhân**.

| Vai trò | Thuộc tổ chức? | Quyền |
|---|---|---|
| **Admin hệ thống** (`super_admin`) | Không | Toàn quyền hệ thống: tạo/quản lý tổ chức, quản lý người dùng, duyệt tài liệu, giám sát |
| **Quản lý** (`manager`) | Có | Quản trị nội bộ: quản lý nhân viên, tạo thư mục/tài liệu, **duyệt tài liệu của nhân viên**, toàn quyền tài liệu của tổ chức |
| **Nhân viên** (`staff`) | Có | Xem + chỉnh sửa tài liệu trong tổ chức, không xoá, không quản lý người khác; **tài liệu tự upload ở trạng thái "Chờ duyệt"** |
| **Cá nhân** (`individual`) | Không | Tự dùng riêng: upload, xem, quản lý tài liệu của chính mình (không qua duyệt) |

**Quy tắc phạm vi dữ liệu:**
- Admin hệ thống quản lý toàn bộ hệ thống.
- Quản lý & nhân viên chỉ thấy dữ liệu trong tổ chức của mình.
- Cá nhân chỉ thấy tài liệu của chính mình.
- **Tài liệu "Chờ duyệt"** (`pending`) chỉ hiển thị với người tạo và quản lý; sau khi duyệt (`approved`) mới công khai với toàn tổ chức và mới chia sẻ được.
- **Chia sẻ** cấp quyền chi tiết theo từng tài liệu: `view` (xem), `edit` (sửa), `admin` (quản lý) — áp dụng cho người ngoài tổ chức hoặc cá nhân.

**Luồng đăng ký:**
- Đăng ký **Cá nhân** → tài khoản `individual`, dùng riêng tài liệu của mình.
- Đăng ký **Tổ chức** (nhập tên tổ chức) → tạo tổ chức, người đăng ký trở thành `manager`.
- `manager` thêm/thu hồi nhân viên trong trang quản trị của tổ chức.
- `super_admin` (chủ hệ thống) tạo/quản lý mọi tổ chức từ trang Admin hệ thống.

**Cá nhân gia nhập tổ chức (quyết định thiết kế):**
- Hệ thống **không có cơ chế để người dùng `individual` tự join vào tổ chức có sẵn** (không mã mời, không link invite, không yêu cầu duyệt).
- Khi một người cần làm việc trong tổ chức, **tổ chức cung cấp tài khoản**: `manager` tạo nhân viên (`POST /api/v1/users`) hoặc `super_admin` tạo tài khoản và gán tổ chức — account do tổ chức cấp phát, người dùng đăng nhập bằng account đó.
- Triển khai này giữ cho phạm vi dữ liệu chặt chẽ và giao kiểm soát thành viên hoàn toàn cho `manager`/`super_admin`, phù hợp yêu cầu phân vai của đề bài.

## Tech stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19, React Router, Vite 8, TypeScript |
| Backend | FastAPI (Python) |
| Cơ sở dữ liệu | PostgreSQL |
| Vector Database | Qdrant (hoặc Chroma) |
| OCR | Tesseract / PyMuPDF |
| LLM | LLM API (OpenAI, Gemini...) |
| Triển khai | Docker Compose, Nginx |

## Cấu trúc dự án

```
ai-document-manager/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── api/                 # authApi, documentApi, folderApi, chatApi
│   │   ├── components/          # DocumentCard, UploadDocument, FolderTree, SearchBar, ChatBox, DocumentPreview
│   │   │   └── ui/              # Button, PasswordInput, AuthIntro, Spinner
│   │   ├── pages/               # Login, Register, ForgotPassword, ResetPassword, Dashboard, Documents, DocumentDetail, Profile, Search, Chat, Admin
│   │   ├── layouts/             # MainLayout
│   │   ├── context/             # AuthContext (auth context + provider)
│   │   ├── hooks/               # useAuth
│   │   ├── utils/               # format, roles, documentMeta
│   │   ├── types.ts             # shared API types
│   │   ├── index.css
│   │   ├── App.tsx              # định nghĩa routes
│   │   └── main.tsx
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf               # SPA + proxy /api
│
├── backend/                     # FastAPI
│   ├── alembic/                 # migration schema (Alembic)
│   │   └── versions/
│   ├── alembic.ini
│   └── app/
│       ├── main.py              # entry point
│       ├── api/
│       │   ├── dependencies.py  # get_current_user, get_db
│       │   └── routes/          # auth, users, folders, documents, search, chat, admin
│       ├── core/                # config, security, exceptions
│       ├── database/            # connection, base
│       ├── models/              # organization, user, folder, document, document_version, permission, audit_log, chat
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
cp .env.example .env   # lần đầu
docker compose up --build
```
- Website: http://localhost
- API + Swagger: http://localhost:8000/docs
- pgAdmin (quản lý DB): http://localhost:5050 — đăng nhập bằng `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` (trong `.env`). Server **"AI Document Manager DB"** đã được đăng ký sẵn (host `db`, user `postgres`). Khi mở server lần đầu, nhập `POSTGRES_PASSWORD` (mặc định `postgres`) và tick **Save Password** — lần sau tự vào, không hỏi lại.

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
| POST | `/api/v1/auth/register` | Đăng ký (cá nhân / tạo tổ chức → manager) | ✅ |
| POST | `/api/v1/auth/login` | Đăng nhập, nhận token | ✅ |
| GET | `/api/v1/auth/me` | Thông tin người dùng hiện tại | ✅ |
| PUT | `/api/v1/auth/me` | Cập nhật hồ sơ (tên, email, mật khẩu) | ✅ |
| POST | `/api/v1/auth/forgot-password` | Gửi yêu cầu đặt lại mật khẩu (trả link reset chỉ khi bật `EXPOSE_RESET_TOKEN=true`) | ✅ |
| GET | `/api/v1/auth/reset-password/validate` | Kiểm tra token đặt lại mật khẩu | ✅ |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu bằng token | ✅ |
| GET | `/api/v1/users` | Danh sách user (manager: trong org; super_admin: tất cả) | ✅ |
| POST | `/api/v1/users` | Thêm nhân viên (manager thêm vào org của mình) | ✅ |
| DELETE | `/api/v1/users/{id}` | Xoá nhân viên (manager) / bất kỳ user (super_admin) | ✅ |
| GET | `/api/v1/users/lookup?email=...` | Tra cứu user theo email (dùng cho chia sẻ) | ✅ |
| GET | `/api/v1/admin/organizations` | Danh sách tổ chức (super_admin) | ✅ |
| POST | `/api/v1/admin/organizations` | Tạo tổ chức (super_admin) | ✅ |
| GET | `/api/v1/admin/organizations/{id}` | Chi tiết tổ chức + thành viên (super_admin) | ✅ |
| DELETE | `/api/v1/admin/organizations/{id}` | Xoá tổ chức (super_admin) | ✅ |
| GET | `/api/v1/admin/users` | Danh sách mọi người dùng (super_admin) | ✅ |
| GET/POST | `/api/v1/folders` | Danh sách / tạo thư mục | ✅ |
| PUT/DELETE | `/api/v1/folders/{id}` | Đổi tên / xoá thư mục | ✅ |
| GET/POST | `/api/v1/documents` | Danh sách / upload tài liệu (staff → trạng thái chờ duyệt) | ✅ |
| GET/PUT/DELETE | `/api/v1/documents/{id}` | Chi tiết / cập nhật / xoá tài liệu | ✅ |
| GET | `/api/v1/documents/{id}/download` | Tải tài liệu | ✅ |
| GET | `/api/v1/documents/{id}/versions` | Lịch sử phiên bản | ✅ |
| GET/POST/DELETE | `/api/v1/documents/{id}/permissions` | Danh sách / thêm / thu hồi quyền chia sẻ | ✅ |
| POST | `/api/v1/documents/{id}/approval` | Duyệt / từ chối tài liệu | ✅ |
| GET | `/api/v1/documents/{id}/approvals` | Lịch sử phê duyệt | ✅ |
| GET | `/api/v1/documents/{id}/audit-logs` | Nhật ký hoạt động của tài liệu | ✅ |
| GET | `/api/v1/audit-logs?user_id=...` | Nhật ký hoạt động theo người dùng | ✅ |
| GET | `/api/v1/search?q=...` | Tìm kiếm ngữ nghĩa | ⏳ |
| POST | `/api/v1/chat` | Hỏi đáp theo tài liệu (RAG) | ⏳ |

> ✅ = đã triển khai, ⏳ = chưa triển khai. Tài liệu API đầy đủ tại `/docs` (Swagger UI).

## Cơ sở dữ liệu

Schema được quản lý bằng **Alembic** (`backend/alembic/`), áp bằng:

```bash
cd backend
alembic upgrade head
```

### Tạo tài khoản admin hệ thống + dữ liệu demo

`super_admin` (chủ hệ thống) **không đăng ký qua API** — tạo bằng script seed:

```bash
cd backend
$env:PYTHONPATH = "D:\TTTN\AI-Document-Manager\backend"   # Windows
python ..\scripts\seed_data.py
```

Kết quả tạo:
- `super_admin`: `admin@example.com` / `Admin@2026!` (đổi qua env `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`)
- 2 tổ chức demo (`Cong ty Alpha`, `Truong Dai hoc Beta`) — mỗi org có 1 manager + 2 staff
- 1 cá nhân (`individual.z@example.com` / `Demo@2026!`)

Tất cả tài khoản demo dùng mật khẩu `Demo@2026!`. Mật khẩu này chỉ dùng cho môi trường demo; trong sản xuất hãy đổi qua biến môi trường hoặc đổi mật khẩu sau khi đăng nhập.

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin hệ thống | `admin@example.com` | `Admin@2026!` |
| Quản lý org Alpha | `manager.alpha@example.com` | `Demo@2026!` |
| Nhân viên org Alpha | `staff.a1@example.com` | `Demo@2026!` |
| Quản lý org Beta | `manager.beta@example.com` | `Demo@2026!` |
| Cá nhân | `individual.z@example.com` | `Demo@2026!` |

| Bảng | Mô tả |
|---|---|
| `organizations` | Tổ chức (tên, ngày tạo) |
| `users` | Người dùng (full_name, email, hashed_password, role, organization_id) |
| `folders` | Thư mục, hỗ trợ cây phân cấp (parent_id), theo tổ chức/cá nhân |
| `documents` | Tài liệu (title, file_path, folder_id, owner_id, status, processing_status, current_version, extracted_text, processing_error) |
| `document_versions` | Phiên bản tài liệu |
| `permissions` | Phân quyền truy cập theo tài liệu (view/edit/admin) |
| `document_approvals` | Lịch sử phê duyệt (reviewer, decision approved/rejected, lý do) |
| `audit_logs` | Nhật ký chỉnh sửa (theo tài liệu và người dùng) |
| `chats` | Hội thoại hỏi đáp |
| `chat_messages` | Tin nhắn trong hội thoại (role, content) |
| `password_reset_tokens` | Token đặt lại mật khẩu (hạn 60 phút, dùng 1 lần) |

**Trạng thái tài liệu:**

Hai cột riêng biệt, không đè lên nhau:

- `documents.status` — **trạng thái phê duyệt**:
  - `pending` — chờ duyệt (staff mới upload, chưa công khai, chưa chia sẻ được)
  - `approved` — đã duyệt, chính thức (công khai với toàn tổ chức, chia sẻ được)
  - `rejected` — bị từ chối duyệt (kèm lý do)
- `documents.processing_status` — **trạng thái xử lý AI**:
  - `uploaded` — vừa tải lên, chưa xử lý
  - `processing` — đang trích xuất văn bản (tự động sau upload)
  - `text_extracted` — đã trích xuất xong văn bản
  - `failed` — trích xuất văn bản thất bại (kèm `processing_error`)

Text đã trích xuất được lưu vào cột `documents.extracted_text` (dùng cho tìm kiếm/RAG ở giai đoạn sau).

Ngoài ra, embeddings của tài liệu được lưu trong **Qdrant** (vector database) phục vụ tìm kiếm ngữ nghĩa và RAG.

**Sơ đồ ERD đầy đủ**: [`docs/diagrams/ERD.md`](docs/diagrams/ERD.md) (Mermaid, hiển thị trên GitHub).

## Luồng sử dụng

```
Đăng ký (Cá nhân / Tạo tổ chức)
        │
        ▼
Đăng nhập → chuyển theo vai trò:
  ├── Admin hệ thống → trang quản trị tổ chức & người dùng
  ├── Quản lý (manager) → quản lý nhân viên + toàn quyền tài liệu của tổ chức
  ├── Nhân viên (staff) → xem/chỉnh sửa tài liệu trong tổ chức
  └── Cá nhân (individual) → tài liệu riêng của mình
        │
        ▼
Upload tài liệu (PDF/ảnh/DOCX)
        │
        ▼
Phê duyệt (chỉ tài liệu do nhân viên upload):
  ├── Staff upload → trạng thái "Chờ duyệt" (chưa công khai, chưa chia sẻ được)
  ├── Manager xem → Duyệt (→ "Đã duyệt", chính thức) hoặc Từ chối (kèm lý do)
  └── Sau khi duyệt → công khai toàn tổ chức + chia sẻ / quản lý phiên bản
        │
        ▼
Xử lý tự động (Giai đoạn 3):
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
Admin hệ thống: quản lý tổ chức, người dùng, giám sát hệ thống
```

## Làm việc nhóm

Quy tắc chung để cả nhóm cùng tiến mà không đụng độ code và không hỏng DB.

### 1. Git workflow
- Tạo **nhánh riêng** cho từng việc: `git checkout -b feat/ocr`, `fix/status-default`, `docs/readme`...
- Tên nhánh/tên commit gợi ý: `feat:`, `fix:`, `docs:`, `refactor:`.
- Trước khi bắt đầu: `git pull`. Khi xong: push và **tạo Pull Request** (dùng GitHub) để người khác review.
- Chỉ merge lên nhánh chính khi PR được duyệt và **build/test pass** (`npm run build` + backend import OK).
- Không tự ý commit file `.env`, `storage/uploads/*`, `node_modules/`, `dist/` (đã có `.gitignore`).

### 2. Không lộ bí mật
- `.env` **không bao giờ commit**. Muốn thêm biến mới → thêm vào `.env.example` (giá trị mẫu) để cả nhóm copy được.
- Bất kỳ ai nhận project: `cp .env.example .env` rồi sửa `SECRET_KEY` thành chuỗi riêng.

### 3. Thay đổi cơ sở dữ liệu
- Sửa model trong `backend/app/models/` **bắt buộc** đi kèm migration Alembic — không sửa DB tay.
```bash
cd backend
alembic revision --autogenerate -m "mô tả"
alembic upgrade head
```
- Mọi thành viên sau khi `git pull` có migration mới: chạy `alembic upgrade head` (hoặc dùng lệnh migrate ở mục 4). Alembic sẽ tự bỏ qua migration đã chạy.

### 4. Cheat-sheet Docker (mỗi người tự chạy trên máy mình)
```bash
docker compose up -d --build      # build + chạy toàn bộ stack
docker compose up -d --build backend   # chỉ build lại backend
docker compose ps                 # xem trạng thái
docker compose logs -f backend    # xem log backend
docker compose restart            # khởi động lại
docker compose down               # dừng (giữ dữ liệu trong volume)
docker compose down -v            # dừng + XOÁ toàn bộ dữ liệu (cẩn thận!)
docker compose exec db psql -U postgres -d ai_document_manager   # truy vấn DB
python scripts/seed_data.py       # seed dữ liệu demo + admin
```
- Quy trình pull mới: `git pull` → `docker compose up -d --build` → `alembic upgrade head` (nếu có migration mới) → seed lại nếu cần.
- Khi cài thêm package: **backend** sửa `backend/requirements.txt` (không `pip install` rồi quên), **frontend** `npm install <pkg>` — cả hai đều cần rebuild image.

### 5. Kiểm tra trước khi push
- Backend: `python -c "import app.main"` (không lỗi import).
- Frontend: `cd frontend && npm run build` và `npm run lint`.
- Chạy thử luồng chính: đăng nhập → upload tài liệu → mở chi tiết (xem OCR/text) → duyệt tài liệu.

## Sản phẩm

- Website (React)
- REST API (FastAPI, Swagger UI tại `/docs`)
- Docker (frontend + backend + PostgreSQL + Qdrant)
- Tài liệu kỹ thuật (`docs/`)

## Trạng thái phát triển

> Dự án phát triển theo từng giai đoạn, mỗi giai đoạn hoàn thiện một mảng tính năng. Toàn bộ **schema DB đã dựng đủ** (11 bảng) ngay từ đầu.

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Hạ tầng: FastAPI + PostgreSQL + Alembic, `GET /` và `GET /health` | ✅ Hoàn thành |
| 1 | Auth + Vai trò: đăng ký (cá nhân / tổ chức), đăng nhập, JWT, quản lý người dùng, quên mật khẩu, hồ sơ cá nhân | ✅ Hoàn thành |
| 2 | Documents + Folders: upload, CRUD theo phạm vi vai trò | ✅ Hoàn thành |
| 3 | Pipeline AI: PDF→text, OCR, chunk, embedding, Qdrant / Chroma | 🔄 Đang triển khai (đã có trích xuất văn bản PDF khi upload + **OCR ảnh/PDF scan bằng Tesseract**) |
| 4 | Search + Chat (RAG) | ⏳ Chưa bắt đầu |
| 5 | Nâng cao: permissions chi tiết, version, audit log | ✅ Hoàn thành (chia sẻ, phê duyệt, nhật ký) |

> ✅ = hoàn thành, 🔄 = đang triển khai, ⏳ = chưa bắt đầu.

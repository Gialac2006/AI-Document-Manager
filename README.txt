ai-document-manager/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── authApi.js
│   │   │   ├── documentApi.js
│   │   │   ├── folderApi.js
│   │   │   └── chatApi.js
│   │   │
│   │   ├── components/
│   │   │   ├── DocumentCard.jsx
│   │   │   ├── UploadDocument.jsx
│   │   │   ├── FolderTree.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   └── ChatBox.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DocumentsPage.jsx
│   │   │   ├── DocumentDetailPage.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   └── AdminPage.jsx
│   │   │
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── Dockerfile
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── folders.py
│   │   │       ├── documents.py
│   │   │       ├── search.py
│   │   │       ├── chat.py
│   │   │       └── admin.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── exceptions.py
│   │   │
│   │   ├── database/
│   │   │   ├── connection.py
│   │   │   └── base.py
│   │   │
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── folder.py
│   │   │   ├── document.py
│   │   │   ├── document_version.py
│   │   │   ├── permission.py
│   │   │   ├── audit_log.py
│   │   │   └── chat.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── folder.py
│   │   │   ├── document.py
│   │   │   ├── search.py
│   │   │   └── chat.py
│   │   │
│   │   ├── repositories/
│   │   │   ├── user_repository.py
│   │   │   ├── folder_repository.py
│   │   │   └── document_repository.py
│   │   │
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── document_service.py
│   │   │   ├── storage_service.py
│   │   │   ├── extraction_service.py
│   │   │   ├── ocr_service.py
│   │   │   ├── chunking_service.py
│   │   │   ├── embedding_service.py
│   │   │   ├── vector_service.py
│   │   │   ├── summary_service.py
│   │   │   └── rag_service.py
│   │   │
│   │   └── utils/
│   │       ├── file_utils.py
│   │       └── text_utils.py
│   │
│   ├── migrations/
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── storage/
│   └── uploads/
│
├── docs/
│   ├── requirements/
│   ├── diagrams/
│   ├── api/
│   ├── database/
│   └── test-cases/
│
├── scripts/
│   ├── init_database.sql
│   └── seed_data.py
│
├── .env.example
├── .gitignore
├── compose.yaml
└── README.md

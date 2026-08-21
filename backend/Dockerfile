FROM python:3.11-slim

WORKDIR /app

# Tesseract OCR + gói ngôn ngữ tiếng Việt + font DejaVu (để render ảnh test / xử lý văn bản)
# hunspell-vie: từ điển tiếng Việt dùng để sửa lỗi chính tả sau OCR
# LibreOffice writer/impress: chuyển đổi .doc/.ppt đời cũ sang .docx/.pptx để trích xuất
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-vie \
        hunspell-vi \
        fonts-dejavu-core \
        libreoffice-writer \
        libreoffice-impress \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
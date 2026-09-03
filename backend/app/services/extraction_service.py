import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pymupdf

# Định dạng text thuần có thể đọc trực tiếp không cần OCR/thư viện đọc tài liệu
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}

# Định dạng ảnh cần OCR để lấy văn bản
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif"}

# Định dạng Office đọc trực tiếp bằng thư viện Python
WORD_EXTENSIONS = {".docx"}
EXCEL_EXTENSIONS = {".xlsx", ".xls"}
POWERPOINT_EXTENSIONS = {".pptx"}

# Định dạng Office đời cũ phải chuyển đổi qua LibreOffice trước khi đọc
# (.doc → .docx, .ppt → .pptx rồi dùng handler tương ứng)
LEGACY_OFFICE_MAP = {".doc": ".docx", ".ppt": ".pptx"}


class TextExtractionError(Exception):
    """Lỗi xảy ra trong quá trình trích xuất văn bản từ tài liệu."""


def extract_text(file_path: str | Path) -> str:
    """
    Đọc và trả về nội dung văn bản của file tài liệu.

    - PDF có sẵn lớp văn bản: đọc bằng PyMuPDF.
    - Ảnh và PDF scan: xử lý bằng OCR (Tesseract) qua ocr_service.
    - DOCX/XLSX/XLS/PPTX: đọc bằng python-docx / openpyxl / xlrd / python-pptx.
    - DOC/PPT: chuyển đổi sang DOCX/PPTX bằng LibreOffice headless rồi đọc lại.
    """
    extracted_text, _ = extract_text_with_pages(file_path)
    return extracted_text


def extract_text_with_pages(file_path: str | Path) -> tuple[str, list[str] | None]:
    """
    Đọc tài liệu và trả về (văn bản đầy đủ, danh sách văn bản theo từng trang).

    pages là None với những định dạng không có khái niệm trang thật
    (txt, docx, xlsx...). PDF và ảnh OCR luôn trả về danh sách trang,
    giúp bước chunking gắn số trang cho từng chunk.
    """

    # Chuyển đường dẫn dạng chuỗi thành đối tượng Path để kiểm tra file dễ hơn
    path = Path(file_path)

    # Kiểm tra đường dẫn có trỏ tới một file thật hay không
    if not path.exists() or not path.is_file():
        raise TextExtractionError(f"Không tìm thấy file: {path}")

    suffix = path.suffix.lower()

    # File text thuần: đọc trực tiếp nội dung — không có khái niệm trang
    if suffix in TEXT_EXTENSIONS:
        return _read_text_file(path), None

    # File ảnh: một ảnh tương đương một trang
    if suffix in IMAGE_EXTENSIONS:
        from app.services.ocr_service import ocr_image

        page_text = ocr_image(path)
        return page_text, [page_text]

    # File Word (.docx): đọc bằng python-docx
    if suffix in WORD_EXTENSIONS:
        return _extract_docx(path), None

    # File Excel (.xlsx/.xls): đọc bằng openpyxl hoặc xlrd
    if suffix in EXCEL_EXTENSIONS:
        return _extract_excel(path), None

    # File PowerPoint (.pptx): đọc bằng python-pptx
    if suffix in POWERPOINT_EXTENSIONS:
        return _extract_pptx(path), None

    # File Office đời cũ (.doc/.ppt): chuyển đổi qua LibreOffice rồi đọc lại
    if suffix in LEGACY_OFFICE_MAP:
        return _extract_legacy_office(path), None

    # Hiện tại pipeline mới hỗ trợ trích xuất trực tiếp từ PDF
    if suffix != ".pdf":
        raise TextExtractionError(
            f"Chưa hỗ trợ trích xuất file có định dạng: {suffix}"
        )

    page_texts: list[str] = []

    try:
        # QUAN TRỌNG: Mở file PDF bằng thư viện PyMuPDF
        with pymupdf.open(str(path)) as pdf:
            # PDF có mật khẩu sẽ không thể đọc nếu chưa được mở khóa
            if pdf.needs_pass:
                raise TextExtractionError(
                    "PDF được bảo vệ bằng mật khẩu nên không thể xử lý"
                )

            # QUAN TRỌNG: Đọc lần lượt từng trang của PDF
            for page in pdf:
                page_text = page.get_text("text").strip()

                # Chỉ lưu những trang thực sự lấy được văn bản
                if page_text:
                    page_texts.append(page_text)

    except TextExtractionError:
        # Giữ nguyên những lỗi do chúng ta chủ động tạo ở phía trên
        raise
    except Exception as error:
        # Chuyển lỗi của PyMuPDF thành lỗi dễ hiểu cho hệ thống
        raise TextExtractionError(
            f"Không thể đọc nội dung PDF: {path.name}"
        ) from error

    # Ghép văn bản của các trang thành một nội dung hoàn chỉnh
    extracted_text = "\n\n".join(page_texts).strip()

    # Nếu PDF không lấy được chữ, nhiều khả năng đây là PDF scan → chuyển qua OCR
    if not extracted_text:
        from app.services.ocr_service import ocr_pdf_pages

        page_texts = ocr_pdf_pages(path)
        extracted_text = "\n\n".join(page_texts).strip()
        if not page_texts:
            raise TextExtractionError(
                f"Không nhận diện được chữ trong PDF scan {path.name}"
            )

    return extracted_text, page_texts


def _read_text_file(path: Path) -> str:
    # Thử đọc UTF-8 trước, nếu lỗi thì fallback sang latin-1 để không mất dữ liệu
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="latin-1")
    if not text.strip():
        raise TextExtractionError(f"File {path.name} không chứa nội dung văn bản")
    return text.strip()


def _extract_docx(path: Path) -> str:
    """Đọc file Word .docx: duyệt paragraph và bảng theo đúng thứ tự trong tài liệu."""
    from docx import Document as DocxDocument
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        document = DocxDocument(str(path))
    except Exception as error:
        raise TextExtractionError(
            f"Không thể đọc nội dung Word: {path.name}"
        ) from error

    parts: list[str] = []

    # Duyệt phần body theo thứ tự gốc để giữ đúng mạch văn bản (đoạn ↔ bảng xen kẽ)
    for element in document.element.body.iterchildren():
        tag = element.tag.rsplit("}", 1)[-1]

        # Đoạn văn thông thường
        if tag == "p":
            text = Paragraph(element, document).text.strip()
            if text:
                parts.append(text)

        # Bảng: mỗi dòng ghép các ô không rỗng bằng dấu " | "
        elif tag == "tbl":
            for row in Table(element, document).rows:
                cells = [cell.text.strip() for cell in row.cells]
                cells = [cell for cell in cells if cell]
                if cells:
                    parts.append(" | ".join(cells))

    extracted = "\n".join(parts).strip()
    if not extracted:
        raise TextExtractionError(
            f"File Word {path.name} không chứa nội dung văn bản"
        )
    return extracted


def _extract_excel(path: Path) -> str:
    """Đọc file Excel: .xlsx dùng openpyxl, .xls đời cũ dùng xlrd."""
    if path.suffix.lower() == ".xls":
        return _extract_xls(path)
    return _extract_xlsx(path)


def _extract_xlsx(path: Path) -> str:
    from openpyxl import load_workbook

    try:
        # data_only=True: lấy giá trị đã tính thay vì công thức
        workbook = load_workbook(str(path), read_only=True, data_only=True)
    except Exception as error:
        raise TextExtractionError(
            f"Không thể đọc nội dung Excel: {path.name}"
        ) from error

    parts: list[str] = []
    with workbook:
        # Duyệt lần lượt từng sheet trong workbook
        for sheet in workbook.worksheets:
            rows: list[str] = []
            for row in sheet.iter_rows(values_only=True):
                cells = ["" if value is None else str(value).strip() for value in row]
                cells = [cell for cell in cells if cell]
                if cells:
                    rows.append(" | ".join(cells))
            if rows:
                parts.append(f"--- Sheet: {sheet.title} ---")
                parts.extend(rows)

    extracted = "\n".join(parts).strip()
    if not extracted:
        raise TextExtractionError(
            f"File Excel {path.name} không chứa nội dung dữ liệu"
        )
    return extracted


def _extract_xls(path: Path) -> str:
    import xlrd

    try:
        # xlrd 2.x chỉ hỗ trợ định dạng .xls đời cũ — đúng mục đích ở đây
        workbook = xlrd.open_workbook(str(path))
    except Exception as error:
        raise TextExtractionError(
            f"Không thể đọc nội dung Excel: {path.name}"
        ) from error

    parts: list[str] = []
    for sheet in workbook.sheets():
        rows: list[str] = []
        for row_index in range(sheet.nrows):
            cells = [str(value).strip() for value in sheet.row_values(row_index)]
            cells = [cell for cell in cells if cell]
            if cells:
                rows.append(" | ".join(cells))
        if rows:
            parts.append(f"--- Sheet: {sheet.name} ---")
            parts.extend(rows)

    extracted = "\n".join(parts).strip()
    if not extracted:
        raise TextExtractionError(
            f"File Excel {path.name} không chứa nội dung dữ liệu"
        )
    return extracted


def _extract_pptx(path: Path) -> str:
    """Đọc file PowerPoint .pptx: text trong shape, bảng và ghi chú của từng slide."""
    from pptx import Presentation

    try:
        presentation = Presentation(str(path))
    except Exception as error:
        raise TextExtractionError(
            f"Không thể đọc nội dung PowerPoint: {path.name}"
        ) from error

    def _collect_shape_texts(shape, texts: list[str]) -> None:
        # Shape dạng nhóm: đệ quy vào từng shape con bên trong
        if shape.shape_type == 6:  # MSO_SHAPE_TYPE.GROUP
            for child in shape.shapes:
                _collect_shape_texts(child, texts)
            return

        # Bảng: mỗi dòng ghép các ô không rỗng bằng dấu " | "
        if getattr(shape, "has_table", False) and shape.has_table:
            for row in shape.table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                cells = [cell for cell in cells if cell]
                if cells:
                    texts.append(" | ".join(cells))
            return

        # Text box / placeholder thông thường
        if shape.has_text_frame:
            for paragraph in shape.text_frame.paragraphs:
                text = "".join(run.text for run in paragraph.runs).strip()
                if text:
                    texts.append(text)

    parts: list[str] = []
    for index, slide in enumerate(presentation.slides, start=1):
        slide_texts: list[str] = []
        for shape in slide.shapes:
            _collect_shape_texts(shape, slide_texts)

        # Ghi chú của người thuyết trình (nếu có) cũng mang nội dung hữu ích
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                slide_texts.append(notes)

        if slide_texts:
            parts.append(f"--- Slide {index} ---")
            parts.extend(slide_texts)

    extracted = "\n".join(parts).strip()
    if not extracted:
        raise TextExtractionError(
            f"File PowerPoint {path.name} không chứa nội dung văn bản"
        )
    return extracted


def _find_libreoffice() -> str | None:
    """Tìm executable LibreOffice trên hệ thống (Linux/macOS/Windows)."""
    return shutil.which("soffice") or shutil.which("libreoffice")


def _convert_with_libreoffice(path: Path, target_ext: str) -> Path:
    """
    Chuyển đổi file Office đời cũ (.doc/.ppt) sang định dạng mới bằng
    LibreOffice headless, trả về đường dẫn file kết quả trong thư mục tạm.
    """
    soffice = _find_libreoffice()
    if not soffice:
        raise TextExtractionError(
            f"Chưa hỗ trợ trích xuất file {path.suffix.lower()} trên môi trường này "
            "(cần cài LibreOffice để chuyển đổi)"
        )

    tmp_dir = tempfile.mkdtemp(prefix="docmgr_convert_")
    try:
        # HOME riêng trong thư mục tạm: LibreOffice cần nơi ghi profile khi chạy headless
        env = {**os.environ, "HOME": tmp_dir}
        subprocess.run(
            [
                soffice,
                "--headless",
                "--norestore",
                "--convert-to",
                target_ext.lstrip("."),
                "--outdir",
                tmp_dir,
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
            env=env,
        )
        converted = Path(tmp_dir) / f"{path.stem}.{target_ext.lstrip('.')}"
        if not converted.exists():
            raise TextExtractionError(
                f"Không thể chuyển đổi file {path.name} "
                f"sang {target_ext} bằng LibreOffice"
            )
        return converted
    except subprocess.TimeoutExpired as error:
        raise TextExtractionError(
            f"Chuyển đổi file {path.name} quá thời gian chờ (120s)"
        ) from error
    except OSError as error:
        raise TextExtractionError(
            f"Không thể chạy LibreOffice để xử lý file {path.name}"
        ) from error


def _extract_legacy_office(path: Path) -> str:
    """
    Xử lý .doc/.ppt: chuyển sang .docx/.pptx bằng LibreOffice rồi gọi
    handler đọc định dạng mới. File tạm được xoá sau khi đọc xong.
    """
    target_ext = LEGACY_OFFICE_MAP[path.suffix.lower()]
    converted = _convert_with_libreoffice(path, target_ext)
    try:
        if target_ext == ".docx":
            return _extract_docx(converted)
        return _extract_pptx(converted)
    finally:
        # Dọn dẹp cả thư mục tạm chứa file đã chuyển đổi
        shutil.rmtree(converted.parent, ignore_errors=True)

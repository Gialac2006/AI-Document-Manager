from pathlib import Path

import pymupdf


class TextExtractionError(Exception):
    """Lỗi xảy ra trong quá trình trích xuất văn bản từ tài liệu."""


def extract_text(file_path: str | Path) -> str:
    """
    Đọc và trả về nội dung văn bản của một file PDF.

    Hiện tại hàm chỉ hỗ trợ PDF có sẵn lớp văn bản.
    PDF scan hoặc PDF chỉ chứa hình ảnh sẽ được xử lý bằng OCR ở bước sau.
    """

    # Chuyển đường dẫn dạng chuỗi thành đối tượng Path để kiểm tra file dễ hơn
    path = Path(file_path)

    # Kiểm tra đường dẫn có trỏ tới một file thật hay không
    if not path.exists() or not path.is_file():
        raise TextExtractionError(f"Không tìm thấy file: {path}")

    # Hiện tại pipeline mới hỗ trợ trích xuất trực tiếp từ PDF
    if path.suffix.lower() != ".pdf":
        raise TextExtractionError(
            f"Chưa hỗ trợ trích xuất file có định dạng: {path.suffix}"
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

    # QUAN TRỌNG: Ghép văn bản của các trang thành một nội dung hoàn chỉnh
    extracted_text = "\n\n".join(page_texts).strip()

    # Nếu PDF không lấy được chữ, nhiều khả năng đây là PDF scan
    if not extracted_text:
        raise TextExtractionError(
            "PDF không có lớp văn bản hoặc chỉ chứa hình ảnh; tài liệu này cần OCR"
        )

    return extracted_text

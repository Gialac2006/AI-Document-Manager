import re
import unicodedata


def clean_text(text: str) -> str:
    """
    Làm sạch văn bản được trích xuất từ PDF.

    Hàm chuẩn hóa xuống dòng, loại bỏ ký tự lỗi và khoảng trắng thừa,
    đồng thời giữ lại ranh giới giữa các đoạn văn.
    """

    # Không xử lý nếu văn bản rỗng hoặc chỉ chứa khoảng trắng
    if not text or not text.strip():
        return ""

    # Chuẩn hóa các kiểu xuống dòng của Windows và Linux về cùng dạng \n
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Loại bỏ dấu gạch nối ẩn và ký tự null thường xuất hiện khi đọc PDF
    text = text.replace("\u00ad", "").replace("\x00", "")

    # Một số PDF sử dụng font riêng để hiển thị biểu tượng đầu dòng.
    # Những ký tự này thuộc vùng Unicode Private Use và không mang nội dung thật.
    text = "".join(
        " " if unicodedata.category(character) == "Co" else character
        for character in text
    )

    # Xóa khoảng trắng thừa ở đầu, cuối và bên trong từng dòng
    cleaned_lines = [
        re.sub(r"[ \t]+", " ", line).strip()
        for line in text.split("\n")
    ]

    paragraphs: list[str] = []
    current_paragraph: list[str] = []

    # Ghép các dòng liên tiếp thành một đoạn văn.
    # Dòng trống được xem là ranh giới giữa hai đoạn.
    for line in cleaned_lines:
        if line:
            current_paragraph.append(line)
        elif current_paragraph:
            paragraphs.append(" ".join(current_paragraph))
            current_paragraph = []

    # Lưu đoạn cuối nếu văn bản không kết thúc bằng dòng trống
    if current_paragraph:
        paragraphs.append(" ".join(current_paragraph))

    # Giữ hai ký tự xuống dòng giữa các đoạn để phục vụ việc chia chunk
    return "\n\n".join(paragraphs).strip()


def _find_chunk_end(
    text: str,
    start: int,
    proposed_end: int,
    chunk_size: int,
) -> int:
    """
    Tìm vị trí kết thúc phù hợp cho một chunk.

    Hàm ưu tiên cắt ở cuối đoạn, sau đó đến cuối câu và cuối cùng
    là khoảng trắng, nhằm hạn chế cắt ngang câu hoặc từ.
    """

    # Chỉ tìm điểm cắt từ 60% kích thước chunk trở đi,
    # tránh tạo ra những chunk quá ngắn.
    minimum_end = start + int(chunk_size * 0.6)

    # Ưu tiên 1: cắt tại ranh giới giữa hai đoạn văn
    paragraph_end = text.rfind("\n\n", minimum_end, proposed_end)
    if paragraph_end != -1:
        return paragraph_end

    # Ưu tiên 2: cắt sau dấu kết thúc câu
    sentence_ends = [
        text.rfind(mark, minimum_end, proposed_end)
        for mark in (". ", "? ", "! ")
    ]
    sentence_end = max(sentence_ends)

    if sentence_end != -1:
        return sentence_end + 1

    # Ưu tiên 3: cắt tại khoảng trắng để không chia đôi một từ
    space_end = text.rfind(" ", minimum_end, proposed_end)
    if space_end != -1:
        return space_end

    # Nếu không tìm được vị trí phù hợp, sử dụng giới hạn ban đầu
    return proposed_end


def split_text(
    text: str,
    *,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[str]:
    """
    Làm sạch và chia văn bản thành nhiều chunk.

    chunk_size là số ký tự tối đa của mỗi chunk.
    overlap là số ký tự được lặp lại giữa hai chunk liên tiếp,
    giúp giữ ngữ cảnh khi tạo embedding và tìm kiếm trong Qdrant.
    """

    # Kiểm tra cấu hình để tránh vòng lặp hoặc chunk không hợp lệ
    if chunk_size <= 0:
        raise ValueError("chunk_size phải lớn hơn 0")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap phải từ 0 đến nhỏ hơn chunk_size")

    # Luôn làm sạch văn bản trước khi chia
    cleaned_text = clean_text(text)

    if not cleaned_text:
        return []

    chunks: list[str] = []
    start = 0
    text_length = len(cleaned_text)

    while start < text_length:
        # Xác định giới hạn tối đa của chunk hiện tại
        proposed_end = min(start + chunk_size, text_length)

        # Nếu chưa đến cuối tài liệu, tìm vị trí cắt tự nhiên hơn
        if proposed_end < text_length:
            end = _find_chunk_end(
                cleaned_text,
                start,
                proposed_end,
                chunk_size,
            )
        else:
            end = proposed_end

        chunk = cleaned_text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        # Dừng vòng lặp khi đã xử lý hết văn bản
        if end >= text_length:
            break

        # Lùi lại một khoảng để chunk tiếp theo giữ được ngữ cảnh
        next_start = max(end - overlap, start + 1)

        # Điều chỉnh vị trí bắt đầu để không cắt giữa một từ
        while next_start < end and not cleaned_text[next_start].isspace():
            next_start += 1

        # Bỏ khoảng trắng ở đầu chunk tiếp theo
        while next_start < text_length and cleaned_text[next_start].isspace():
            next_start += 1

        # Bảo vệ vòng lặp trong trường hợp không tìm được vị trí mới
        if next_start <= start:
            next_start = end

        start = next_start

    return chunks

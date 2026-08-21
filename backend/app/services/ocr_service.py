import logging
import re
import threading
import unicodedata
from itertools import islice
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image

from app.services.extraction_service import TextExtractionError

logger = logging.getLogger(__name__)

MIN_OCR_SIDE = 500
MIN_UPSCALE = 2
# Diện tích tối thiểu (tỷ lệ so với ảnh gốc) để chấp nhận kết quả crop —
# tránh crop sai khi tờ giấy chiếm phần nhỏ khung hình hoặc ảnh không có nền tối rõ rệt.
MIN_CROP_AREA_RATIO = 0.3

# Kernel median blur lớn dùng để ước lượng nền khi khử bóng đổ/ánh sáng không đều
SHADOW_BLUR_KSIZE = 31

PSM_CANDIDATES = ["--psm 6", "--psm 4", "--psm 3"]

# --- Sửa lỗi chính tả tiếng Việt sau OCR bằng từ điển hunspell ---
# Ưu tiên sửa đổi "an toàn": chỉ khác dấu (ascii-fold giống nhau) hoặc
# khác tối đa 1 ký tự với từ dài >= 4. Mọi lỗi của bộ sửa đều được nuốt
# để không bao giờ làm hỏng kết quả OCR gốc.
_DICTIONARY_PATHS = (
    "/usr/share/hunspell/vi_VN",
    "/usr/share/hunspell/vi",
    "/usr/share/hunspell/vie",
)
_MAX_SUGGESTIONS = 8
_MIN_LEN_FUZZY = 4
_MAX_TOKEN_LEN = 24
_TOKEN_RE = re.compile(r"[^\W\d_]+", re.UNICODE)
# Email hoặc URL — các đoạn này được giữ nguyên khi sửa chính tả
_PROTECTED_RE = re.compile(
    r"([\w.+-]+@[\w-]+(?:\.[\w-]+)+|https?://\S+|www\.\S+)", re.UNICODE
)

# Từ chức năng tần suất rất cao mà dạng không dấu KHÔNG phải từ tiếng Việt
# hợp lệ (hoặc nghĩa gốc hiếm gặp) — sửa trực tiếp, không cần qua suggest.
_COMMON_FIXES = {
    "mot": "một",
    "hoc": "học",
    "toi": "tôi",
    "duoc": "được",
    "khong": "không",
    "va": "và",
    "co": "có",
    "phai": "phải",
    "thang": "tháng",
    "ngay": "ngày",
    "tren": "trên",
    "truoc": "trước",
    "giua": "giữa",
    "nhung": "nhưng",
    "hoac": "hoặc",
    "neu": "nếu",
    "vi": "vì",
    "de": "để",
    "can": "cần",
    "nguoi": "người",
    "nhieu": "nhiều",
    "tu": "từ",
    "di": "đi",
    "ve": "về",
    "gio": "giờ",
    "nuoc": "nước",
    "duong": "đường",
    "nguon": "nguồn",
    "chung": "chúng",
    "lam": "làm",
    "bi": "bị",
    "du": "đủ",
}

_dictionary = None
_load_finished = False
_dict_lock = threading.Lock()


def _languages() -> str:
    try:
        available = set(pytesseract.get_languages(config=""))
    except Exception as error:
        logger.warning("Không lấy được danh sách ngôn ngữ Tesseract: %s", error)
        available = set()
    if "vie" in available:
        return "vie"
    return "eng"


def _pil_to_gray_cv(image: Image.Image) -> np.ndarray:
    rgb = np.array(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def _crop_to_content(gray: np.ndarray) -> np.ndarray:
    """Cắt bỏ viền nền tối quanh ảnh trước khi deskew/binarize.

    Cần thiết với ảnh chụp có nền tối bao quanh tờ giấy (bàn, thảm...) — nếu
    không cắt, bước deskew sẽ tính góc nghiêng dựa trên cả vùng nền lẫn vùng
    chữ, cho kết quả sai.
    """
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return gray

    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < MIN_CROP_AREA_RATIO * gray.shape[0] * gray.shape[1]:
        return gray  # không đủ tin cậy, giữ nguyên ảnh gốc thay vì crop liều

    x, y, w, h = cv2.boundingRect(largest)
    return gray[y:y + h, x:x + w]


def _deskew(gray: np.ndarray) -> np.ndarray:
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))

    if coords.shape[0] < 50:
        return gray

    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle

    if abs(angle) < 0.3 or abs(angle) > 15:
        return gray

    (h, w) = gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(
        gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def _normalize_illumination(gray: np.ndarray) -> np.ndarray:
    """Khử bóng đổ và ánh sáng không đều — điểm yếu lớn nhất của ảnh chụp điện thoại.

    Ước lượng nền (tờ giấy) bằng median blur kernel lớn rồi chia ảnh gốc cho nền:
    vùng bị bóng tối sẽ được "nâng" sáng lên gần như đồng nhất, giúp bước
    threshold sau đó phân tách chữ/nền chính xác hơn hẳn. Với ảnh scan phẳng
    (nền đã đều) phép chia gần như là nhận dạng nên không gây hại.
    """
    background = cv2.medianBlur(gray, SHADOW_BLUR_KSIZE)
    return cv2.divide(gray, background, scale=255)


def _binarize_adaptive(gray: np.ndarray) -> np.ndarray:
    """Nhị phân hoá thích nghi — hiệu quả với chữ nét trên nền tương đối đồng nhất."""
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )


def _binarize_otsu(gray: np.ndarray) -> np.ndarray:
    """Nhị phân hoá toàn cục sau khi tăng cục bộ tương phản (CLAHE).

    Phù hợp ảnh chụp có bóng đổ: sau khi khử sáng không đều, Otsu giữ nét chữ
    mảnh tốt hơn adaptive (adaptive dễ ăn mòn nét mảnh thành đứt gãy).
    """
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return binary


def _prepare(image: Image.Image) -> np.ndarray:
    """Chuẩn hoá ảnh về grayscale đã xử lý: upscale → crop → deskew → denoise → khử bóng."""
    image = image.convert("RGB")
    smallest_side = min(image.size)
    if smallest_side < MIN_OCR_SIDE:
        scale = max(MIN_UPSCALE, (MIN_OCR_SIDE // smallest_side) + 1)
        image = image.resize((image.width * scale, image.height * scale), Image.LANCZOS)

    gray = _pil_to_gray_cv(image)
    gray = _crop_to_content(gray)
    gray = _deskew(gray)
    gray = cv2.fastNlMeansDenoising(gray, h=10)
    gray = _normalize_illumination(gray)
    return gray


def _ocr_confidence(image: Image.Image, lang: str, config: str) -> float:
    data = pytesseract.image_to_data(
        image, lang=lang, config=config, output_type=pytesseract.Output.DICT
    )
    confs = [int(c) for c in data.get("conf", []) if str(c) != "-1" and int(c) >= 0]
    return sum(confs) / len(confs) if confs else -1.0


def _run_tesseract(gray: np.ndarray, lang: str) -> str:
    """OCR với 2 biến thể nhị phân × nhiều PSM, chọn tổ hợp có confidence cao nhất.

    Vòng 1: so adaptive vs otsu+CLAHE bằng psm mặc định để chọn biến thể nhị phân.
    Vòng 2: trên biến thể thắng cuộc, thử các chế độ phân đoạn còn lại.
    """
    best_config, best_conf, best_image = "", -1.0, None

    # Vòng 1: chọn biến thể nhị phân tốt hơn
    round1: list[tuple[float, Image.Image]] = []
    for binarize in (_binarize_adaptive, _binarize_otsu):
        image = Image.fromarray(binarize(gray))
        config = f"{PSM_CANDIDATES[0]} --oem 3 --dpi 300"
        conf = _ocr_confidence(image, lang, config)
        round1.append((conf, image))
        if conf > best_conf:
            best_conf, best_config, best_image = conf, config, image

    winner = max(round1, key=lambda item: item[0])[1]

    # Vòng 2: thử các PSM còn lại trên biến thể nhị phân thắng cuộc
    for psm in PSM_CANDIDATES[1:]:
        config = f"{psm} --oem 3 --dpi 300"
        conf = _ocr_confidence(winner, lang, config)
        if conf > best_conf:
            best_conf, best_config, best_image = conf, config, winner

    if best_image is None:
        return ""
    return pytesseract.image_to_string(best_image, lang=lang, config=best_config).strip()


def _render_pdf_page(page) -> Image.Image:
    import io
    pix = page.get_pixmap(dpi=300)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def _load_dictionary():
    """Nạp từ điển hunspell một lần duy nhất; trả về None nếu không khả dụng."""
    global _dictionary, _load_finished
    if _load_finished:
        return _dictionary
    with _dict_lock:
        if _load_finished:
            return _dictionary
        try:
            from spylls.hunspell import Dictionary

            for base in _DICTIONARY_PATHS:
                try:
                    _dictionary = Dictionary.from_files(base)
                    break
                except (FileNotFoundError, OSError):
                    continue
            if _dictionary is None:
                logger.info(
                    "Không tìm thấy từ điển hunspell tiếng Việt — bỏ qua sửa lỗi chính tả"
                )
        except Exception as error:  # noqa: BLE001 — không để lỗi chặn luồng OCR
            logger.warning("Không nạp được bộ sửa lỗi chính tả: %s", error)
        finally:
            _load_finished = True
    return _dictionary


def _ascii_fold(word: str) -> str:
    """Bỏ toàn bộ dấu thanh + dấu phụ, quy về chữ thường: "Trản" → "tran"."""
    lowered = word.lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    without_marks = "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )
    # "đ" tồn tại ở dạng composed nên phải thay thủ công
    return without_marks.replace("đ", "d")


def _edit_distance_at_most_one(a: str, b: str) -> bool:
    """Kiểm tra nhanh khoảng cách Levenshtein giữa a và b có <= 1 hay không."""
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(1 for x, y in zip(a, b) if x != y) <= 1
    # Đảm bảo a luôn ngắn hơn (b dài hơn đúng 1 ký tự — phép chèn/xoá)
    if len(a) > len(b):
        a, b = b, a
    i = j = diffs = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1
            j += 1
        else:
            diffs += 1
            if diffs > 1:
                return False
            j += 1
    return True


def _mark_count(word: str) -> int:
    """Số ký tự mang dấu (thanh điệu + dấu phụ) trong từ."""
    decomposed = unicodedata.normalize("NFD", word)
    return sum(1 for char in decomposed if unicodedata.category(char) == "Mn")


def _pick_suggestion(original: str, suggestions) -> str | None:
    """Chọn ứng viên sửa an toàn nhất.

    OCR tiếng Việt chủ yếu MẤT dấu hoặc SAI dấu chứ hiếm khi thêm dấu thừa,
    nên trong các ứng viên "chỉ khác dấu" ưu tiên từ có nhiều dấu hơn gốc;
    chỉ khi không có mới xét ứng viên khác tối đa 1 ký tự.
    """
    folded = _ascii_fold(original)
    original_marks = _mark_count(original)

    # Ưu tiên 1: giữ nguyên bộ chữ cái, chỉ thay đổi dấu thanh/than
    mark_only = [
        candidate.lower()
        for candidate in suggestions
        if candidate.lower() != original and _ascii_fold(candidate) == folded
    ]
    if mark_only:
        # Chọn ứng viên nhiều dấu nhất; hoà thì chọn cái đầu (thứ tự suggest
        # của hunspell thường phản ánh độ phổ biến)
        best = max(mark_only, key=_mark_count)
        if _mark_count(best) >= original_marks:
            return best

    # Ưu tiên 2: khác tối đa 1 ký tự, áp dụng cho từ đủ dài để giảm rủi ro sai
    for candidate in suggestions:
        candidate = candidate.lower()
        if len(candidate) >= _MIN_LEN_FUZZY and _edit_distance_at_most_one(
            original, candidate
        ):
            return candidate

    return None


def _match_case(original: str, replacement: str) -> str:
    """Giữ nguyên kiểu viết hoa của từ gốc khi thay thế."""
    if original.isupper():
        return replacement.upper()
    if original[:1].isupper():
        return replacement.capitalize()
    return replacement.lower()


def correct_vietnamese_text(text: str) -> str:
    """Quét từng từ trong văn bản, sửa từ sai chính tả theo từ điển hunspell."""
    dictionary = _load_dictionary()
    if dictionary is None or not text:
        return text

    def replace(match) -> str:
        raw = match.group(0)
        # Bỏ qua token quá ngắn/quá dài hoặc chứa ký tự không phải chữ cái
        if len(raw) < 2 or len(raw) > _MAX_TOKEN_LEN or not raw.isalpha():
            return raw
        probe = raw.lower()
        # Từ chức năng phổ biến: sửa trực tiếp theo bảng, không cần từ điển
        fixed = _COMMON_FIXES.get(probe)
        if fixed is not None:
            return _match_case(raw, fixed)
        try:
            if dictionary.lookup(unicodedata.normalize("NFC", probe)):
                return raw
            suggestions = list(islice(dictionary.suggest(probe), _MAX_SUGGESTIONS))
        except Exception:  # noqa: BLE001 — một từ lỗi không được ảnh hưởng cả trang
            return raw
        best = _pick_suggestion(probe, suggestions)
        if best is None:
            return raw
        return _match_case(raw, best)

    try:
        # Không đụng vào email/URL — tên miền và username hay bị "sửa" nhầm
        parts = _PROTECTED_RE.split(text)
        return "".join(
            part if index % 2 else _TOKEN_RE.sub(replace, part)
            for index, part in enumerate(parts)
        )
    except Exception as error:  # noqa: BLE001 — không để lỗi chặn luồng OCR
        logger.warning("Lỗi khi sửa chính tả sau OCR: %s", error)
        return text


def _correct_text(text: str, lang: str) -> str:
    """Sửa lỗi chính tả sau OCR — chỉ áp dụng khi đang dùng từ điển tiếng Việt."""
    if "vie" not in lang:
        return text
    return correct_vietnamese_text(text)


def ocr_image(path: str | Path) -> str:
    image_path = Path(path)
    if not image_path.exists() or not image_path.is_file():
        raise TextExtractionError(f"Không tìm thấy file ảnh: {image_path}")

    lang = _languages()
    try:
        with Image.open(image_path) as image:
            text = _run_tesseract(_prepare(image), lang)
    except pytesseract.TesseractNotFoundError as error:
        raise TextExtractionError(
            "Tesseract chưa được cài đặt trên máy chủ nên không thể OCR ảnh"
        ) from error
    except (OSError, Image.UnidentifiedImageError) as error:
        raise TextExtractionError(f"Không thể đọc file ảnh: {image_path.name}") from error

    if not text:
        raise TextExtractionError(f"Không nhận diện được chữ trong ảnh {image_path.name}")
    return _correct_text(text, lang)


def ocr_pdf(path: str | Path) -> str:
    import pymupdf

    pdf_path = Path(path)
    lang = _languages()
    page_texts: list[str] = []

    try:
        with pymupdf.open(str(pdf_path)) as pdf:
            if pdf.needs_pass:
                raise TextExtractionError("PDF được bảo vệ bằng mật khẩu nên không thể xử lý")
            for page_num, page in enumerate(pdf, start=1):
                rendered = _render_pdf_page(page)
                page_text = _run_tesseract(_prepare(rendered), lang)
                if page_text:
                    page_texts.append(page_text)
                else:
                    logger.warning("Trang %d không nhận diện được chữ", page_num)
    except TextExtractionError:
        raise
    except pytesseract.TesseractNotFoundError as error:
        raise TextExtractionError(
            "Tesseract chưa được cài đặt trên máy chủ nên không thể OCR PDF"
        ) from error
    except Exception as error:
        raise TextExtractionError(f"Không thể OCR PDF: {pdf_path.name}") from error

    extracted_text = "\n\n".join(page_texts).strip()
    if not extracted_text:
        raise TextExtractionError(f"Không nhận diện được chữ trong PDF scan {pdf_path.name}")
    return _correct_text(extracted_text, lang)
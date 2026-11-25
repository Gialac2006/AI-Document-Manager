import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";

const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

interface Props {
  images: File[];
  onChange: (images: File[]) => void;
  disabled?: boolean;
  children: ReactNode;
}

export default function ChatImageInput({
  images,
  onChange,
  disabled = false,
  children,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = images.map((image) => URL.createObjectURL(image));
    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [images]);

  function addImages(files: File[]) {
    if (disabled || files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError("Mỗi lượt gửi tối đa 3 ảnh.");
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Chỉ hỗ trợ ảnh PNG, JPG và WebP.");
        return;
      }

      if (file.size === 0 || file.size > MAX_BYTES) {
        setError("Mỗi ảnh phải có dung lượng không quá 5 MB.");
        return;
      }
    }

    setError("");
    onChange([...images, ...files]);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (disabled) return;

    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length > 0) {
      event.preventDefault();
      addImages(files);
    }
  }

  function removeImage(index: number) {
    setError("");
    onChange(images.filter((_, position) => position !== index));
  }

  return (
    <div className="chat-image-input" onPaste={handlePaste}>
      {children}

      {images.length > 0 && (
        <div className="chat-image-previews" aria-label="Ảnh chờ gửi">
          {images.map((image, index) => (
            <div
              className="chat-image-preview"
              key={`${image.name}-${image.size}-${index}`}
            >
              {previews[index] && (
                <img src={previews[index]} alt={image.name} />
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={() => removeImage(index)}
                aria-label={`Xóa ảnh ${image.name}`}
              >
                ×
              </button>

              <span title={image.name}>{image.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chat-image-toolbar">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          disabled={disabled}
          onChange={(event) => {
            addImages(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />

        <button
          type="button"
          className="chat-image-add"
          disabled={disabled || images.length >= MAX_IMAGES}
          onClick={() => inputRef.current?.click()}
        >
          + Thêm ảnh
        </button>

        <span>Dán ảnh bằng Ctrl+V · Tối đa 3 ảnh, 5 MB/ảnh</span>
      </div>

      {error && (
        <p className="chat-image-validation" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
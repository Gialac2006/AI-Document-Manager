// Giá trị có thể xuất ra CSV
type CsvValue = string | number | null | undefined;

// Thoát ký tự đặc biệt trong ô CSV (dấu phẩy, nháy kép, xuống dòng)
function escapeCsv(value: CsvValue): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Tạo và tải file CSV xuống máy
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
): void {
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

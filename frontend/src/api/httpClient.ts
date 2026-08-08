const API_BASE_URL = "/api/v1";

const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/reset-password/validate",
]);

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

function getToken() {
  return localStorage.getItem("access_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("access_token", token);
  } else {
    localStorage.removeItem("access_token");
  }
}

async function extractError(response: Response) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map((e: { msg?: string }) => e.msg).join("; ");
    }
    return "Có lỗi xảy ra";
  } catch {
    return `Lỗi ${response.status}`;
  }
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export async function request<T = unknown>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {}
): Promise<T> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      cache: "no-store",
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new Error("Không thể kết nối tới máy chủ");
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      auth &&
      !PUBLIC_PATHS.has(path)
    ) {
      setToken(null);
      redirectToLogin();
    }
    throw new Error(await extractError(response));
  }

  if (response.status === 204) {
    return null as T;
  }
  return response.json();
}

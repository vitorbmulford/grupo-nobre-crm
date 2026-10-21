import type { ApiErrorResponse } from "@/types/api";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorResponse | unknown;

  constructor(
    status: number,
    message: string,
    body?: ApiErrorResponse | unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };
const API_REQUEST_TIMEOUT_MS = 30_000;

function getErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as ApiErrorResponse).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(". ");
  }
  return `A API respondeu com erro HTTP ${status}.`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const requestPath = `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
  const url = API_BASE_URL.startsWith("/") ? requestPath : new URL(requestPath);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");

  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timedOut)
      throw new ApiError(
        0,
        "A API demorou para responder. Tente novamente.",
        error,
      );
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "Não foi possível conectar à API. Verifique se o serviço está disponível.",
      error,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown;
  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => undefined);
  } else {
    body = await response.text().catch(() => "");
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      getErrorMessage(body, response.status),
      body,
    );
  return body as T;
}

export const api = {
  get: <T>(
    path: string,
    params?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return apiRequest<T>(`${path}${query.size ? `?${query}` : ""}`, {
      method: "GET",
      signal,
    });
  },
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "POST", body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "PATCH", body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "DELETE", signal }),
};

export const apiBaseUrl = API_BASE_URL;

import { getToken, removeToken } from "@/lib/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export class ApiConnectionError extends Error {
  originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = "ApiConnectionError";
    this.originalError = originalError;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  token?: string | null;
};

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function getStoredToken(): string | null {
  return getToken();
}

function getErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    const detail = body.detail ?? body.message ?? body.error;

    if (typeof detail === "string") {
      return detail;
    }

    if (detail && typeof detail === "object") {
      const nestedDetail = detail as Record<string, unknown>;
      const nestedMessage = nestedDetail.message ?? nestedDetail.detail;

      if (typeof nestedMessage === "string") {
        return nestedMessage;
      }
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const firstDetail = detail[0];

      if (firstDetail && typeof firstDetail === "object") {
        const firstMessage = (firstDetail as Record<string, unknown>).msg;

        if (typeof firstMessage === "string") {
          return firstMessage;
        }
      }
    }
  }

  return `API request failed with status ${status}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { body, headers, token, ...fetchOptions } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  let requestBody: BodyInit | undefined;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined) {
    if (isFormData || typeof body === "string") {
      requestBody = body as BodyInit;
    } else {
      requestHeaders.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  const authToken = token === undefined ? getStoredToken() : token;

  if (authToken) {
    requestHeaders.set("Authorization", `Bearer ${authToken}`);
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...fetchOptions,
      body: requestBody,
      headers: requestHeaders,
    });
  } catch (error) {
    throw new ApiConnectionError("Unable to connect to the API.", error);
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();

      if (
        typeof window !== "undefined" &&
        !["/login", "/register"].includes(window.location.pathname)
      ) {
        window.location.assign("/login");
      }
    }

    throw new ApiRequestError(
      getErrorMessage(payload, response.status),
      response.status,
      payload,
    );
  }

  return payload as TResponse;
}

export function apiGet<TResponse>(
  path: string,
  options?: Omit<ApiRequestOptions, "body" | "method">,
) {
  return apiFetch<TResponse>(path, { ...options, method: "GET" });
}

export function apiPost<TResponse>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "body" | "method">,
) {
  return apiFetch<TResponse>(path, { ...options, body, method: "POST" });
}

export function apiPut<TResponse>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "body" | "method">,
) {
  return apiFetch<TResponse>(path, { ...options, body, method: "PUT" });
}

export function apiPatch<TResponse>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "body" | "method">,
) {
  return apiFetch<TResponse>(path, { ...options, body, method: "PATCH" });
}

export function apiDelete<TResponse>(
  path: string,
  options?: Omit<ApiRequestOptions, "method">,
) {
  return apiFetch<TResponse>(path, { ...options, method: "DELETE" });
}

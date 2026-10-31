"use client";

// Every call goes to the same origin under /api/v1; next.config.mjs rewrites it to the FastAPI
// backend, so the session cookie stays first-party and no CORS is needed.
const BASE = "/api/v1";
const DEFAULT_TIMEOUT_MS = 20000;
const SAFE_METHODS = new Set(["GET", "HEAD"]);

// The CSRF token lives in memory only (never localStorage). SessionProvider sets it from
// login/register/GET /auth/session; it is restored after a refresh by GET /auth/session.
let csrfToken = null;
let onUnauthenticated = null;

export function setCsrfToken(token) {
  csrfToken = token || null;
}

/** Called once by SessionProvider: what to do when an authenticated call returns 401. */
export function setUnauthenticatedHandler(handler) {
  onUnauthenticated = handler;
}

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Field-level messages from a 422, keyed by field name. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.filter((item) => item.field).map((item) => [item.field, item.message]));
  }
}

const FALLBACK_MESSAGES = {
  0: "Could not reach the server. Check your connection and try again.",
  403: "You do not have permission to do that.",
  404: "This item was not found.",
  409: "This conflicts with the current state. Refresh and try again.",
  422: "Some of the information is not valid.",
  429: "Too many attempts. Please wait and try again.",
  500: "Something went wrong on our side. Please try again."
};

/** Builds a query string; arrays repeat the key (?technology=React&technology=AWS), empty values are dropped. */
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => item !== "" && item != null && search.append(key, item));
    else search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function parseError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error (e.g. proxy failure); fall through to a generic message.
  }
  const error = body?.error;
  return new ApiError({
    status: response.status,
    code: error?.code || `HTTP_${response.status}`,
    message: error?.message || FALLBACK_MESSAGES[response.status] || FALLBACK_MESSAGES[500],
    details: error?.details,
    requestId: response.headers.get("x-request-id")
  });
}

/**
 * request("/leads", { query, body, method, signal, timeout, redirectOn401 })
 * Returns parsed JSON (or null for 204). Throws ApiError for every non-2xx and for network failures.
 */
export async function request(path, { method = "GET", query, body, signal, timeout = DEFAULT_TIMEOUT_MS, redirectOn401 = true, raw = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeout);
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", onAbort);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method) && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let response;
  try {
    response = await fetch(`${BASE}${path}${toQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
      cache: "no-store"
    });
  } catch (error) {
    if (signal?.aborted) throw error; // the caller cancelled; let them ignore it
    const timedOut = controller.signal.reason?.name === "TimeoutError";
    throw new ApiError({ status: 0, code: timedOut ? "TIMEOUT" : "NETWORK_ERROR", message: timedOut ? "The server took too long to respond." : FALLBACK_MESSAGES[0] });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (!response.ok) {
    const error = await parseError(response);
    if (response.status === 401 && redirectOn401 && onUnauthenticated) onUnauthenticated(error);
    throw error;
  }
  if (raw) return response;
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" })
};

export function isAbortError(error) {
  return error?.name === "AbortError";
}

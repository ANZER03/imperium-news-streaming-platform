/**
 * Base URL for backend calls.
 *
 * - Empty string (default): hit `/api/...` on the same origin as the page.
 *   Next.js rewrites in `next.config.ts` proxy these to BACKEND_URL.
 *   This is the recommended setup — works in dev, containers, and prod.
 *
 * - Override with `NEXT_PUBLIC_API_URL` if you really need the browser to
 *   reach the backend directly (e.g. running against a deployed API from a
 *   local dev page). The URL must be reachable FROM THE BROWSER.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  readonly status?: number;
  readonly path: string;
  readonly cause?: unknown;
  constructor(message: string, path: string, status?: number, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.cause = cause;
  }
}

export async function fetchApi<T = void>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    // `fetch` only throws on network-layer failures: offline, DNS, CORS,
    // mixed content, aborted, etc. Surface a clear, scoped error so callers
    // (and the React error boundary) can react.
    if ((err as { name?: string })?.name === 'AbortError') {
      throw err;
    }
    throw new ApiError(
      `Network request failed for ${url}: ${(err as Error)?.message ?? 'unknown error'}`,
      path,
      undefined,
      err,
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new ApiError(
      errorText || `API error ${response.status} for ${path}`,
      path,
      response.status,
    );
  }

  // 204 No Content or empty body — return void-safe empty value
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type') || '';

  if (
    response.status === 204 ||
    contentLength === '0' ||
    !contentType.includes('application/json')
  ) {
    return undefined as unknown as T;
  }

  return response.json();
}

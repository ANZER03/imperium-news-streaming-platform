const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8999';

export async function fetchApi<T = void>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
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

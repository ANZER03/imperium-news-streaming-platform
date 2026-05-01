const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8999';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }
  return response.json();
}

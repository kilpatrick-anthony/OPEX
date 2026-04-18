export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
}

export function parseCookie(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, value] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(value || '');
    return acc;
  }, {} as Record<string, string>);
}

export async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getApiErrorMessage(response: Response, payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }
  }

  return `${fallback} (HTTP ${response.status})`;
}

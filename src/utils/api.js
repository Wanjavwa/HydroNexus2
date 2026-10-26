const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with HTTP ${response.status}`)
  }
  return payload
}

export function apiUrl(path) {
  return `${API_BASE}${path}`
}

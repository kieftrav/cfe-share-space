async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw Object.assign(new Error((data as any).error || res.statusText), { status: res.status, data })
  }
  return data as any
}

export const api = {
  get: (p: string) => req('GET', p),
  post: (p: string, b?: unknown) => req('POST', p, b ?? {}),
  put: (p: string, b?: unknown) => req('PUT', p, b ?? {}),
  del: (p: string) => req('DELETE', p),
}

export type Content = {
  id: number
  type: string
  title: string
  slug: string | null
  body_markdown: string
  parent_id: number | null
  position: number
  author_id: string | null
  status: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  last_activity_at: string
  children?: Content[]
}

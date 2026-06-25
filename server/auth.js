import { randomUUID } from 'node:crypto'
import { db } from './db.js'

const ORIGIN = process.env.ZOO_ORIGIN || 'https://www.zooniverse.org'
const CLIENT_ID = process.env.ZOO_CLIENT_ID
const CLIENT_SECRET = process.env.ZOO_CLIENT_SECRET
const REDIRECT_URI = process.env.ZOO_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
const SCOPE = process.env.ZOO_SCOPE || 'user project public'
const COOKIE = 'cfe_sid'
const TEST_MODE = process.env.CFE_TEST_MODE === '1'

export function authorizeUrl() {
  const u = new URL(`${ORIGIN}/oauth/authorize`)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', CLIENT_ID)
  u.searchParams.set('redirect_uri', REDIRECT_URI)
  u.searchParams.set('scope', SCOPE)
  return u.toString()
}

// Exchange an OOB authorization code for an access token (server-side; the secret
// never leaves the backend).
export async function exchangeCode(code) {
  const res = await fetch(`${ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`token exchange failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  return res.json() // { access_token, token_type, expires_in, refresh_token, scope }
}

export async function fetchMe(token) {
  const res = await fetch(`${ORIGIN}/api/me`, {
    headers: {
      Accept: 'application/vnd.api+json; version=1',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error(`/api/me failed (${res.status})`)
  const data = await res.json()
  const u = data.users?.[0]
  if (!u) throw new Error('/api/me returned no user')
  return {
    id: String(u.id),
    login: u.login,
    display_name: u.display_name || u.login,
    avatar_url: u.avatar_src || null,
  }
}

export function upsertUser(me) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO users (zooniverse_id, login, display_name, avatar_url, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(zooniverse_id) DO UPDATE SET
       login=excluded.login, display_name=excluded.display_name,
       avatar_url=excluded.avatar_url, last_seen=excluded.last_seen`,
  ).run(me.id, me.login, me.display_name, me.avatar_url, now)

  // Reconcile a seed role keyed by login (login:<login>) onto the real id.
  const seeded = db.prepare('SELECT role FROM roles WHERE zooniverse_id = ?').get(`login:${me.login}`)
  if (seeded) {
    db.prepare('DELETE FROM roles WHERE zooniverse_id = ?').run(`login:${me.login}`)
    db.prepare(
      `INSERT OR REPLACE INTO roles (zooniverse_id, role, granted_by, granted_at)
       VALUES (?, ?, 'seed', ?)`,
    ).run(me.id, seeded.role, now)
  }
}

export function roleOf(zooniverse_id) {
  const r = db.prepare('SELECT role FROM roles WHERE zooniverse_id = ?').get(zooniverse_id)
  return r?.role || null
}

export function createSession(zooniverse_id, token, expiry) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO sessions (id, zooniverse_id, token, expiry, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, zooniverse_id, token || '', expiry || 0, new Date().toISOString())
  return id
}

export function setSessionCookie(res, sid) {
  res.cookie(COOKIE, sid, { httpOnly: true, sameSite: 'lax', path: '/' })
}

export function clearSession(req, res) {
  const sid = req.cookies?.[COOKIE]
  if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid)
  res.clearCookie(COOKIE, { path: '/' })
}

// Middleware: resolve the session cookie → req.user = { id, login, display_name, role } | null
export function attachUser(req, _res, next) {
  req.user = null
  const sid = req.cookies?.[COOKIE]
  if (sid) {
    const s = db.prepare('SELECT zooniverse_id FROM sessions WHERE id = ?').get(sid)
    if (s) {
      const u = db.prepare('SELECT zooniverse_id, login, display_name, avatar_url FROM users WHERE zooniverse_id = ?').get(s.zooniverse_id)
      if (u) req.user = { id: u.zooniverse_id, login: u.login, display_name: u.display_name, avatar_url: u.avatar_url, role: roleOf(u.zooniverse_id) }
    }
  }
  next()
}

const RANK = { contributor: 1, admin: 2 }
// No whitelist: any authenticated Zooniverse user is treated as a contributor.
// An explicit 'admin' role is still required for admin-only surfaces.
function effectiveRank(user) {
  if (!user) return 0
  return RANK[user.role] || RANK.contributor
}
export function requireRole(min) {
  return (req, res, next) => {
    if (effectiveRank(req.user) >= RANK[min]) return next()
    res.status(403).json({ error: 'forbidden', need: min, have: req.user?.role || null })
  }
}

// Test-only direct login (guarded by CFE_TEST_MODE) so UI e2e tests don't have to
// round-trip live Zooniverse for every case. Phase 1's e2e proves the REAL flow.
export function testLoginEnabled() {
  return TEST_MODE
}
export function testLogin(res, { login = 'tester', role = 'admin', id }) {
  const me = { id: id || `test:${login}`, login, display_name: login, avatar_url: null }
  upsertUser(me)
  const now = new Date().toISOString()
  if (role) {
    db.prepare(
      `INSERT OR REPLACE INTO roles (zooniverse_id, role, granted_by, granted_at) VALUES (?, ?, 'test', ?)`,
    ).run(me.id, role, now)
  } else {
    db.prepare('DELETE FROM roles WHERE zooniverse_id = ?').run(me.id)
  }
  const sid = createSession(me.id, 'test-token', 0)
  setSessionCookie(res, sid)
  return { login: me.login, role: role || null }
}

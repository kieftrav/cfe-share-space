import { Router } from 'express'
import * as auth from '../auth.js'

const r = Router()
const RETURN_COOKIE = 'cfe_return'

// Only allow returning to a local path (no open redirects to other origins).
function sanitizeReturn(v) {
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null
  return v
}

// Read + clear the stored return path, then redirect there (with optional query).
function redirectBack(req, res, query = '') {
  const ret = sanitizeReturn(req.cookies?.[RETURN_COOKIE]) || '/'
  res.clearCookie(RETURN_COOKIE, { path: '/' })
  res.redirect(ret + query)
}

// Step 1: remember where the user started, then send them to Zooniverse to authorize.
r.get('/login', (req, res) => {
  const ret = sanitizeReturn(req.query.return)
  if (ret) res.cookie(RETURN_COOKIE, ret, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 10 * 60 * 1000 })
  else res.clearCookie(RETURN_COOKIE, { path: '/' })
  res.redirect(auth.authorizeUrl())
})

// Step 2: Zooniverse redirects back with ?code=; exchange it, set the session, return to origin.
r.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query
  if (error) return redirectBack(req, res, '?auth_error=' + encodeURIComponent(String(error_description || error)))
  if (!code) return redirectBack(req, res, '?auth_error=missing_code')
  try {
    const tok = await auth.exchangeCode(String(code))
    const me = await auth.fetchMe(tok.access_token)
    auth.upsertUser(me)
    const expiry = Date.now() + (tok.expires_in || 7200) * 1000
    auth.setSessionCookie(res, auth.createSession(me.id, tok.access_token, expiry))
    redirectBack(req, res)
  } catch (e) {
    redirectBack(req, res, '?auth_error=' + encodeURIComponent(String(e.message || e).slice(0, 160)))
  }
})

r.get('/me', (req, res) => res.json({ user: req.user }))

r.post('/logout', (req, res) => {
  auth.clearSession(req, res)
  res.json({ ok: true })
})

// Test-only shortcut (CFE_TEST_MODE=1) so UI e2e tests skip the live round-trip.
r.post('/test-login', (req, res) => {
  if (!auth.testLoginEnabled()) return res.status(404).json({ error: 'not found' })
  res.json(auth.testLogin(res, req.body || {}))
})

export default r

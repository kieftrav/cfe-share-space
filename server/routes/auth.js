import { Router } from 'express'
import * as auth from '../auth.js'

const r = Router()

// Step 1: send the user to Zooniverse to authorize (standard redirect flow).
r.get('/login', (_req, res) => res.redirect(auth.authorizeUrl()))

// Step 2: Zooniverse redirects back here with ?code=. Exchange it server-side
// (secret never leaves the backend), set the session cookie, go home.
r.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query
  if (error) return res.redirect('/?auth_error=' + encodeURIComponent(String(error_description || error)))
  if (!code) return res.redirect('/?auth_error=missing_code')
  try {
    const tok = await auth.exchangeCode(String(code))
    const me = await auth.fetchMe(tok.access_token)
    auth.upsertUser(me)
    const expiry = Date.now() + (tok.expires_in || 7200) * 1000
    auth.setSessionCookie(res, auth.createSession(me.id, tok.access_token, expiry))
    res.redirect('/')
  } catch (e) {
    res.redirect('/?auth_error=' + encodeURIComponent(String(e.message || e).slice(0, 160)))
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

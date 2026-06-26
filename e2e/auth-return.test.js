import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'

let server
before(async () => {
  server = await startServer({ port: 8823 })
})
after(async () => {
  if (server) await server.stop()
})

describe('Sign-in returns to the originating page', () => {
  test('login stores the origin path and the callback redirects back to it', async () => {
    const base = server.baseUrl

    // 1. /login remembers ?return= and 302s to Zooniverse authorize.
    const login = await fetch(`${base}/api/auth/login?return=${encodeURIComponent('/discussion')}`, { redirect: 'manual' })
    assert.equal(login.status, 302)
    assert.match(login.headers.get('location') || '', /oauth\/authorize/, 'redirects to Zooniverse')
    assert.match(login.headers.get('set-cookie') || '', /cfe_return=%2Fdiscussion/, 'origin path stored in cookie')

    // 2. The callback (error branch, no live exchange) returns to the stored origin.
    const cb = await fetch(`${base}/api/auth/callback?error=access_denied`, {
      redirect: 'manual',
      headers: { Cookie: 'cfe_return=/discussion' },
    })
    assert.equal(cb.status, 302)
    assert.ok((cb.headers.get('location') || '').startsWith('/discussion'), `callback returns to /discussion, got ${cb.headers.get('location')}`)

    // 3. With no stored return, the callback falls back to home.
    const cbHome = await fetch(`${base}/api/auth/callback?error=access_denied`, { redirect: 'manual' })
    assert.ok((cbHome.headers.get('location') || '').startsWith('/?'), 'falls back to / when no origin stored')

    // 4. Open-redirect guard: an external return is not stored.
    const ext = await fetch(`${base}/api/auth/login?return=${encodeURIComponent('https://evil.com')}`, { redirect: 'manual' })
    assert.ok(!/evil\.com/.test(ext.headers.get('set-cookie') || ''), 'external return is rejected')
  })
})

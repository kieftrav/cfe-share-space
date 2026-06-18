import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { zooCreds, loginAs, postStatus } from './lib/helpers.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

let server, browser

before(async () => {
  server = await startServer({ port: 8801 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

describe('Phase 1 — role gating (trust boundary)', () => {
  test('signed-out can VIEW but cannot write (403)', async () => {
    const page = await browser.newPage()
    try {
      await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
      assert.ok(await page.$('[data-testid="catalog"]'), 'catalog visible signed-out')
      assert.equal(await page.$('[data-testid="nav-admin"]'), null, 'no admin link signed-out')
      const status = await postStatus(page, { type: 'thread', title: 'x' })
      assert.equal(status, 403, 'write blocked for anonymous')
    } finally {
      await page.close()
    }
  })

  test('contributor can create thread, not section', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'contributor')
      assert.equal(await postStatus(page, { type: 'thread', title: 'q' }), 201, 'thread allowed')
      assert.equal(await postStatus(page, { type: 'section', title: 's' }), 403, 'section requires admin')
    } finally {
      await page.close()
    }
  })

  test('admin can create any type + sees Admin link', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      assert.ok(await page.$('[data-testid="nav-admin"]'), 'admin link visible')
      assert.equal(await postStatus(page, { type: 'section', title: 'Sec' }), 201, 'admin can create section')
    } finally {
      await page.close()
    }
  })
})

// Live redirect-flow sign-in. Skipped by default: it requires the EXACT callback
// (ZOO_REDIRECT_URI) registered on the Zooniverse app AND the server running on
// that registered host:port. Run on demand:  node scripts/probe-oauth.js
// (or set CFE_OAUTH_E2E=1 with a server bound to the registered callback's port).
describe('Phase 1 — live Zooniverse OAuth (redirect flow)', () => {
  const enabled = process.env.CFE_OAUTH_E2E === '1'
  const { username, password } = zooCreds()
  const run = enabled && username && password ? test : test.skip

  run('sign in via redirect and land authenticated', { timeout: 120000 }, async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${server.baseUrl}/api/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      if (await page.$('#user_login')) {
        await page.type('#user_login', username)
        await page.type('#user_password', password)
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
          page.click('input[type="submit"][name="commit"]'),
        ])
      }
      if (page.url().includes('/oauth/authorize')) {
        await page.evaluate(() => {
          for (const i of document.querySelectorAll('input[type="submit"], button')) {
            const v = (i.value || i.textContent || '').toLowerCase()
            if (v.includes('authorize') || v.includes('yes')) { i.click(); return }
          }
        })
        await page.waitForNavigation({ timeout: 60000 }).catch(() => {})
      }
      await page.waitForFunction((h) => location.hostname.includes(h), { timeout: 60000 }, new URL(server.baseUrl).hostname)
      await page.waitForSelector('[data-testid="auth-user"]', { timeout: 30000 })
      const who = await page.$eval('[data-testid="auth-user"]', (el) => el.textContent || '')
      assert.match(who, /admin/, 'authenticated with a role')
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})

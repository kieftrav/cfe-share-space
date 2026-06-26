import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, apiCreate, postStatus } from './lib/helpers.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8811 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

function apiStatus(page, path) {
  return page.evaluate(async (p) => (await fetch(p, { credentials: 'include' })).status, path)
}

describe('Any signed-in Zooniverse user can contribute (no whitelist)', () => {
  test('roleless authenticated user can create CFEs + threads + replies, but not admin actions', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      // Sign in with NO role (loginAs role=null deletes any seeded role).
      await loginAs(page, server.baseUrl, null, 'newbie')

      // Contributor-level creates succeed for a roleless authenticated user.
      const cfe = await apiCreate(page, { type: 'cfe', title: 'My WIP CFE', metadata: { github_url: 'https://github.com/me/wip' } })
      assert.ok(cfe.id, 'roleless user created a CFE')
      const thread = await apiCreate(page, { type: 'thread', title: 'Quick question' })
      assert.equal(await postStatus(page, { type: 'reply', parent_id: thread.id, body_markdown: 'me too' }), 201, 'roleless user posted a reply')

      // Admin-only surfaces stay blocked.
      assert.equal(await postStatus(page, { type: 'section', title: 'Resources' }), 403, 'admin-only type blocked')
      assert.equal(await apiStatus(page, '/api/users'), 403, 'user management blocked for non-admin')

      // Frontend: the contribute UI shows for a roleless signed-in user (CFE submission
      // needs no pre-existing category, unlike threads).
      await page.goto(`${server.baseUrl}/cfes`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="submit-cfe-btn"]')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

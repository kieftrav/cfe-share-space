import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs } from './lib/helpers.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

let server, browser
before(async () => {
  server = await startServer({ port: 8803 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

describe('Admin: user administration only', () => {
  test('non-admin is blocked from the admin page + API', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'contributor')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      assert.ok(await page.$('[data-testid="admin-guard"]'), 'contributor sees admin guard')
      const status = await page.evaluate(() => fetch('/api/users', { credentials: 'include' }).then((r) => r.status))
      assert.equal(status, 403, 'contributor blocked from /api/users')
    } finally {
      await page.close()
    }
  })

  test('admin page is user management (no content tree); admin can change a role', async () => {
    // Create a contributor user "researcher1" in an isolated context, then close it.
    const otherCtx = await browser.createBrowserContext()
    const other = await otherCtx.newPage()
    await loginAs(other, server.baseUrl, 'contributor', 'researcher1')
    await other.close()
    await otherCtx.close()

    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="users-table"]')
      // The Admin area no longer manages content.
      assert.equal(await page.$('[data-testid="content-tree"]'), null, 'no content tree in Admin')

      await page.waitForSelector('[data-testid="user-row"][data-login="researcher1"]')
      await page.select('[data-testid="user-row"][data-login="researcher1"] [data-testid="user-role-select"]', 'admin')

      const role = await page.evaluate(() =>
        fetch('/api/users', { credentials: 'include' })
          .then((r) => r.json())
          .then((d) => d.users.find((u) => u.login === 'researcher1')?.role),
      )
      assert.equal(role, 'admin', 'researcher1 promoted to admin')
      await page.screenshot({ path: join(SHOTS, 'admin-users.png') })
    } finally {
      await page.close()
    }
  })

  test('admin can add a user by Zooniverse login (pending until they sign in)', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="add-user"]')
      await page.type('[data-testid="add-user-login"]', 'researcher9')
      await page.select('[data-testid="add-user-role"]', 'contributor')
      await Promise.all([
        page.waitForSelector('[data-testid="user-row"][data-login="researcher9"]'),
        page.click('[data-testid="add-user-submit"]'),
      ])
      const row = await page.$('[data-testid="user-row"][data-login="researcher9"]')
      assert.ok(await row.$('[data-testid="user-pending"]'), 'new user shows pending sign-in')
      const role = await row.$eval('[data-testid="user-role-select"]', (s) => s.value)
      assert.equal(role, 'contributor', 'new user has the granted role')

      const apiRole = await page.evaluate(async () => {
        const { users } = await (await fetch('/api/users', { credentials: 'include' })).json()
        return users.find((u) => u.login === 'researcher9')?.role
      })
      assert.equal(apiRole, 'contributor', 'role persisted server-side')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

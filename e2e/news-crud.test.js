import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, kebabAction } from './lib/helpers.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8818 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const headings = (page) => page.$$eval('[data-testid="announcement"] h2', (hs) => hs.map((h) => h.textContent.trim()))

describe('News CRUD (admin only)', () => {
  test('admin creates, edits, deletes an announcement inline', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/news`, { waitUntil: 'networkidle0' })

      // Create
      await page.click('[data-testid="new-announcement-btn"]')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.type('[data-testid="editor-title"]', 'Maintenance Sunday')
      await page.type('[data-testid="md-editor"]', 'The site will be briefly down.')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="announcement"] h2')].some((h) => h.textContent.includes('Maintenance Sunday')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // Edit (via ⋮)
      await kebabAction(page, (await page.$$('[data-testid="announcement"]'))[0], 'manage-edit')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.click('[data-testid="editor-title"]', { clickCount: 3 })
      await page.type('[data-testid="editor-title"]', 'Maintenance Monday')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="announcement"] h2')].some((h) => h.textContent.includes('Maintenance Monday')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // Delete (via ⋮)
      await kebabAction(page, (await page.$$('[data-testid="announcement"]'))[0], 'manage-delete')
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="announcement"] h2')].every((h) => !h.textContent.includes('Maintenance Monday')))
      assert.ok(!(await headings(page)).includes('Maintenance Monday'), 'announcement deleted')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('non-admins see no create/edit controls and are API-forbidden', async () => {
    // Seed one announcement as admin.
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await admin.evaluate(async () => {
        await fetch('/api/content', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'announcement', title: 'Hello', body_markdown: 'hi' }) })
      })
    } finally {
      await admin.close(); await adminCtx.close()
    }

    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, null, 'member')
      await page.goto(`${server.baseUrl}/news`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="announcement"]')
      assert.equal(await page.$('[data-testid="new-announcement-btn"]'), null, 'no New announcement button for member')
      assert.equal(await page.$('[data-testid="manage-menu"]'), null, 'no manage controls for member')
      const code = await page.evaluate(async () => (await fetch('/api/content', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'announcement', title: 'x' }) })).status)
      assert.equal(code, 403, 'member cannot create an announcement via API')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

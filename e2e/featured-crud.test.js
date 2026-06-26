import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, apiCreate, kebabAction } from './lib/helpers.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8819 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const headings = (page) => page.$$eval('[data-testid="featured-topic"] h2', (hs) => hs.map((h) => h.textContent.trim()))

describe('Featured CRUD (admin only)', () => {
  test('admin creates a featured topic linked to a thread, edits, deletes', async () => {
    let threadId
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    try {
      await loginAs(page, server.baseUrl, 'admin')
      // A thread to link to.
      const cat = await apiCreate(page, { type: 'category', title: 'General' })
      const thread = await apiCreate(page, { type: 'thread', parent_id: cat.id, title: 'Great discussion' })
      threadId = thread.id

      await page.goto(`${server.baseUrl}/featured`, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="new-featured-btn"]')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.type('[data-testid="editor-title"]', 'Spotlight')
      await page.type('[data-testid="md-editor"]', 'Worth a read.')
      await page.select('[data-testid="featured-link"]', String(threadId))
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="featured-topic"] h2')].some((h) => h.textContent.includes('Spotlight')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // The link to the source thread renders.
      const href = await page.$eval('[data-testid="featured-source-link"]', (a) => a.getAttribute('href'))
      assert.equal(href, `/discussion/${threadId}`, 'featured links to its source thread')

      // Edit (via ⋮)
      await kebabAction(page, await page.$('[data-testid="featured-topic"]'), 'manage-edit')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.click('[data-testid="editor-title"]', { clickCount: 3 })
      await page.type('[data-testid="editor-title"]', 'Spotlight (updated)')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="featured-topic"] h2')].some((h) => h.textContent.includes('updated')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // Delete (via ⋮)
      await kebabAction(page, await page.$('[data-testid="featured-topic"]'), 'manage-delete')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="featured-topic"]').length === 0)
      assert.equal((await headings(page)).length, 0, 'featured topic deleted')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('non-admins see no controls and cannot create a featured topic', async () => {
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await apiCreate(admin, { type: 'featured', title: 'Seeded' })
    } finally {
      await admin.close(); await adminCtx.close()
    }
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, null, 'member')
      await page.goto(`${server.baseUrl}/featured`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="featured-topic"]')
      assert.equal(await page.$('[data-testid="new-featured-btn"]'), null, 'no New featured button for member')
      assert.equal(await page.$('[data-testid="manage-menu"]'), null, 'no manage controls for member')
      const code = await page.evaluate(async () => (await fetch('/api/content', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'featured', title: 'x' }) })).status)
      assert.equal(code, 403, 'member cannot create a featured topic')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

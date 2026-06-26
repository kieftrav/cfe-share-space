import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, apiCreate, kebabAction } from './lib/helpers.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8820 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const catTitles = (page) => page.$$eval('[data-testid="category"] h2', (hs) => hs.map((h) => h.textContent.trim()))
const threadTitles = (page) => page.$$eval('[data-testid="thread-row"] a', (as) => as.map((a) => a.textContent.trim()))

describe('Discussion CRUD', () => {
  test('admin manages categories (create, edit, delete)', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/discussion`, { waitUntil: 'networkidle0' })

      await page.click('[data-testid="new-category-btn"]')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.type('[data-testid="editor-title"]', 'Tooling')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="category"] h2')].some((h) => h.textContent.includes('Tooling')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      await kebabAction(page, await page.$('[data-testid="category"]'), 'manage-edit')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.click('[data-testid="editor-title"]', { clickCount: 3 })
      await page.type('[data-testid="editor-title"]', 'Tooling & Setup')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="category"] h2')].some((h) => h.textContent.includes('Setup')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      await kebabAction(page, await page.$('[data-testid="category"]'), 'manage-delete')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="category"]').length === 0)
      assert.equal((await catTitles(page)).length, 0, 'category deleted')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('a member creates, edits, and deletes their own thread and reply', async () => {
    // Seed a category.
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    let catId
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      catId = (await apiCreate(admin, { type: 'category', title: 'Help' })).id
    } finally {
      await admin.close(); await adminCtx.close()
    }

    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    try {
      await loginAs(page, server.baseUrl, null, 'poster')
      await page.goto(`${server.baseUrl}/discussion`, { waitUntil: 'networkidle0' })

      // Create a thread.
      await page.click('[data-testid="new-thread-btn"]')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.type('[data-testid="editor-title"]', 'How do I deploy?')
      await page.type('[data-testid="md-editor"]', 'Steps please.')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="thread-row"] a')].some((a) => a.textContent.includes('How do I deploy?')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // Edit own thread title (via ⋮).
      await kebabAction(page, await page.$('[data-testid="thread-row"]'), 'manage-edit')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.click('[data-testid="editor-title"]', { clickCount: 3 })
      await page.type('[data-testid="editor-title"]', 'How do I deploy to prod?')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="thread-row"] a')].some((a) => a.textContent.includes('to prod')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // Open the thread, post a reply, edit it, delete it.
      const href = await page.$eval('[data-testid="thread-row"] a', (a) => a.getAttribute('href'))
      await page.goto(`${server.baseUrl}${href}`, { waitUntil: 'networkidle0' })
      await page.type('[data-testid="reply-body"]', 'First reply')
      await Promise.all([
        page.waitForSelector('[data-testid="reply"]'),
        page.click('[data-testid="reply-submit"]'),
      ])
      // Edit the reply (via ⋮).
      await kebabAction(page, await page.$('[data-testid="reply"]'), 'manage-edit')
      await page.waitForSelector('[data-testid="reply"] [data-testid="content-editor"]')
      await page.click('[data-testid="reply"] [data-testid="md-editor"]', { clickCount: 3 })
      await page.type('[data-testid="reply"] [data-testid="md-editor"]', 'Edited reply')
      await Promise.all([
        // Wait for the editor to CLOSE (not just the live preview to show the text).
        page.waitForFunction(() => {
          const r = document.querySelector('[data-testid="reply"]')
          return r && !r.querySelector('[data-testid="content-editor"]') && r.textContent.includes('Edited reply')
        }),
        page.click('[data-testid="reply"] [data-testid="editor-save"]'),
      ])
      // Delete the reply (via ⋮).
      await kebabAction(page, await page.$('[data-testid="reply"]'), 'manage-delete')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="reply"]').length === 0)

      // Delete own thread from its page (via ⋮) → back to discussion.
      await kebabAction(page, await page.$('[data-testid="thread"]'), 'manage-delete')
      await page.waitForFunction(() => !!document.querySelector('[data-testid="discussion"]'))
      assert.ok(!(await threadTitles(page)).some((t) => t.includes('deploy')), 'thread deleted')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('a member cannot manage another member’s thread', async () => {
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    let catId
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      catId = (await apiCreate(admin, { type: 'category', title: 'Open' })).id
    } finally {
      await admin.close(); await adminCtx.close()
    }

    let threadId
    const aCtx = await browser.createBrowserContext()
    const a = await aCtx.newPage()
    try {
      await loginAs(a, server.baseUrl, null, 'authorA')
      threadId = (await apiCreate(a, { type: 'thread', parent_id: catId, title: 'A thread' })).id
    } finally {
      await a.close(); await aCtx.close()
    }

    const bCtx = await browser.createBrowserContext()
    const b = await bCtx.newPage()
    try {
      await loginAs(b, server.baseUrl, null, 'authorB')
      await b.goto(`${server.baseUrl}/discussion`, { waitUntil: 'networkidle0' })
      await b.waitForSelector('[data-testid="thread-row"]')
      const row = await b.$('[data-testid="thread-row"]')
      assert.equal(await row.$('[data-testid="manage-menu"]'), null, 'no manage controls on another user’s thread')
      const codes = await b.evaluate(async (id) => {
        const put = await fetch(`/api/content/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'hijack' }) })
        const del = await fetch(`/api/content/${id}`, { method: 'DELETE', credentials: 'include' })
        return [put.status, del.status]
      }, threadId)
      assert.deepEqual(codes, [403, 403], 'cannot PUT/DELETE another user’s thread')
    } finally {
      await b.close(); await bCtx.close()
    }
  })
})

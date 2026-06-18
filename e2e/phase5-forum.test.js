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
  server = await startServer({ port: 8805 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

async function postThread(page, baseUrl, title, body) {
  await page.goto(`${baseUrl}/discussion`, { waitUntil: 'networkidle0' })
  await page.click('[data-testid="new-thread-btn"]')
  await page.waitForSelector('[data-testid="new-thread-form"]')
  await page.type('[data-testid="thread-title"]', title)
  await page.type('[data-testid="thread-body"]', body)
  await Promise.all([
    page.waitForFunction((t) => [...document.querySelectorAll('[data-testid="thread-row"] a')].some((a) => a.textContent.includes(t)), {}, title),
    page.click('[data-testid="thread-submit"]'),
  ])
}

async function threadOrder(page, baseUrl) {
  await page.goto(`${baseUrl}/discussion`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="thread-row"]')
  return page.$$eval('[data-testid="thread-row"] a', (as) => as.map((a) => a.textContent.trim()))
}

describe('Phase 5 — discussion forum + code references', () => {
  test('admin makes a category; contributor posts threads; reply bumps activity; code-ref renders', async () => {
    // Admin creates a category (admin-only type) in its own context.
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await admin.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await admin.click('[data-testid="new-root-btn"]')
      await admin.waitForSelector('[data-testid="editor"]')
      await admin.type('[data-testid="editor-title"]', 'General Discussion')
      await admin.select('[data-testid="editor-type"]', 'category')
      await Promise.all([
        admin.waitForFunction(() => [...document.querySelectorAll('[data-testid="tree-node"] span')].some((s) => s.textContent.includes('General Discussion')), {}),
        admin.click('[data-testid="editor-save"]'),
      ])
    } finally {
      await admin.close()
      await adminCtx.close()
    }

    // Contributor posts two threads + a reply with a code-ref.
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, 'contributor')
      await postThread(page, server.baseUrl, 'How do I add a brush tool?', 'Trying to add a brush.')
      await postThread(page, server.baseUrl, 'Subject viewer scaling', 'Image is blurry.')

      let order = await threadOrder(page, server.baseUrl)
      assert.deepEqual(order, ['Subject viewer scaling', 'How do I add a brush tool?'], 'newest activity first')

      // Open the older thread and reply with a code reference.
      const href = await page.$$eval('[data-testid="thread-row"] a', (as) => {
        const a = as.find((x) => x.textContent.includes('brush tool'))
        return a.getAttribute('href')
      })
      await page.goto(`${server.baseUrl}${href}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="reply-form"]')
      await page.type('[data-testid="reply-body"]', 'See this component:')
      await page.type('[data-testid="reply-coderef-path"]', 'src/components/BrushTool.jsx')
      await page.type('[data-testid="reply-coderef-url"]', 'https://github.com/zooniverse/clump-scout/blob/main/src/components/BrushTool.jsx#L10-L20')
      await Promise.all([
        page.waitForSelector('[data-testid="reply"]'),
        page.click('[data-testid="reply-submit"]'),
      ])
      await page.waitForSelector('[data-testid="code-ref"]')
      const refPath = await page.$eval('[data-testid="code-ref-path"]', (el) => el.textContent)
      assert.match(refPath, /src\/components\/BrushTool\.jsx/, 'code-ref shows repo path')
      const link = await page.$('[data-testid="code-ref-link"]')
      assert.equal(await link.evaluate((a) => a.target), '_blank', 'code-ref link new tab')
      assert.match(await link.evaluate((a) => a.href), /github\.com/, 'code-ref deep link to GitHub')
      await page.screenshot({ path: join(SHOTS, 'phase5-thread-coderef.png') })

      // Replying bumped the older thread to the top.
      order = await threadOrder(page, server.baseUrl)
      assert.deepEqual(order, ['How do I add a brush tool?', 'Subject viewer scaling'], 'reply bumped activity')
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})

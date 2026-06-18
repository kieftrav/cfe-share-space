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
  server = await startServer({ port: 8806 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

async function nodeIdByTitle(page, title) {
  return page.evaluate((t) => {
    const n = [...document.querySelectorAll('[data-testid="tree-node"]')].find((el) => (el.querySelector('span')?.textContent || '').trim() === t)
    return n ? n.getAttribute('data-id') : null
  }, title)
}

async function newNode(page, fields, before) {
  await page.waitForSelector('[data-testid="new-root-btn"]')
  await page.click('[data-testid="new-root-btn"]')
  await page.waitForSelector('[data-testid="editor-title"]')
  await page.type('[data-testid="editor-title"]', fields.title)
  await page.select('[data-testid="editor-type"]', fields.type)
  if (fields.parentId) await page.select('[data-testid="editor-parent"]', String(fields.parentId))
  if (fields.body) await page.type('[data-testid="md-editor"]', fields.body)
  if (before) await before(page)
  await page.click('[data-testid="editor-save"]')
  await page.waitForFunction(
    (t) => {
      const inTree = [...document.querySelectorAll('[data-testid="tree-node"] span')].some((s) => s.textContent.includes(t))
      return inTree && !document.querySelector('[data-testid="editor"]')
    },
    {},
    fields.title,
  )
}

describe('Phase 6 — announcements/news + featured topics (elevation)', () => {
  test('admin posts an announcement and elevates a thread to a featured topic', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })

      await newNode(page, { title: 'CFE Share Space is live', type: 'announcement', body: 'Welcome to the space!' })
      await newNode(page, { title: 'Help', type: 'category' })
      const catId = await nodeIdByTitle(page, 'Help')
      await newNode(page, { title: 'Reuse the brush tool', type: 'thread', body: 'Tip about brushes.', parentId: catId })
      const threadId = await nodeIdByTitle(page, 'Reuse the brush tool')

      await newNode(page, { title: 'Editor’s pick: brush tips', type: 'featured', body: 'Why this thread matters.' }, async (p) => {
        await p.waitForSelector('[data-testid="featured-link"]')
        await p.select('[data-testid="featured-link"]', String(threadId))
      })

      // News page shows the announcement.
      await page.goto(`${server.baseUrl}/news`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="announcement"]')
      const ann = await page.$eval('[data-testid="announcement"] h2', (el) => el.textContent)
      assert.match(ann, /CFE Share Space is live/)
      await page.screenshot({ path: join(SHOTS, 'phase6-news.png') })

      // Featured page shows the elevated topic linking back to the thread.
      await page.goto(`${server.baseUrl}/featured`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="featured-topic"]')
      const ft = await page.$eval('[data-testid="featured-topic"] h2', (el) => el.textContent)
      assert.match(ft, /Editor.s pick/)
      const srcHref = await page.$eval('[data-testid="featured-source-link"]', (a) => a.getAttribute('href'))
      assert.equal(srcHref, `/discussion/${threadId}`, 'featured links to the source thread')
      await page.screenshot({ path: join(SHOTS, 'phase6-featured.png') })
    } finally {
      await page.close()
    }
  })
})

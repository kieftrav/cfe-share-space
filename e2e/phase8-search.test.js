import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, apiCreate } from './lib/helpers.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

let server, browser
before(async () => {
  server = await startServer({ port: 8808 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

async function searchTitles(page, baseUrl, q) {
  await page.goto(`${baseUrl}/search`, { waitUntil: 'networkidle0' })
  await page.type('[data-testid="search-input"]', q)
  await page.click('[data-testid="search-submit"]')
  await page.waitForFunction(() => document.querySelector('[data-testid="search-result"], [data-testid="search-empty"]'))
  return page.$$eval('[data-testid="search-result"]', (els) => els.map((e) => e.textContent.trim()))
}

describe('Phase 8 — search (FTS5 trigram, partial match)', () => {
  let threadId

  test('seed varied content (admin)', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await apiCreate(page, {
        type: 'cfe',
        title: 'Galaxy Zoo Clump Scout',
        body_markdown: 'Mark clumps in galaxies.',
        metadata: { github_url: 'https://github.com/zooniverse/clump-scout', tagline: 'a nearest-neighbor explorer' },
      })
      await apiCreate(page, { type: 'announcement', title: 'Scheduled maintenance window' })
      const cat = await apiCreate(page, { type: 'category', title: 'Help' })
      const t = await apiCreate(page, { type: 'thread', title: 'Calibrating the subject viewer', parent_id: cat.id, body_markdown: 'calibration question' })
      threadId = t.id
    } finally {
      await page.close()
    }
  })

  test('partial term matches a CFE title', async () => {
    const page = await browser.newPage()
    try {
      const titles = await searchTitles(page, server.baseUrl, 'galax')
      assert.ok(titles.some((t) => /Galaxy Zoo Clump Scout/.test(t)), `expected CFE hit, got ${JSON.stringify(titles)}`)
      await page.screenshot({ path: join(SHOTS, 'phase8-search.png') })
    } finally {
      await page.close()
    }
  })

  test('partial term matches indexed metadata (tagline)', async () => {
    const page = await browser.newPage()
    try {
      const titles = await searchTitles(page, server.baseUrl, 'neighbor')
      assert.ok(titles.some((t) => /Galaxy Zoo Clump Scout/.test(t)), 'metadata (tagline) is searchable')
    } finally {
      await page.close()
    }
  })

  test('matches a thread and clicking a result navigates to it', async () => {
    const page = await browser.newPage()
    try {
      const titles = await searchTitles(page, server.baseUrl, 'calibrat')
      assert.ok(titles.some((t) => /Calibrating the subject viewer/.test(t)), 'thread matched')
      const link = await page.$$('[data-testid="search-result"] a')
      let target
      for (const a of link) {
        const txt = await a.evaluate((e) => e.textContent)
        if (/Calibrating/.test(txt)) { target = a; break }
      }
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), target.click()])
      assert.equal(new URL(page.url()).pathname, `/discussion/${threadId}`, 'navigated to the thread')
    } finally {
      await page.close()
    }
  })
})

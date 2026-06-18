import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { startServer } from './lib/server.js'
import { launchBrowser, VIEWPORTS } from './lib/browser.js'
import { loginAs } from './lib/helpers.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

// A tiny 1x1 PNG written to a temp file so the file input can upload it → base64.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const imgPath = join(tmpdir(), 'cfe-test-img.png')
writeFileSync(imgPath, Buffer.from(PNG_B64, 'base64'))

let server, browser
before(async () => {
  server = await startServer({ port: 8804 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

describe('Phase 4 — CFE catalog (built via admin UI)', () => {
  test('admin adds a CFE with base64 image; public catalog renders it; repo link opens new tab', async () => {
    const admin = await browser.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await admin.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await admin.click('[data-testid="new-root-btn"]')
      await admin.waitForSelector('[data-testid="editor"]')
      await admin.type('[data-testid="editor-title"]', 'Clump Scout CFE')
      await admin.select('[data-testid="editor-type"]', 'cfe')
      await admin.waitForSelector('[data-testid="cfe-github"]')
      await admin.type('[data-testid="cfe-github"]', 'https://github.com/zooniverse/clump-scout')
      await admin.type('[data-testid="cfe-tagline"]', 'Mark clumps in galaxies')
      await admin.type('[data-testid="cfe-tags"]', 'galaxies, drawing')
      await admin.type('[data-testid="md-editor"]', 'A custom front end for clump marking.')
      const fileInput = await admin.$('[data-testid="cfe-image-input"]')
      await fileInput.uploadFile(imgPath)
      await admin.waitForSelector('[data-testid="cfe-image-preview"]')
      await Promise.all([
        admin.waitForFunction(() => [...document.querySelectorAll('[data-testid="tree-node"] span')].some((s) => s.textContent.includes('Clump Scout CFE')), {}),
        admin.click('[data-testid="editor-save"]'),
      ])
    } finally {
      await admin.close()
    }

    // Public (signed-out) catalog
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.setViewport(VIEWPORTS.desktop)
      await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="cfe-card"]')
      const title = await page.$eval('[data-testid="cfe-card"] h3', (el) => el.textContent)
      assert.match(title, /Clump Scout CFE/)
      const imgSrc = await page.$eval('[data-testid="cfe-image"]', (el) => el.getAttribute('src'))
      assert.ok(imgSrc.startsWith('data:image/'), 'image rendered from base64 in sqlite')

      // Repo link opens a new tab
      const repo = await page.$('[data-testid="cfe-repo-link"]')
      assert.equal(await repo.evaluate((a) => a.target), '_blank', 'repo link target=_blank')
      assert.match(await repo.evaluate((a) => a.href), /github\.com\/zooniverse\/clump-scout/)

      // Layout: card collapses to one column at mobile, two at desktop
      const cols = async () =>
        page.$eval('[data-testid="cfe-card"]', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      assert.equal(await cols(), 2, 'two columns at desktop')
      await page.screenshot({ path: join(SHOTS, 'phase4-catalog-desktop.png') })
      await page.setViewport(VIEWPORTS.mobile)
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="cfe-card"]')
      assert.equal(await cols(), 1, 'one column at mobile')
      await page.screenshot({ path: join(SHOTS, 'phase4-catalog-mobile.png') })
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})

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
  server = await startServer({ port: 8814 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

describe('Phase 6 — Resources dropdown navigation is reliable', () => {
  test('click opens menu; click a sub-page navigates; click-outside closes', async () => {
    let pageId
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      const section = await apiCreate(admin, { type: 'section', title: 'Resources', slug: 'resources' })
      const child = await apiCreate(admin, { type: 'page', title: 'Getting Started', parent_id: section.id, body_markdown: '# Start here' })
      pageId = child.id
    } finally {
      await admin.close(); await adminCtx.close()
    }

    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })

      // Open via click, then click the sub-page → it must navigate to the resource page.
      await page.click('[data-testid="nav-resources"]')
      await page.waitForSelector('[data-testid="resources-menu"]')
      await page.waitForSelector(`[data-testid="res-link-${pageId}"]`)
      await Promise.all([
        page.waitForSelector('[data-testid="resource-page"]'),
        page.click(`[data-testid="res-link-${pageId}"]`),
      ])
      const heading = await page.$eval('[data-testid="resource-page"] h1', (h) => h.textContent.trim())
      assert.equal(heading, 'Getting Started', 'navigated into the resource sub-page')
      // Menu closed after navigation.
      assert.equal(await page.$('[data-testid="resources-menu"]'), null, 'menu closed after selecting')

      // Click-outside closes the menu (no hover race).
      await page.click('[data-testid="nav-resources"]')
      await page.waitForSelector('[data-testid="resources-menu"]')
      await page.click('[data-testid="resource-page"] h1')
      await page.waitForFunction(() => !document.querySelector('[data-testid="resources-menu"]'))
      await page.screenshot({ path: join(SHOTS, 'phase6-resources-nav.png') })
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

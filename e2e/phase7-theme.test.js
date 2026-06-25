import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './lib/server.js'
import { launchBrowser, VIEWPORTS } from './lib/browser.js'
import { loginAs, apiCreate } from './lib/helpers.js'

const SHOTS = join(import.meta.dirname, 'screenshots', 'phase7-theme')
mkdirSync(SHOTS, { recursive: true })

let server, browser
before(async () => {
  server = await startServer({ port: 8815 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

// 1x1 PNG so CFE cards show an image region.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('Phase 7 — visual theme pass (proposal): screenshots + tokens applied', () => {
  test('new palette is applied site-wide; capture pages for review', async () => {
    // Seed content through the admin API so every page has something to show.
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await apiCreate(admin, { type: 'cfe', title: 'Galaxy Tagger', body_markdown: 'Tag galaxies fast.', metadata: { github_url: 'https://github.com/x/galaxy', tagline: 'Crowd-tag morphologies', owner: 'areviewer', tags: ['react', 'svg'], image: PNG, reviewed: true } })
      await apiCreate(admin, { type: 'cfe', title: 'Nebula Painter', body_markdown: 'Paint nebulae.', metadata: { github_url: 'https://github.com/x/nebula', owner: 'maker', image: PNG, reviewed: false } })
      await apiCreate(admin, { type: 'announcement', title: 'CFE Share Space is live', body_markdown: 'Welcome to the **CFE** community space.' })
      const cat = await apiCreate(admin, { type: 'category', title: 'General' })
      const thread = await apiCreate(admin, { type: 'thread', parent_id: cat.id, title: 'How do I add a drawing tool?', body_markdown: 'Trying to wire up a brush.' })
      await apiCreate(admin, { type: 'featured', title: 'Spotlight: drawing tools', body_markdown: 'A great thread on tooling.', metadata: { links_content_id: thread.id } })
      const sec = await apiCreate(admin, { type: 'section', title: 'Resources', slug: 'resources' })
      await apiCreate(admin, { type: 'page', parent_id: sec.id, title: 'Getting Started', body_markdown: '# Getting started\nClone the template and go.' })
    } finally {
      await admin.close(); await adminCtx.close()
    }

    // Public pages (signed out).
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.setViewport(VIEWPORTS.desktop)
      await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="cfe-card"]')

      // Token sanity: the new background is applied (not the old #0f1117 navy).
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      assert.equal(bg, 'rgb(12, 13, 17)', `body background should be the new token, got ${bg}`)

      // Corners are crisp (~2px), not the AI-ish large radii.
      const radius = await page.$eval('[data-testid="cfe-card"]', (el) => getComputedStyle(el).borderTopLeftRadius)
      assert.equal(radius, '2px', `card radius should be 2px, got ${radius}`)
      // The pill-style "Custom Front Ends" chip is gone.
      assert.equal(await page.$('[class*="rounded-full"]'), null, 'no rounded-full pill chips remain')

      const shoot = async (path, sel, name) => {
        await page.goto(`${server.baseUrl}${path}`, { waitUntil: 'networkidle0' })
        await page.waitForSelector(sel)
        await page.screenshot({ path: join(SHOTS, name), fullPage: true })
      }
      await shoot('/', '[data-testid="catalog"]', 'home-desktop.png')
      await shoot('/cfes', '[data-testid="catalog"]', 'browse-desktop.png')
      await shoot('/news', '[data-testid="news"]', 'news-desktop.png')
      await shoot('/featured', '[data-testid="featured"]', 'featured-desktop.png')
      await shoot('/resources', '[data-testid="resources"]', 'resources-desktop.png')
      await shoot('/search', '[data-testid="search"]', 'search-desktop.png')

      await page.setViewport(VIEWPORTS.mobile)
      await shoot('/', '[data-testid="catalog"]', 'home-mobile.png')
    } finally {
      await page.close(); await ctx.close()
    }

    // Signed-in pages (discussion + admin).
    const userCtx = await browser.createBrowserContext()
    const u = await userCtx.newPage()
    try {
      await u.setViewport(VIEWPORTS.desktop)
      await loginAs(u, server.baseUrl, 'admin')
      await u.goto(`${server.baseUrl}/discussion`, { waitUntil: 'networkidle0' })
      await u.waitForSelector('[data-testid="discussion"]')
      await u.screenshot({ path: join(SHOTS, 'discussion-desktop.png'), fullPage: true })
      await u.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await u.waitForSelector('[data-testid="content-tree"]')
      await u.screenshot({ path: join(SHOTS, 'admin-desktop.png'), fullPage: true })
    } finally {
      await u.close(); await userCtx.close()
    }
  })
})

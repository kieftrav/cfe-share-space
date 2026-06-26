import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8822 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const INK = 'rgb(207, 209, 214)' // --color-ink (active)
const MUTED = 'rgb(136, 139, 149)' // --color-ink-muted (inactive)

const color = (page, testid) => page.$eval(`[data-testid="${testid}"]`, (el) => getComputedStyle(el).color)

describe('Top nav highlights the current page', () => {
  test('the active top-level item is white; others are muted', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      // On the CFEs landing, CFEs is active.
      await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      assert.equal(await color(page, 'nav-cfes'), INK, 'CFEs active on /')
      assert.equal(await color(page, 'nav-news'), MUTED, 'News muted on /')
      assert.equal(await page.$eval('[data-testid="nav-cfes"]', (el) => el.getAttribute('aria-current')), 'page')

      // Navigate to News → News active, CFEs muted.
      await Promise.all([
        page.waitForFunction(() => location.pathname === '/news'),
        page.click('[data-testid="nav-news"]'),
      ])
      assert.equal(await color(page, 'nav-news'), INK, 'News active on /news')
      assert.equal(await color(page, 'nav-cfes'), MUTED, 'CFEs muted on /news')

      // Resources (a dropdown button) highlights on a resources route.
      await page.goto(`${server.baseUrl}/resources`, { waitUntil: 'networkidle0' })
      assert.equal(await color(page, 'nav-resources'), INK, 'Resources active on /resources')
      assert.equal(await color(page, 'nav-news'), MUTED, 'News muted on /resources')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

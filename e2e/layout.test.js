import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './lib/server.js'
import { launchBrowser, VIEWPORTS } from './lib/browser.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

let server, browser

before(async () => {
  server = await startServer()
  browser = await launchBrowser()
})

after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

describe('Layout shell', () => {
  test('/api/health reports ok + db', async () => {
    const res = await fetch(`${server.baseUrl}/api/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.db, true)
  })

  test('top nav + tabs render', async () => {
    const page = await browser.newPage()
    try {
      await page.setViewport(VIEWPORTS.desktop)
      await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
      assert.ok(await page.$('[data-testid="top-nav"]'), 'top nav present')
      assert.ok(await page.$('[data-testid="auth-button"]'), 'auth button present')
      for (const id of ['nav-cfes', 'nav-news', 'nav-featured', 'nav-discussion', 'nav-resources', 'nav-search']) {
        assert.ok(await page.$(`[data-testid="${id}"]`), `${id} present`)
      }
    } finally {
      await page.close()
    }
  })

  test('main is width-capped + centered across breakpoints', async () => {
    for (const [name, vp] of Object.entries(VIEWPORTS)) {
      const page = await browser.newPage()
      try {
        await page.setViewport(vp)
        await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
        const m = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="main"]')
          const r = el.getBoundingClientRect()
          return {
            maxWidth: getComputedStyle(el).maxWidth,
            left: r.left,
            right: window.innerWidth - r.right,
            width: r.width,
          }
        })
        assert.equal(m.maxWidth, '1100px', `${name}: max-width capped`)
        assert.ok(Math.abs(m.left - m.right) <= 2, `${name}: centered (l=${m.left} r=${m.right})`)
        assert.ok(m.width <= 1100 + 1, `${name}: width within cap`)
        await page.screenshot({ path: join(SHOTS, `layout-${name}.png`) })
      } finally {
        await page.close()
      }
    }
  })
})

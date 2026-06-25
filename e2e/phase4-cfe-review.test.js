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
  server = await startServer({ port: 8812 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const NAME = 'Nebula Painter'

async function gridTitles(page) {
  return page.$$eval('[data-testid="cfe-card"] h3', (hs) => hs.map((h) => h.textContent.trim()))
}

describe('Phase 4 — two CFE lists: all (browse) vs reviewed (landing)', () => {
  test('a signed-in user submits a CFE → shows in Browse all, not on landing; admin reviews → lands on landing', async () => {
    // 1. Signed-in (roleless) user self-submits a CFE through the Browse page UI.
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, null, 'maker')
      await page.goto(`${server.baseUrl}/cfes`, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="submit-cfe-btn"]')
      await page.waitForSelector('[data-testid="cfe-form"]')
      await page.type('[data-testid="cfe-form-title"]', NAME)
      await page.type('[data-testid="cfe-form-github"]', 'https://github.com/maker/nebula-painter')
      await page.type('[data-testid="cfe-form-desc"]', 'Paint nebulae onto subjects.')
      await Promise.all([
        page.waitForFunction((n) => [...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes(n)), {}, NAME),
        page.click('[data-testid="cfe-form-submit"]'),
      ])
      // It is in-progress: a badge says so.
      await page.waitForSelector('[data-testid="cfe-inprogress-badge"]')
      assert.ok((await gridTitles(page)).includes(NAME), 'submitted CFE appears in Browse all')
      await page.screenshot({ path: join(SHOTS, 'phase4-browse-all.png') })
    } finally {
      await page.close(); await ctx.close()
    }

    // 2. Landing page (signed out) must NOT show the in-progress CFE.
    const anonCtx = await browser.createBrowserContext()
    const anon = await anonCtx.newPage()
    try {
      await anon.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await anon.waitForSelector('[data-testid="catalog"]')
      assert.ok(!(await gridTitles(anon)).includes(NAME), 'in-progress CFE absent from landing')
    } finally {
      await anon.close(); await anonCtx.close()
    }

    // 3. Admin flips the reviewed flag from the row's ⋮ actions menu.
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await admin.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await admin.waitForSelector('[data-testid="content-tree"]')
      const node = '[data-testid="tree-node"][data-type="cfe"]'
      await admin.waitForSelector(node)
      await admin.click(`${node} [data-testid="node-menu"]`)
      await admin.waitForSelector(`${node} [data-testid="node-review"]`)
      await admin.click(`${node} [data-testid="node-review"]`)
      await admin.waitForFunction((s) => document.querySelector(s)?.textContent.includes('reviewed'), {}, node)
    } finally {
      await admin.close(); await adminCtx.close()
    }

    // 4. Landing now shows the reviewed CFE.
    const anon2Ctx = await browser.createBrowserContext()
    const anon2 = await anon2Ctx.newPage()
    try {
      await anon2.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await anon2.waitForSelector('[data-testid="cfe-card"]')
      assert.ok((await gridTitles(anon2)).includes(NAME), 'reviewed CFE now on landing')
      await anon2.screenshot({ path: join(SHOTS, 'phase4-landing-reviewed.png') })
    } finally {
      await anon2.close(); await anon2Ctx.close()
    }
  })
})

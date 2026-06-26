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
  server = await startServer({ port: 8810 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

// API fetch from a page context (carries that context's cookies, or none).
function apiStatus(page, path) {
  return page.evaluate(async (p) => {
    const r = await fetch(p, { credentials: 'include' })
    return r.status
  }, path)
}

describe('Discussion is gated for signed-out users; everything else is public', () => {
  test('anon cannot read discussion content but can read CFEs/News/Featured/Resources', async () => {
    let threadId, cfeId

    // Seed: admin makes a category + a public CFE; contributor posts a thread.
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      const cat = await apiCreate(admin, { type: 'category', title: 'General' })
      const cfe = await apiCreate(admin, { type: 'cfe', title: 'Galaxy Tagger', metadata: { github_url: 'https://github.com/x/y' } })
      cfeId = cfe.id
      const thread = await apiCreate(admin, { type: 'thread', parent_id: cat.id, title: 'How do I start?' })
      threadId = thread.id
    } finally {
      await admin.close(); await adminCtx.close()
    }

    // Anonymous browser context (no cookies).
    const anonCtx = await browser.createBrowserContext()
    const anon = await anonCtx.newPage()
    try {
      await anon.goto(server.baseUrl, { waitUntil: 'networkidle0' })

      // API: discussion reads are 403; CFE reads are 200.
      assert.equal(await apiStatus(anon, '/api/content?type=thread'), 403, 'anon list threads → 403')
      assert.equal(await apiStatus(anon, '/api/content?type=reply'), 403, 'anon list replies → 403')
      assert.equal(await apiStatus(anon, '/api/content?type=category'), 403, 'anon list categories → 403')
      assert.equal(await apiStatus(anon, `/api/content/${threadId}`), 403, 'anon read a thread → 403')
      assert.equal(await apiStatus(anon, '/api/content?type=cfe'), 200, 'anon list CFEs → 200')
      assert.equal(await apiStatus(anon, `/api/content/${cfeId}`), 200, 'anon read a CFE → 200')

      // The tree (used by nav/Resources) hides discussion nodes from anon.
      const treeTypes = await anon.evaluate(async () => {
        const { tree } = await (await fetch('/api/content/tree', { credentials: 'include' })).json()
        const types = new Set()
        const walk = (ns) => ns.forEach((n) => { types.add(n.type); if (n.children) walk(n.children) })
        walk(tree)
        return [...types]
      })
      assert.ok(!treeTypes.includes('category') && !treeTypes.includes('thread'), `anon tree must omit discussion types, got ${treeTypes}`)

      // UI: /discussion shows the auth gate, not the forum.
      await anon.goto(`${server.baseUrl}/discussion`, { waitUntil: 'networkidle0' })
      await anon.waitForSelector('[data-testid="auth-gate"]')
      assert.equal(await anon.$('[data-testid="discussion"]'), null, 'forum not rendered for anon')
      await anon.screenshot({ path: join(SHOTS, 'discussion-gate.png') })

      // UI: a thread URL is also gated.
      await anon.goto(`${server.baseUrl}/discussion/${threadId}`, { waitUntil: 'networkidle0' })
      await anon.waitForSelector('[data-testid="auth-gate"]')

      // UI: public sections render for anon.
      await anon.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await anon.waitForSelector('[data-testid="catalog"]')
      for (const [path, sel] of [['/news', 'news'], ['/featured', 'featured'], ['/resources', 'resources']]) {
        await anon.goto(`${server.baseUrl}${path}`, { waitUntil: 'networkidle0' })
        await anon.waitForSelector(`[data-testid="${sel}"]`)
        assert.equal(await anon.$('[data-testid="auth-gate"]'), null, `${path} must not be gated`)
      }
    } finally {
      await anon.close(); await anonCtx.close()
    }

    // Signed-in user sees the forum (no gate).
    const userCtx = await browser.createBrowserContext()
    const u = await userCtx.newPage()
    try {
      await loginAs(u, server.baseUrl, 'contributor')
      await u.goto(`${server.baseUrl}/discussion`, { waitUntil: 'networkidle0' })
      await u.waitForSelector('[data-testid="discussion"]')
      assert.equal(await u.$('[data-testid="auth-gate"]'), null, 'signed-in user sees forum')
    } finally {
      await u.close(); await userCtx.close()
    }
  })
})

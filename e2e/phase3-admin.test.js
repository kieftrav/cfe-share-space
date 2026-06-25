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
  server = await startServer({ port: 8803 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

async function nodeIdByTitle(page, title) {
  return page.evaluate((t) => {
    const nodes = [...document.querySelectorAll('[data-testid="tree-node"]')]
    const n = nodes.find((el) => (el.querySelector('span')?.textContent || '').trim() === t)
    return n ? n.getAttribute('data-id') : null
  }, title)
}

// Create a content node through the admin editor UI. Parent is chosen via the
// editor's parent <select> (deterministic) rather than the per-row addchild button.
async function createViaUI(page, { title, type, slug, body = '', parentId = null }) {
  await page.waitForSelector('[data-testid="new-root-btn"]')
  await page.click('[data-testid="new-root-btn"]')
  await page.waitForSelector('[data-testid="editor-title"]')
  await page.type('[data-testid="editor-title"]', title)
  await page.select('[data-testid="editor-type"]', type)
  if (parentId) await page.select('[data-testid="editor-parent"]', String(parentId))
  if (slug) await page.type('[data-testid="editor-slug"]', slug)
  if (body) await page.type('[data-testid="md-editor"]', body)
  await page.click('[data-testid="editor-save"]')
  // Wait for the save cycle to finish: node present in tree AND editor closed
  // (else the pending setDraft(null) can undo the next "new" click).
  await page.waitForFunction(
    (t) => {
      const inTree = [...document.querySelectorAll('[data-testid="tree-node"] span')].some((s) => s.textContent.trim() === t)
      return inTree && !document.querySelector('[data-testid="editor"]')
    },
    {},
    title,
  )
}

describe('Phase 3 — admin console (built first)', () => {
  test('non-admin is blocked from admin API + UI', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'contributor')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      assert.ok(await page.$('[data-testid="admin-guard"]'), 'contributor sees admin guard')
      const status = await page.evaluate(() => fetch('/api/users', { credentials: 'include' }).then((r) => r.status))
      assert.equal(status, 403, 'contributor blocked from /api/users')
    } finally {
      await page.close()
    }
  })

  test('admin builds a section + pages via UI; nav + reorder reflect the hierarchy', async () => {
    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })

      await createViaUI(page, { title: 'Resources', type: 'section', slug: 'resources' })
      const resId = await nodeIdByTitle(page, 'Resources')
      assert.ok(resId, 'Resources section created')

      await createViaUI(page, { title: 'Getting Started', type: 'page', body: '# Welcome', parentId: resId })
      await createViaUI(page, { title: 'FAQ', type: 'page', body: '## FAQ', parentId: resId })
      await page.screenshot({ path: join(SHOTS, 'phase3-admin-tree.png') })

      // Nav reflects hierarchy: Resources dropdown lists the two child pages in order.
      await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="nav-resources"]')
      await page.waitForSelector('[data-testid="resources-menu"]')
      let order = await page.$$eval('[data-testid="resources-menu"] a:not([data-testid="res-link-all"])', (as) => as.map((a) => a.textContent.trim()))
      assert.deepEqual(order, ['Getting Started', 'FAQ'], 'nav order matches creation order')

      // Reorder in admin: move Getting Started down.
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      const gsId = await nodeIdByTitle(page, 'Getting Started')
      await page.click(`[data-testid="tree-node"][data-id="${gsId}"] [data-testid="node-menu"]`)
      await page.waitForSelector(`[data-testid="tree-node"][data-id="${gsId}"] [data-testid="node-down"]`)
      await page.click(`[data-testid="tree-node"][data-id="${gsId}"] [data-testid="node-down"]`)
      // Wait for the reorder to persist + the admin tree to re-render in new order.
      await page.waitForFunction(() => {
        const titles = [...document.querySelectorAll('[data-testid="tree-node"] span:first-child')].map((s) => s.textContent.trim())
        const fa = titles.indexOf('FAQ')
        const gs = titles.indexOf('Getting Started')
        return fa > -1 && gs > -1 && fa < gs
      })

      await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="nav-resources"]')
      await page.waitForSelector('[data-testid="resources-menu"]')
      order = await page.$$eval('[data-testid="resources-menu"] a:not([data-testid="res-link-all"])', (as) => as.map((a) => a.textContent.trim()))
      assert.deepEqual(order, ['FAQ', 'Getting Started'], 'nav order updates after reorder')
    } finally {
      await page.close()
    }
  })

  test('admin grants another user the admin role', async () => {
    // Create a contributor user "researcher1" in an isolated context, then close it.
    const otherCtx = await browser.createBrowserContext()
    const other = await otherCtx.newPage()
    await loginAs(other, server.baseUrl, 'contributor', 'researcher1')
    await other.close()
    await otherCtx.close()

    const page = await browser.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="tab-users"]')
      await page.waitForSelector('[data-testid="users-table"]')
      await page.waitForSelector('[data-testid="user-row"][data-login="researcher1"]')
      await page.select('[data-testid="user-row"][data-login="researcher1"] [data-testid="user-role-select"]', 'admin')

      const role = await page.evaluate(() =>
        fetch('/api/users', { credentials: 'include' })
          .then((r) => r.json())
          .then((d) => d.users.find((u) => u.login === 'researcher1')?.role),
      )
      assert.equal(role, 'admin', 'researcher1 promoted to admin')
      await page.screenshot({ path: join(SHOTS, 'phase3-users.png') })
    } finally {
      await page.close()
    }
  })
})

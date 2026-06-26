import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { startServer } from './lib/server.js'
import { launchBrowser, VIEWPORTS } from './lib/browser.js'
import { loginAs, apiCreate, kebabAction } from './lib/helpers.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const imgPath = join(tmpdir(), 'cfe-crud-img.png')
writeFileSync(imgPath, Buffer.from(PNG_B64, 'base64'))

let server, browser
before(async () => {
  server = await startServer({ port: 8817 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const titles = (page) => page.$$eval('[data-testid="cfe-card"] h3', (hs) => hs.map((h) => h.textContent.trim()))

async function cardByTitle(page, t) {
  for (const c of await page.$$('[data-testid="cfe-card"]')) {
    const h = await c.$eval('h3', (el) => el.textContent).catch(() => '')
    if (h.includes(t)) return c
  }
  return null
}

// Create a CFE via the editable card (Submit a CFE → card editor). Lands in the All view.
async function createCfe(page, baseUrl, { name, github = 'https://github.com/x/y' }) {
  await page.goto(`${baseUrl}/cfes`, { waitUntil: 'networkidle0' })
  await page.click('[data-testid="submit-cfe-btn"]')
  await page.waitForSelector('[data-testid="cfe-card-edit"]')
  await page.type('[data-testid="editor-title"]', name)
  await page.type('[data-testid="cfe-github"]', github)
  await Promise.all([
    page.waitForFunction((n) => [...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes(n)), {}, name),
    page.click('[data-testid="editor-save"]'),
  ])
}

async function rename(page, newName) {
  await page.waitForSelector('[data-testid="cfe-card-edit"]')
  await page.click('[data-testid="editor-title"]', { clickCount: 3 })
  await page.type('[data-testid="editor-title"]', newName)
  await Promise.all([
    page.waitForFunction((n) => [...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes(n)), {}, newName),
    page.click('[data-testid="editor-save"]'),
  ])
}

describe('CFE CRUD + authorization', () => {
  test('owner (non-admin) can edit and delete their own CFE via the ⋮ menu', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    try {
      await loginAs(page, server.baseUrl, null, 'alice')
      await createCfe(page, server.baseUrl, { name: 'Alice CFE' })

      // Edit via kebab.
      await kebabAction(page, await cardByTitle(page, 'Alice CFE'), 'manage-edit')
      await rename(page, 'Alice CFE v2')

      // Delete via kebab.
      await kebabAction(page, await cardByTitle(page, 'Alice CFE v2'), 'manage-delete')
      await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes('Alice CFE v2')))
      assert.ok(!(await titles(page)).includes('Alice CFE v2'), 'deleted CFE is gone')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('a non-owner non-admin cannot manage someone else’s CFE (no ⋮ + API 403)', async () => {
    let cfeId
    const aCtx = await browser.createBrowserContext()
    const a = await aCtx.newPage()
    try {
      await loginAs(a, server.baseUrl, null, 'owner1')
      await createCfe(a, server.baseUrl, { name: 'Owned CFE' })
      cfeId = await a.evaluate(async () => {
        const { items } = await (await fetch('/api/content?type=cfe', { credentials: 'include' })).json()
        return items.find((c) => c.title === 'Owned CFE').id
      })
    } finally {
      await a.close(); await aCtx.close()
    }

    const bCtx = await browser.createBrowserContext()
    const b = await bCtx.newPage()
    try {
      await loginAs(b, server.baseUrl, null, 'stranger')
      await b.goto(`${server.baseUrl}/cfes`, { waitUntil: 'networkidle0' })
      const card = await cardByTitle(b, 'Owned CFE')
      assert.equal(await card.$('[data-testid="manage-menu"]'), null, 'stranger sees no ⋮ menu')
      const codes = await b.evaluate(async (id) => {
        const put = await fetch(`/api/content/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'hijack' }) })
        const del = await fetch(`/api/content/${id}`, { method: 'DELETE', credentials: 'include' })
        return [put.status, del.status]
      }, cfeId)
      assert.deepEqual(codes, [403, 403], 'PUT and DELETE on another user’s CFE are forbidden')
    } finally {
      await b.close(); await bCtx.close()
    }
  })

  test('a non-admin author cannot self-review (reviewed is admin-only)', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, null, 'selfreview')
      await createCfe(page, server.baseUrl, { name: 'Self Review CFE' })
      // No review action in the owner's menu, and a raw PUT can't set reviewed.
      const card = await cardByTitle(page, 'Self Review CFE')
      await card.$eval('[data-testid="manage-menu"]', (b) => b.click())
      await page.waitForSelector('[data-testid="manage-menu-panel"]')
      assert.equal(await card.$('[data-testid="cfe-review"]'), null, 'no review action for non-admin owner')
      const reviewed = await page.evaluate(async () => {
        const { items } = await (await fetch('/api/content?type=cfe', { credentials: 'include' })).json()
        const c = items.find((x) => x.title === 'Self Review CFE')
        await fetch(`/api/content/${c.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metadata: { ...c.metadata, reviewed: true } }) })
        const after = await (await fetch('/api/content?type=cfe', { credentials: 'include' })).json()
        return !!after.items.find((x) => x.title === 'Self Review CFE').metadata.reviewed
      })
      assert.equal(reviewed, false, 'server kept reviewed=false for a non-admin')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('admin can edit, delete, and review any CFE; reviewed CFE renders on the landing', async () => {
    const aCtx = await browser.createBrowserContext()
    const a = await aCtx.newPage()
    try {
      await loginAs(a, server.baseUrl, null, 'maker2')
      await a.goto(`${server.baseUrl}/cfes`, { waitUntil: 'networkidle0' })
      await a.click('[data-testid="submit-cfe-btn"]')
      await a.waitForSelector('[data-testid="cfe-card-edit"]')
      await a.type('[data-testid="editor-title"]', 'Clump Scout')
      await a.type('[data-testid="cfe-github"]', 'https://github.com/zooniverse/clump-scout')
      await a.type('[data-testid="cfe-tagline"]', 'Mark clumps')
      await (await a.$('[data-testid="cfe-image-input"]')).uploadFile(imgPath)
      await a.waitForSelector('[data-testid="cfe-image-preview"]')
      await Promise.all([
        a.waitForFunction(() => [...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes('Clump Scout')), {}),
        a.click('[data-testid="editor-save"]'),
      ])
    } finally {
      await a.close(); await aCtx.close()
    }

    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    admin.on('dialog', (d) => d.accept())
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await admin.goto(`${server.baseUrl}/cfes`, { waitUntil: 'networkidle0' })
      assert.ok(await (await cardByTitle(admin, 'Clump Scout')).$('[data-testid="manage-menu"]'), 'admin sees ⋮ on others’ CFE')

      // Review it via the kebab.
      await kebabAction(admin, await cardByTitle(admin, 'Clump Scout'), 'cfe-review')
      await admin.waitForFunction(() => {
        const c = [...document.querySelectorAll('[data-testid="cfe-card"]')].find((el) => el.querySelector('h3')?.textContent.includes('Clump Scout'))
        return c && !c.querySelector('[data-testid="cfe-inprogress-badge"]')
      })

      // Admin edits it.
      await kebabAction(admin, await cardByTitle(admin, 'Clump Scout'), 'manage-edit')
      await rename(admin, 'Clump Scout (curated)')
    } finally {
      await admin.close(); await adminCtx.close()
    }

    // Public landing (signed out, reviewed-only) shows it with image + repo link; layout 2-col→1-col.
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.setViewport(VIEWPORTS.desktop)
      await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="cfe-card"]')
      assert.ok((await titles(page)).some((t) => t.includes('curated')), 'reviewed CFE on landing')
      const repo = await page.$('[data-testid="cfe-repo-link"]')
      assert.equal(await repo.evaluate((aEl) => aEl.target), '_blank', 'repo link opens new tab')
      assert.ok((await page.$eval('[data-testid="cfe-image"]', (el) => el.getAttribute('src'))).startsWith('data:image/'), 'base64 image renders')
      const cols = () => page.$eval('[data-testid="cfe-card"]', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      assert.equal(await cols(), 2, 'two columns at desktop')
      await page.setViewport(VIEWPORTS.mobile)
      await page.reload({ waitUntil: 'networkidle0' })
      assert.equal(await cols(), 1, 'one column at mobile')
      await page.screenshot({ path: join(SHOTS, 'cfe-crud-landing.png') })
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('CFEs is one page with a Reviewed/All toggle (no separate All-CFEs nav link)', async () => {
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await apiCreate(admin, { type: 'cfe', title: 'Reviewed One', metadata: { github_url: 'https://github.com/a/b', reviewed: true } })
      await apiCreate(admin, { type: 'cfe', title: 'WIP One', metadata: { github_url: 'https://github.com/c/d', reviewed: false } })
    } finally {
      await admin.close(); await adminCtx.close()
    }

    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="cfe-view-toggle"]')
      assert.equal(await page.$('[data-testid="nav-all-cfes"]'), null, 'All CFEs nav link removed')

      await page.waitForSelector('[data-testid="cfe-card"]')
      let shown = await titles(page)
      assert.ok(shown.includes('Reviewed One') && !shown.includes('WIP One'), `reviewed view, got ${shown}`)

      await page.click('[data-testid="cfe-view-all"]')
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes('WIP One')))
      shown = await titles(page)
      assert.ok(shown.includes('Reviewed One') && shown.includes('WIP One'), `all view, got ${shown}`)
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

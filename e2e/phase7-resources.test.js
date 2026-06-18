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
  server = await startServer({ port: 8807 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

async function nodeIdByTitle(page, title) {
  return page.evaluate((t) => {
    const n = [...document.querySelectorAll('[data-testid="tree-node"]')].find((el) => (el.querySelector('span')?.textContent || '').trim() === t)
    return n ? n.getAttribute('data-id') : null
  }, title)
}
async function newNode(page, fields, before) {
  await page.waitForSelector('[data-testid="new-root-btn"]')
  await page.click('[data-testid="new-root-btn"]')
  await page.waitForSelector('[data-testid="editor-title"]')
  await page.type('[data-testid="editor-title"]', fields.title)
  await page.select('[data-testid="editor-type"]', fields.type)
  if (fields.parentId) await page.select('[data-testid="editor-parent"]', String(fields.parentId))
  if (fields.body) await page.type('[data-testid="md-editor"]', fields.body)
  if (before) await before(page)
  await page.click('[data-testid="editor-save"]')
  await page.waitForFunction(
    (t) => {
      const inTree = [...document.querySelectorAll('[data-testid="tree-node"] span')].some((s) => s.textContent.includes(t))
      return inTree && !document.querySelector('[data-testid="editor"]')
    },
    {},
    fields.title,
  )
}

describe('Phase 7 — resources section + external links', () => {
  test('admin builds a Resources section with a page + an external API-docs link', async () => {
    const admin = await browser.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      await admin.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })

      await newNode(admin, { title: 'Resources', type: 'section' })
      const resId = await nodeIdByTitle(admin, 'Resources')
      await newNode(admin, { title: 'Getting Started', type: 'page', body: '# Getting Started\nWelcome aboard.', parentId: resId })
      await newNode(admin, { title: 'API Documentation', type: 'external_link', parentId: resId }, async (p) => {
        await p.waitForSelector('[data-testid="ext-href"]')
        await p.type('[data-testid="ext-href"]', 'https://help.zooniverse.org/')
      })
    } finally {
      await admin.close()
    }

    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(server.baseUrl, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="nav-resources"]')
      await page.waitForSelector('[data-testid="resources-menu"]')
      const items = await page.$$eval('[data-testid="resources-menu"] a', (as) =>
        as.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target') })),
      )
      assert.ok(items.some((i) => i.text.startsWith('Getting Started')), 'page in dropdown')
      const apiDocs = items.find((i) => i.text.startsWith('API Documentation'))
      assert.ok(apiDocs, 'external link in dropdown')
      assert.equal(apiDocs.target, '_blank', 'API docs opens new tab')
      assert.match(apiDocs.href, /help\.zooniverse\.org/, 'API docs points to help.zooniverse.org')
      await page.screenshot({ path: join(SHOTS, 'phase7-resources-menu.png') })

      // The page itself renders its markdown.
      const pageLink = items.find((i) => i.text.startsWith('Getting Started')).href
      await page.goto(`${server.baseUrl}${pageLink}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="resource-page"]')
      const h1 = await page.$eval('[data-testid="resource-page"] h1', (el) => el.textContent)
      assert.match(h1, /Getting Started/)
      await page.screenshot({ path: join(SHOTS, 'phase7-resource-page.png') })
    } finally {
      await page.close()
      await ctx.close()
    }
  })
})

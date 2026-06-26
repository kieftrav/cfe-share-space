import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, apiCreate, kebabAction } from './lib/helpers.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8821 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const itemTitles = (page) => page.$$eval('[data-testid="resource-item"] a', (as) => as.map((a) => a.textContent.replace('↗', '').trim()))

describe('Resources CRUD (admin only)', () => {
  test('admin creates the section, adds a page + link, edits, reorders, deletes', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    page.on('dialog', (d) => d.accept())
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/resources`, { waitUntil: 'networkidle0' })

      // Create the Resources section.
      await page.click('[data-testid="create-resources-btn"]')
      await page.waitForSelector('[data-testid="add-page-btn"]')

      // Add a page.
      await page.click('[data-testid="add-page-btn"]')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.type('[data-testid="editor-title"]', 'Getting Started')
      await page.type('[data-testid="md-editor"]', 'Clone the template.')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="resource-item"] a')].some((a) => a.textContent.includes('Getting Started')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // Add an external link.
      await page.click('[data-testid="add-link-btn"]')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.type('[data-testid="editor-title"]', 'API Docs')
      await page.type('[data-testid="ext-href"]', 'https://help.zooniverse.org/')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="resource-item"] a')].some((a) => a.textContent.includes('API Docs')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      assert.deepEqual(await itemTitles(page), ['Getting Started', 'API Docs'], 'creation order')

      // Reorder: move Getting Started down (via ⋮).
      await kebabAction(page, await page.$('[data-testid="resource-item"]'), 'res-down')
      await page.waitForFunction(() => {
        const ts = [...document.querySelectorAll('[data-testid="resource-item"] a')].map((a) => a.textContent)
        return ts[0].includes('API Docs')
      })
      assert.deepEqual(await itemTitles(page), ['API Docs', 'Getting Started'], 'order after reorder')

      // Edit the page title (via ⋮).
      await kebabAction(page, (await page.$$('[data-testid="resource-item"]'))[1], 'manage-edit')
      await page.waitForSelector('[data-testid="content-editor"]')
      await page.click('[data-testid="editor-title"]', { clickCount: 3 })
      await page.type('[data-testid="editor-title"]', 'Quickstart')
      await Promise.all([
        page.waitForFunction(() => [...document.querySelectorAll('[data-testid="resource-item"] a')].some((a) => a.textContent.includes('Quickstart')), {}),
        page.click('[data-testid="editor-save"]'),
      ])

      // The page is reachable + renders (title once).
      const gsHref = await page.$$eval('[data-testid="resource-item"] a', (as) => as.find((a) => a.textContent.includes('Quickstart')).getAttribute('href'))
      await page.goto(`${server.baseUrl}${gsHref}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="resource-page"]')
      assert.equal(await page.$eval('[data-testid="resource-page"] h1', (h) => h.textContent.trim()), 'Quickstart')

      // Delete the link.
      await page.goto(`${server.baseUrl}/resources`, { waitUntil: 'networkidle0' })
      const apiItem = await page.evaluateHandle(() => [...document.querySelectorAll('[data-testid="resource-item"]')].find((el) => el.textContent.includes('API Docs')))
      await kebabAction(page, apiItem.asElement(), 'manage-delete')
      await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="resource-item"] a')].some((a) => a.textContent.includes('API Docs')))
      assert.deepEqual(await itemTitles(page), ['Quickstart'], 'link deleted')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('non-admins see no management controls on Resources', async () => {
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      const sec = await apiCreate(admin, { type: 'section', title: 'Resources', slug: 'resources' })
      await apiCreate(admin, { type: 'page', parent_id: sec.id, title: 'FAQ', body_markdown: 'stuff' })
    } finally {
      await admin.close(); await adminCtx.close()
    }
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${server.baseUrl}/resources`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="resource-item"]')
      assert.equal(await page.$('[data-testid="add-page-btn"]'), null, 'no add-page button for anon')
      assert.equal(await page.$('[data-testid="manage-menu"]'), null, 'no manage controls for anon')
    } finally {
      await page.close(); await ctx.close()
    }
  })

  test('a resource page shows its title once, even if the body repeats it as a heading', async () => {
    let faqId
    const adminCtx = await browser.createBrowserContext()
    const admin = await adminCtx.newPage()
    try {
      await loginAs(admin, server.baseUrl, 'admin')
      const sec = await apiCreate(admin, { type: 'section', title: 'Resources', slug: 'resources' })
      const faq = await apiCreate(admin, { type: 'page', parent_id: sec.id, title: 'FAQ', body_markdown: '# FAQ\n\n**Who can post?** Members.' })
      faqId = faq.id
    } finally {
      await admin.close(); await adminCtx.close()
    }

    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${server.baseUrl}/resources/${faqId}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="resource-page"]')
      const faqHeadings = await page.$$eval('[data-testid="resource-page"] :is(h1,h2,h3,h4,h5,h6)', (hs) =>
        hs.map((h) => h.textContent.trim()).filter((t) => t.toLowerCase() === 'faq').length,
      )
      assert.equal(faqHeadings, 1, 'the title "FAQ" should appear as a heading exactly once')
      const body = await page.$eval('[data-testid="resource-page"]', (el) => el.textContent)
      assert.match(body, /Who can post/, 'body content still renders')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

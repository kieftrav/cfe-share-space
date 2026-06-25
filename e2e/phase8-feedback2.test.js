import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'
import { loginAs, apiCreate } from './lib/helpers.js'

let server, browser
before(async () => {
  server = await startServer({ port: 8816 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

const gridTitles = (page) => page.$$eval('[data-testid="cfe-card"] h3', (hs) => hs.map((h) => h.textContent.trim()))

describe('Feedback round 2', () => {
  test('CFEs is a single page with a Reviewed/All toggle (no separate All-CFEs nav link)', async () => {
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
      // No standalone "All CFEs" nav item anymore.
      assert.equal(await page.$('[data-testid="nav-all-cfes"]'), null, 'All CFEs nav link removed')

      // Default = Reviewed view: only the reviewed CFE.
      await page.waitForSelector('[data-testid="cfe-card"]')
      let titles = await gridTitles(page)
      assert.ok(titles.includes('Reviewed One') && !titles.includes('WIP One'), `reviewed view, got ${titles}`)

      // Toggle to All → both show.
      await page.click('[data-testid="cfe-view-all"]')
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="cfe-card"] h3')].some((h) => h.textContent.includes('WIP One')))
      titles = await gridTitles(page)
      assert.ok(titles.includes('Reviewed One') && titles.includes('WIP One'), `all view, got ${titles}`)
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

  test('an admin can add a user by Zooniverse login (pending until they sign in)', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await loginAs(page, server.baseUrl, 'admin')
      await page.goto(`${server.baseUrl}/admin`, { waitUntil: 'networkidle0' })
      await page.click('[data-testid="tab-users"]')
      await page.waitForSelector('[data-testid="add-user"]')
      await page.type('[data-testid="add-user-login"]', 'researcher9')
      await page.select('[data-testid="add-user-role"]', 'contributor')
      await Promise.all([
        page.waitForSelector('[data-testid="user-row"][data-login="researcher9"]'),
        page.click('[data-testid="add-user-submit"]'),
      ])
      const row = await page.$('[data-testid="user-row"][data-login="researcher9"]')
      assert.ok(await row.$('[data-testid="user-pending"]'), 'new user shows pending sign-in')
      const role = await row.$eval('[data-testid="user-role-select"]', (s) => s.value)
      assert.equal(role, 'contributor', 'new user has the granted role')

      // Backend reflects the pending grant.
      const apiRole = await page.evaluate(async () => {
        const { users } = await (await fetch('/api/users', { credentials: 'include' })).json()
        return users.find((u) => u.login === 'researcher9')?.role
      })
      assert.equal(apiRole, 'contributor', 'role persisted server-side')
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

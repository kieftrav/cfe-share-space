import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from './lib/server.js'
import { launchBrowser } from './lib/browser.js'

const SHOTS = join(import.meta.dirname, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

let server, browser
before(async () => {
  server = await startServer({ port: 8813 })
  browser = await launchBrowser()
})
after(async () => {
  if (browser) await browser.close()
  if (server) await server.stop()
})

describe('Landing volunteer callout', () => {
  test('signed-out landing shows a callout linking to the Zooniverse CFE page in a new tab', async () => {
    const ctx = await browser.createBrowserContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="volunteer-callout"]')
      const link = await page.$('[data-testid="volunteer-callout-link"]')
      assert.ok(link, 'callout link present')
      assert.equal(await link.evaluate((a) => a.target), '_blank', 'opens in a new tab')
      assert.match(await link.evaluate((a) => a.href), /zooniverse\.org/, 'links to Zooniverse')
      await page.screenshot({ path: join(SHOTS, 'volunteer-callout.png') })
    } finally {
      await page.close(); await ctx.close()
    }
  })
})

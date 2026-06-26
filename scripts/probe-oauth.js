// Drive the real redirect OAuth flow and report exactly where it lands.
import puppeteer from 'puppeteer'
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:8787'
const env = readFileSync('/Users/traviskiefer/Documents/GitHub/_tasks/.env', 'utf8')
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const USER = get('ZOO_USERNAME') || get('PANOPTES_USERNAME')
const PASS = get('ZOO_PASSWORD') || get('PANOPTES_PASSWORD')

const log = (...a) => console.log('[probe]', ...a)
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--ignore-certificate-errors'], protocolTimeout: 60000 })
const page = await browser.newPage()
try {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  log('home loaded; clicking the Sign in BUTTON (real user path)')
  await page.waitForSelector('[data-testid="auth-button"]')
  await page.click('[data-testid="auth-button"]')
  // The button does a full-page navigation; wait until we leave the app origin.
  await page.waitForFunction(() => !location.origin.includes('localhost:8787'), { timeout: 60000 })
  await new Promise((r) => setTimeout(r, 1500))
  log('after button click, url:', page.url())

  // Detect an invalid redirect_uri / app error page
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400))
  if (/redirect/i.test(bodyText) && /(not valid|mismatch|doesn|invalid)/i.test(bodyText)) {
    log('ZOONIVERSE ERROR (redirect_uri not registered?):', JSON.stringify(bodyText))
    await browser.close(); process.exit(2)
  }

  if (await page.$('#user_login')) {
    log('login page: submitting credentials')
    await page.type('#user_login', USER)
    await page.type('#user_password', PASS)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      page.click('input[type="submit"][name="commit"]'),
    ])
    await new Promise((r) => setTimeout(r, 1500))
    log('after login, url:', page.url())
  }

  if (page.url().includes('/oauth/authorize')) {
    log('consent page: approving')
    await page.evaluate(() => {
      for (const i of document.querySelectorAll('input[type="submit"], button')) {
        const v = (i.value || i.textContent || '').toLowerCase()
        if (v.includes('authorize') || v.includes('yes') || v.includes('allow')) { i.click(); return }
      }
    })
    await page.waitForNavigation({ timeout: 60000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 1500))
  }

  const errText = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '')
  log('final url:', page.url())
  if (!page.url().startsWith(BASE)) {
    log('DID NOT return to app. Page text:', JSON.stringify(errText))
    await browser.close(); process.exit(3)
  }

  const me = await page.evaluate(() => fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json()))
  log('SESSION /api/auth/me:', JSON.stringify(me))
  await browser.close()
  process.exit(me.user ? 0 : 4)
} catch (e) {
  log('EXCEPTION:', e.message)
  await browser.close()
  process.exit(5)
}

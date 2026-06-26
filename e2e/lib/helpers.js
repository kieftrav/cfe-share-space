import { readFileSync } from 'node:fs'

// Read the user's Zooniverse login/password from _tasks/.env (for the real OOB test).
export function zooCreds() {
  try {
    const txt = readFileSync('/Users/traviskiefer/Documents/GitHub/_tasks/.env', 'utf8')
    const get = (k) => {
      const m = txt.match(new RegExp('^' + k + '=(.*)$', 'm'))
      return m ? m[1].trim() : undefined
    }
    return {
      username: get('ZOO_USERNAME') || get('PANOPTES_USERNAME'),
      password: get('ZOO_PASSWORD') || get('PANOPTES_PASSWORD'),
    }
  } catch {
    return {}
  }
}

// Test-only login (CFE_TEST_MODE) via the in-page fetch so the httpOnly cookie is set
// in the browser, then reload so the SPA reads the session.
export async function loginAs(page, baseUrl, role = 'admin', login = `${role}_test`) {
  await page.goto(baseUrl, { waitUntil: 'networkidle0' })
  await page.evaluate(
    async (r, l) => {
      await fetch('/api/auth/test-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r, login: l }),
      })
    },
    role,
    login,
  )
  await page.goto(baseUrl, { waitUntil: 'networkidle0' })
}

// Create a content row via the API from the page context (preconditions for tests
// whose subject is a different surface). Returns the created item.
export async function apiCreate(page, payload) {
  return page.evaluate(async (p) => {
    const r = await fetch('/api/content', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || r.status)
    return d.item
  }, payload)
}

// Open an item's ⋮ (ManageMenu) and click one of its actions. `scope` is the
// ElementHandle of the item (card / row / li) that contains the menu.
export async function kebabAction(page, scope, actionTestid) {
  await scope.$eval('[data-testid="manage-menu"]', (b) => b.click())
  await page.waitForSelector('[data-testid="manage-menu-panel"]')
  await scope.$eval(`[data-testid="${actionTestid}"]`, (b) => b.click())
}

export async function postStatus(page, payload) {
  return page.evaluate(async (p) => {
    const r = await fetch('/api/content', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
    return r.status
  }, payload)
}

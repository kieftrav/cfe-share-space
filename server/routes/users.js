import { Router } from 'express'
import { db } from '../db.js'
import { requireRole } from '../auth.js'

const r = Router()

r.get('/', requireRole('admin'), (_req, res) => {
  // Real (signed-in) users, plus role grants keyed by login for people who haven't
  // signed in yet (reconciled to their real id on first sign-in — see auth.upsertUser).
  const rows = db
    .prepare(
      `SELECT u.zooniverse_id AS id, u.login, u.display_name, r.role, 0 AS pending
         FROM users u LEFT JOIN roles r ON r.zooniverse_id = u.zooniverse_id
       UNION ALL
       SELECT r.zooniverse_id AS id, substr(r.zooniverse_id, 7) AS login,
              substr(r.zooniverse_id, 7) AS display_name, r.role, 1 AS pending
         FROM roles r
        WHERE r.zooniverse_id LIKE 'login:%'
        ORDER BY login`,
    )
    .all()
  res.json({ users: rows })
})

// Add a user by Zooniverse login + role. If they've already signed in, the role lands
// on their real account; otherwise it's stored as a pending grant keyed by login.
r.post('/', requireRole('admin'), (req, res) => {
  const login = String(req.body?.login || '').trim()
  const { role } = req.body || {}
  if (!login) return res.status(400).json({ error: 'login required' })
  if (!['admin', 'contributor'].includes(role)) return res.status(400).json({ error: 'bad role' })
  const existing = db.prepare('SELECT zooniverse_id FROM users WHERE login = ?').get(login)
  const id = existing ? existing.zooniverse_id : `login:${login}`
  db.prepare(
    `INSERT OR REPLACE INTO roles (zooniverse_id, role, granted_by, granted_at) VALUES (?, ?, ?, ?)`,
  ).run(id, role, req.user.id, new Date().toISOString())
  res.status(201).json({ ok: true, id, pending: !existing })
})

r.put('/:id/role', requireRole('admin'), (req, res) => {
  const { role } = req.body || {}
  const id = req.params.id
  const now = new Date().toISOString()
  if (role === null || role === undefined || role === '') {
    db.prepare('DELETE FROM roles WHERE zooniverse_id = ?').run(id)
  } else if (['admin', 'contributor'].includes(role)) {
    db.prepare(
      `INSERT OR REPLACE INTO roles (zooniverse_id, role, granted_by, granted_at) VALUES (?, ?, ?, ?)`,
    ).run(id, role, req.user.id, now)
  } else {
    return res.status(400).json({ error: 'bad role' })
  }
  res.json({ ok: true })
})

export default r

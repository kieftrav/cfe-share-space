import { Router } from 'express'
import { db } from '../db.js'
import { requireRole } from '../auth.js'

const r = Router()

r.get('/', requireRole('admin'), (_req, res) => {
  // Real (signed-in) users plus pending role grants keyed by login (reconciled on first sign-in).
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

// Add a user by login + role; lands on their account if they've signed in, else stored as pending.
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

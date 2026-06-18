import { Router } from 'express'
import { db } from '../db.js'
import { requireRole } from '../auth.js'

const r = Router()

r.get('/', requireRole('admin'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.zooniverse_id AS id, u.login, u.display_name, r.role
       FROM users u LEFT JOIN roles r ON r.zooniverse_id = u.zooniverse_id
       ORDER BY u.login`,
    )
    .all()
  res.json({ users: rows })
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

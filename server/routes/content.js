import { Router } from 'express'
import * as C from '../content.js'
import { requireRole } from '../auth.js'

const r = Router()
const CONTRIB_TYPES = new Set(['thread', 'reply', 'cfe'])

r.get('/', (req, res) => {
  const includeDrafts = req.user?.role === 'admin'
  const type = req.query.type
  const parent = req.query.parent !== undefined ? Number(req.query.parent) : undefined
  res.json({ items: C.list({ type, parent, includeDrafts }) })
})

r.get('/tree', (req, res) => {
  res.json({ tree: C.tree({ includeDrafts: req.user?.role === 'admin' }) })
})

r.get('/search', (req, res) => {
  res.json({ results: C.search(req.query.q) })
})

r.get('/:id', (req, res) => {
  const item = C.get(Number(req.params.id))
  if (!item) return res.status(404).json({ error: 'not found' })
  if (item.status !== 'published' && req.user?.role !== 'admin') return res.status(404).json({ error: 'not found' })
  res.json({ item, children: C.list({ parent: item.id, includeDrafts: req.user?.role === 'admin' }) })
})

r.post('/', requireRole('contributor'), (req, res) => {
  const f = req.body || {}
  if (!f.type) return res.status(400).json({ error: 'type required' })
  if (req.user.role !== 'admin' && !CONTRIB_TYPES.has(f.type)) {
    return res.status(403).json({ error: `type '${f.type}' requires admin` })
  }
  res.status(201).json({ item: C.create(f, req.user) })
})

r.put('/:id', requireRole('contributor'), (req, res) => {
  const id = Number(req.params.id)
  const existing = C.get(id)
  if (!existing) return res.status(404).json({ error: 'not found' })
  if (req.user.role !== 'admin' && existing.author_id !== req.user.id) {
    return res.status(403).json({ error: 'not your content' })
  }
  res.json({ item: C.update(id, req.body || {}) })
})

r.delete('/:id', requireRole('contributor'), (req, res) => {
  const id = Number(req.params.id)
  const existing = C.get(id)
  if (!existing) return res.status(404).json({ error: 'not found' })
  if (req.user.role !== 'admin' && existing.author_id !== req.user.id) {
    return res.status(403).json({ error: 'not your content' })
  }
  C.remove(id)
  res.json({ ok: true })
})

export default r

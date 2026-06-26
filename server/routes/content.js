import { Router } from 'express'
import * as C from '../content.js'
import { requireRole } from '../auth.js'

const r = Router()
const CONTRIB_TYPES = new Set(['thread', 'reply', 'cfe'])

// Discussion is sign-in-only; every other type stays publicly readable.
const DISCUSSION_TYPES = new Set(['category', 'thread', 'reply'])
const isDiscussion = (t) => DISCUSSION_TYPES.has(t)

function pruneDiscussion(nodes) {
  return nodes
    .filter((n) => !isDiscussion(n.type))
    .map((n) => (n.children ? { ...n, children: pruneDiscussion(n.children) } : n))
}

r.get('/', (req, res) => {
  const includeDrafts = req.user?.role === 'admin'
  const type = req.query.type
  const parent = req.query.parent !== undefined ? Number(req.query.parent) : undefined
  if (!req.user && type && isDiscussion(type)) return res.status(403).json({ error: 'sign in to view discussions' })
  let items = C.list({ type, parent, includeDrafts })
  if (!req.user) items = items.filter((i) => !isDiscussion(i.type))
  res.json({ items })
})

r.get('/tree', (req, res) => {
  let tree = C.tree({ includeDrafts: req.user?.role === 'admin' })
  if (!req.user) tree = pruneDiscussion(tree)
  res.json({ tree })
})

r.get('/search', (req, res) => {
  let results = C.search(req.query.q)
  if (!req.user) results = results.filter((x) => !isDiscussion(x.type))
  res.json({ results })
})

r.get('/:id', (req, res) => {
  const item = C.get(Number(req.params.id))
  if (!item) return res.status(404).json({ error: 'not found' })
  if (item.status !== 'published' && req.user?.role !== 'admin') return res.status(404).json({ error: 'not found' })
  if (!req.user && isDiscussion(item.type)) return res.status(403).json({ error: 'sign in to view discussions' })
  res.json({ item, children: C.list({ parent: item.id, includeDrafts: req.user?.role === 'admin' }) })
})

r.post('/', requireRole('contributor'), (req, res) => {
  const f = req.body || {}
  if (!f.type) return res.status(400).json({ error: 'type required' })
  if (req.user.role !== 'admin' && !CONTRIB_TYPES.has(f.type)) {
    return res.status(403).json({ error: `type '${f.type}' requires admin` })
  }
  // 'reviewed' (lands a CFE on the public landing) is an admin-only flag.
  if (req.user.role !== 'admin' && f.metadata) f.metadata.reviewed = false
  res.status(201).json({ item: C.create(f, req.user) })
})

r.put('/:id', requireRole('contributor'), (req, res) => {
  const id = Number(req.params.id)
  const existing = C.get(id)
  if (!existing) return res.status(404).json({ error: 'not found' })
  if (req.user.role !== 'admin' && existing.author_id !== req.user.id) {
    return res.status(403).json({ error: 'not your content' })
  }
  const body = req.body || {}
  // Non-admins can never change 'reviewed': preserve whatever an admin set.
  if (req.user.role !== 'admin' && body.metadata) body.metadata.reviewed = !!existing.metadata?.reviewed
  res.json({ item: C.update(id, body) })
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

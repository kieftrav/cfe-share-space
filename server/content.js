import { db } from './db.js'

const FIELDS = ['type', 'title', 'slug', 'body_markdown', 'parent_id', 'position', 'status', 'metadata']

function rowOut(r) {
  if (!r) return null
  return { ...r, metadata: JSON.parse(r.metadata || '{}') }
}

function metaText(meta) {
  const out = []
  for (const [k, v] of Object.entries(meta || {})) {
    if (k === 'image') continue // never index the base64 blob
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) out.push(v.filter((x) => typeof x === 'string').join(' '))
  }
  return out.join(' ')
}

// Rebuild the FTS5 row for one content id. Only published content is indexed.
export function reindex(id) {
  db.prepare('DELETE FROM search_index WHERE content_id = ?').run(id)
  const row = db.prepare('SELECT * FROM content WHERE id = ?').get(id)
  if (!row || row.status !== 'published') return
  const meta = JSON.parse(row.metadata || '{}')
  const body = [row.title, row.body_markdown, metaText(meta)].join(' ')
  db.prepare('INSERT INTO search_index (content_id, type, title, body) VALUES (?, ?, ?, ?)').run(
    id, row.type, row.title, body,
  )
}

function nextPosition(parent_id) {
  const r = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM content WHERE IFNULL(parent_id, -1) = IFNULL(?, -1)')
    .get(parent_id ?? null)
  return r.n
}

function bumpActivity(id) {
  const now = new Date().toISOString()
  db.prepare('UPDATE content SET last_activity_at = ? WHERE id = ?').run(now, id)
}

export function get(id) {
  return rowOut(db.prepare('SELECT * FROM content WHERE id = ?').get(id))
}

export function list({ type, parent, includeDrafts } = {}) {
  const where = []
  const args = []
  if (type) { where.push('type = ?'); args.push(type) }
  if (parent !== undefined) { where.push('IFNULL(parent_id, -1) = IFNULL(?, -1)'); args.push(parent) }
  if (!includeDrafts) where.push("status = 'published'")
  const sql = `SELECT * FROM content ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY position, id`
  return db.prepare(sql).all(...args).map(rowOut)
}

export function tree({ includeDrafts } = {}) {
  const all = list({ includeDrafts })
  const byId = new Map(all.map((n) => [n.id, { ...n, children: [] }]))
  const roots = []
  for (const n of byId.values()) {
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id).children.push(n)
    else roots.push(n)
  }
  return roots
}

export function create(f, author) {
  const now = new Date().toISOString()
  const r = db
    .prepare(
      `INSERT INTO content (type, title, slug, body_markdown, parent_id, position, author_id, status, metadata, created_at, updated_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      f.type,
      f.title || '',
      f.slug || null,
      f.body_markdown || '',
      f.parent_id ?? null,
      f.position ?? nextPosition(f.parent_id ?? null),
      author?.id || null,
      f.status || 'published',
      JSON.stringify(f.metadata || {}),
      now, now, now,
    )
  const id = Number(r.lastInsertRowid)
  if (f.parent_id) bumpActivity(f.parent_id)
  reindex(id)
  return get(id)
}

export function update(id, f) {
  const sets = []
  const args = []
  for (const k of FIELDS) {
    if (f[k] === undefined) continue
    sets.push(`${k} = ?`)
    args.push(k === 'metadata' ? JSON.stringify(f[k] || {}) : f[k])
  }
  if (!sets.length) return get(id)
  sets.push('updated_at = ?')
  args.push(new Date().toISOString())
  args.push(id)
  db.prepare(`UPDATE content SET ${sets.join(', ')} WHERE id = ?`).run(...args)
  reindex(id)
  return get(id)
}

export function remove(id) {
  const kids = db.prepare('SELECT id FROM content WHERE parent_id = ?').all(id)
  for (const k of kids) remove(k.id)
  db.prepare('DELETE FROM search_index WHERE content_id = ?').run(id)
  db.prepare('DELETE FROM content WHERE id = ?').run(id)
}

export function search(q) {
  q = (q || '').trim()
  if (q.length < 3) {
    return db
      .prepare("SELECT id AS content_id, type, title FROM content WHERE status = 'published' AND title LIKE ? ORDER BY title LIMIT 50")
      .all(`%${q}%`)
      .map((r) => ({ ...r, snippet: '' }))
  }
  const phrase = '"' + q.replace(/"/g, '""') + '"'
  return db
    .prepare(
      "SELECT content_id, type, title, snippet(search_index, 3, '[', ']', '…', 10) AS snippet FROM search_index WHERE search_index MATCH ? ORDER BY bm25(search_index) LIMIT 50",
    )
    .all(phrase)
}

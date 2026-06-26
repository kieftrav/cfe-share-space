import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'
import { ContentEditor } from '../components/ContentEditor'
import { ManageMenu } from '../components/ManageMenu'
import { isAdmin } from '../store'

export function News() {
  const [items, setItems] = useState<Content[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)

  async function load() {
    const { items } = await api.get('/api/content?type=announcement')
    items.sort((a: Content, b: Content) => (b.created_at || '').localeCompare(a.created_at || ''))
    setItems(items)
  }
  useEffect(() => {
    load().catch(() => setItems([]))
  }, [])

  const admin = isAdmin()

  const busy = creating || !!editing

  return (
    <section data-testid="news">
      <div class="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 class="text-3xl font-bold text-ink-heading">News &amp; Announcements</h1>
        {admin && !busy && (
          <button data-testid="new-announcement-btn" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={() => setCreating(true)}>
            New announcement
          </button>
        )}
      </div>
      <p class="text-ink-muted mb-8">The latest from the CFE community, newest first.</p>

      {creating ? (
        <ContentEditor initial={{ type: 'announcement' }} allowStatus onSaved={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />
      ) : editing ? (
        <ContentEditor initial={editing} allowStatus onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />
      ) : (
        <div class="flex flex-col gap-6">
          {items === null && <p class="text-ink-muted">Loading…</p>}
          {items && items.length === 0 && <p data-testid="news-empty" class="text-ink-muted">No announcements yet.</p>}
          {items &&
            items.map((a) => (
              <article key={a.id} data-testid="announcement" class="bg-bg-card border border-edge rounded-md p-6">
                <div class="flex items-start justify-between gap-4">
                  <h2 class="text-xl font-bold text-ink-heading mb-1">{a.title}</h2>
                  {admin && <ManageMenu item={a} onEdit={() => setEditing(a)} onDeleted={load} />}
                </div>
                <p class="text-xs text-ink-muted mb-3">
                  {new Date(a.created_at).toLocaleString()}
                  {a.status === 'draft' && <span class="text-orange-400"> · draft</span>}
                </p>
                <Markdown source={a.body_markdown} />
              </article>
            ))}
        </div>
      )}
    </section>
  )
}

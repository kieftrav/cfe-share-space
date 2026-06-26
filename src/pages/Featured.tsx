import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'
import { ContentEditor } from '../components/ContentEditor'
import { ManageMenu } from '../components/ManageMenu'
import { isAdmin } from '../store'

export function Featured() {
  const [items, setItems] = useState<Content[] | null>(null)
  const [threads, setThreads] = useState<Content[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)

  async function load() {
    const { items } = await api.get('/api/content?type=featured')
    items.sort((a: Content, b: Content) => (b.created_at || '').localeCompare(a.created_at || ''))
    setItems(items)
  }
  useEffect(() => {
    load().catch(() => setItems([]))
    // Fetched unconditionally: isAdmin() isn't reliable at mount, and it harmlessly 403s for signed-out visitors.
    api.get('/api/content?type=thread').then(({ items }) => setThreads(items)).catch(() => {})
  }, [])

  const admin = isAdmin()
  const linkOptions = threads.map((t) => ({ id: t.id, label: t.title || `#${t.id}` }))

  const busy = creating || !!editing

  return (
    <section data-testid="featured">
      <div class="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 class="text-3xl font-bold text-ink-heading">Featured Topics</h1>
        {admin && !busy && (
          <button data-testid="new-featured-btn" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={() => setCreating(true)}>
            New featured topic
          </button>
        )}
      </div>
      <p class="text-ink-muted mb-8">Curated discussions and replies, elevated with extra context.</p>

      {creating ? (
        <ContentEditor initial={{ type: 'featured' }} allowStatus linkOptions={linkOptions} onSaved={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />
      ) : editing ? (
        <ContentEditor initial={editing} allowStatus linkOptions={linkOptions} onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />
      ) : (
        <div class="flex flex-col gap-6">
          {items === null && <p class="text-ink-muted">Loading…</p>}
          {items && items.length === 0 && <p data-testid="featured-empty" class="text-ink-muted">No featured topics yet.</p>}
          {items &&
            items.map((f) => {
              const link = f.metadata?.links_content_id
              return (
                <article key={f.id} data-testid="featured-topic" class="bg-bg-card border border-edge rounded-md p-6">
                  <div class="flex items-start justify-between gap-4">
                    <h2 class="text-xl font-bold text-ink-heading mb-2">{f.title}</h2>
                    {admin && <ManageMenu item={f} onEdit={() => setEditing(f)} onDeleted={load} />}
                  </div>
                  <Markdown source={f.body_markdown} />
                  {link && (
                    <a data-testid="featured-source-link" href={`/discussion/${link}`} class="inline-block mt-3 text-sm text-accent no-underline">
                      Go to the discussion →
                    </a>
                  )}
                </article>
              )
            })}
        </div>
      )}
    </section>
  )
}

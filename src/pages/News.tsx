import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'

export function News() {
  const [items, setItems] = useState<Content[] | null>(null)
  useEffect(() => {
    api
      .get('/api/content?type=announcement')
      .then(({ items }: { items: Content[] }) => {
        items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        setItems(items)
      })
      .catch(() => setItems([]))
  }, [])

  return (
    <section data-testid="news">
      <h1 class="text-3xl font-bold text-ink-heading mb-2">News &amp; Announcements</h1>
      <p class="text-ink-muted mb-8">The latest from the CFE community, newest first.</p>
      <div class="flex flex-col gap-6">
        {items === null && <p class="text-ink-muted">Loading…</p>}
        {items && items.length === 0 && <p data-testid="news-empty" class="text-ink-muted">No announcements yet.</p>}
        {items &&
          items.map((a) => (
            <article key={a.id} data-testid="announcement" class="bg-bg-card border border-edge rounded-xl p-6">
              <h2 class="text-xl font-bold text-ink-heading mb-1">{a.title}</h2>
              <p class="text-xs text-ink-muted mb-3">{new Date(a.created_at).toLocaleString()}</p>
              <Markdown source={a.body_markdown} />
            </article>
          ))}
      </div>
    </section>
  )
}

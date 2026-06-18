import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'

export function Featured() {
  const [items, setItems] = useState<Content[] | null>(null)
  useEffect(() => {
    api
      .get('/api/content?type=featured')
      .then(({ items }: { items: Content[] }) => {
        items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        setItems(items)
      })
      .catch(() => setItems([]))
  }, [])

  return (
    <section data-testid="featured">
      <h1 class="text-3xl font-bold text-ink-heading mb-2">Featured Topics</h1>
      <p class="text-ink-muted mb-8">Curated discussions and replies, elevated with extra context.</p>
      <div class="flex flex-col gap-6">
        {items === null && <p class="text-ink-muted">Loading…</p>}
        {items && items.length === 0 && <p data-testid="featured-empty" class="text-ink-muted">No featured topics yet.</p>}
        {items &&
          items.map((f) => {
            const link = f.metadata?.links_content_id
            return (
              <article key={f.id} data-testid="featured-topic" class="bg-bg-card border border-edge rounded-xl p-6">
                <h2 class="text-xl font-bold text-ink-heading mb-2">{f.title}</h2>
                <Markdown source={f.body_markdown} />
                {link && (
                  <a
                    data-testid="featured-source-link"
                    href={`/discussion/${link}`}
                    class="inline-block mt-3 text-sm text-accent no-underline"
                  >
                    Go to the discussion →
                  </a>
                )}
              </article>
            )
          })}
      </div>
    </section>
  )
}

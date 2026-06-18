import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'

export function Resources() {
  const [children, setChildren] = useState<Content[] | null>(null)
  useEffect(() => {
    api
      .get('/api/content/tree')
      .then(({ tree }: { tree: Content[] }) => {
        const root = tree.find((n) => n.type === 'section' && (n.slug === 'resources' || n.title.toLowerCase() === 'resources'))
        setChildren(root?.children || [])
      })
      .catch(() => setChildren([]))
  }, [])

  return (
    <section data-testid="resources">
      <h1 class="text-3xl font-bold text-ink-heading mb-6">Resources</h1>
      {children === null && <p class="text-ink-muted">Loading…</p>}
      {children && children.length === 0 && <p data-testid="resources-empty" class="text-ink-muted">No resources yet.</p>}
      <ul class="flex flex-col gap-3 list-none m-0 p-0">
        {children &&
          children.map((c) =>
            c.type === 'external_link' ? (
              <li key={c.id} class="bg-bg-card border border-edge rounded-lg px-4 py-3">
                <a href={c.metadata?.href || '#'} target="_blank" rel="noopener" class="text-ink-heading no-underline hover:text-accent">
                  {c.title} ↗
                </a>
              </li>
            ) : (
              <li key={c.id} class="bg-bg-card border border-edge rounded-lg px-4 py-3">
                <a href={`/resources/${c.id}`} class="text-ink-heading no-underline hover:text-accent">{c.title}</a>
              </li>
            ),
          )}
      </ul>
    </section>
  )
}

export function ResourcePage({ id }: { id: string }) {
  const [item, setItem] = useState<Content | null | undefined>(undefined)
  useEffect(() => {
    api.get(`/api/content/${id}`).then(({ item }) => setItem(item)).catch(() => setItem(null))
  }, [id])

  if (item === undefined) return <p class="text-ink-muted">Loading…</p>
  if (!item) return <p data-testid="resource-missing" class="text-ink-muted">Not found.</p>

  return (
    <article data-testid="resource-page">
      <h1 class="text-3xl font-bold text-ink-heading mb-4">{item.title}</h1>
      <Markdown source={item.body_markdown} />
    </article>
  )
}

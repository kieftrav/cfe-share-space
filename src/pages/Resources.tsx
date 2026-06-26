import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'
import { ContentEditor } from '../components/ContentEditor'
import { ManageMenu } from '../components/ManageMenu'
import { isAdmin } from '../store'

export function Resources() {
  const [root, setRoot] = useState<Content | null | undefined>(undefined)
  const [adding, setAdding] = useState<'page' | 'external_link' | null>(null)
  const [editing, setEditing] = useState<Content | null>(null)

  async function load() {
    const { tree } = await api.get('/api/content/tree')
    const r = (tree as Content[]).find((n) => n.type === 'section' && (n.slug === 'resources' || n.title.toLowerCase() === 'resources'))
    setRoot(r || null)
  }
  useEffect(() => {
    load().catch(() => setRoot(null))
  }, [])

  const admin = isAdmin()
  const children = root?.children || []

  async function createSection() {
    await api.post('/api/content', { type: 'section', title: 'Resources', slug: 'resources' })
    await load()
  }

  async function move(child: Content, dir: number) {
    const sibs = [...children].sort((a, b) => a.position - b.position)
    const idx = sibs.findIndex((s) => s.id === child.id)
    const swap = sibs[idx + dir]
    if (!swap) return
    await api.put(`/api/content/${child.id}`, { position: swap.position })
    await api.put(`/api/content/${swap.id}`, { position: child.position })
    await load()
  }

  const busy = !!adding || !!editing

  return (
    <section data-testid="resources">
      <div class="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 class="text-3xl font-bold text-ink-heading">Resources</h1>
        {admin && root && !busy && (
          <div class="flex gap-2">
            <button data-testid="add-page-btn" class="px-4 py-2 rounded-sm border border-edge text-ink" onClick={() => setAdding('page')}>+ Page</button>
            <button data-testid="add-link-btn" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={() => setAdding('external_link')}>+ Link</button>
          </div>
        )}
      </div>

      {busy ? (
        <ContentEditor
          initial={editing ? editing : { type: adding!, parent_id: root!.id }}
          allowStatus={(editing ? editing.type : adding) === 'page'}
          onSaved={() => { setAdding(null); setEditing(null); load() }}
          onCancel={() => { setAdding(null); setEditing(null) }}
        />
      ) : (
        <>

          {root === undefined && <p class="text-ink-muted">Loading…</p>}
          {root === null && (
            <div>
              <p data-testid="resources-empty" class="text-ink-muted mb-4">No resources yet.</p>
              {admin && <button data-testid="create-resources-btn" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={createSection}>Create Resources section</button>}
            </div>
          )}

          {root && (
            <ul class="flex flex-col gap-3 list-none m-0 p-0">
              {children.length === 0 && <li class="text-ink-muted text-sm">No resource pages yet.</li>}
              {children.map((c) => (
                <li key={c.id} data-testid="resource-item" class="bg-bg-card border border-edge rounded-sm px-4 py-3 flex items-center justify-between gap-3">
                  {c.type === 'external_link' ? (
                    <a href={c.metadata?.href || '#'} target="_blank" rel="noopener" class="text-ink-heading no-underline hover:text-accent">{c.title} ↗</a>
                  ) : (
                    <a href={`/resources/${c.id}`} class="text-ink-heading no-underline hover:text-accent">
                      {c.title}{c.status === 'draft' && <span class="text-xs text-orange-400 ml-2">draft</span>}
                    </a>
                  )}
                  {admin && (
                    <ManageMenu
                      item={c}
                      onEdit={() => setEditing(c)}
                      onDeleted={load}
                      actions={[
                        { label: '↑ Move up', testid: 'res-up', onClick: () => move(c, -1) },
                        { label: '↓ Move down', testid: 'res-down', onClick: () => move(c, 1) },
                      ]}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// Drop a leading body heading that repeats the title, so the page doesn't show it twice.
function stripLeadingTitle(md: string, title: string): string {
  const lines = (md || '').split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  const m = lines[i]?.match(/^#{1,6}\s+(.*)$/)
  if (m && m[1].trim().toLowerCase() === (title || '').trim().toLowerCase()) {
    return lines.slice(i + 1).join('\n').replace(/^\n+/, '')
  }
  return md
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
      <Markdown source={stripLeadingTitle(item.body_markdown, item.title)} />
    </article>
  )
}

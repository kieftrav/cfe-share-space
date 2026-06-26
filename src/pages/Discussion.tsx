import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { canWrite, isAdmin, canManage } from '../store'
import { ContentEditor } from '../components/ContentEditor'
import { ManageMenu } from '../components/ManageMenu'

export function Discussion() {
  const [tree, setTree] = useState<Content[] | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null) // a category or a thread
  const [newThreadCat, setNewThreadCat] = useState<number | null>(null)

  async function load() {
    const { tree } = await api.get('/api/content/tree')
    setTree(tree)
  }
  useEffect(() => {
    load().catch(() => setTree([]))
  }, [])

  const admin = isAdmin()
  const categories = (tree || []).filter((n) => n.type === 'category')
  const catOptions = categories.map((c) => ({ id: c.id, label: c.title }))

  const busy = creatingCategory || newThreadCat !== null || editing

  return (
    <section data-testid="discussion">
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 class="text-3xl font-bold text-ink-heading">Discussion</h1>
        {!busy && (
          <div class="flex gap-2">
            {admin && (
              <button data-testid="new-category-btn" class="px-4 py-2 rounded-sm border border-edge text-ink" onClick={() => setCreatingCategory(true)}>
                New category
              </button>
            )}
            {canWrite() && categories.length > 0 && (
              <button data-testid="new-thread-btn" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={() => setNewThreadCat(categories[0].id)}>
                New thread
              </button>
            )}
          </div>
        )}
      </div>

      {creatingCategory ? (
        <ContentEditor initial={{ type: 'category' }} onSaved={() => { setCreatingCategory(false); load() }} onCancel={() => setCreatingCategory(false)} />
      ) : newThreadCat !== null ? (
        <ContentEditor
          initial={{ type: 'thread', parent_id: newThreadCat }}
          titleLabel="Thread title"
          parentOptions={catOptions}
          onSaved={() => { setNewThreadCat(null); load() }}
          onCancel={() => setNewThreadCat(null)}
        />
      ) : editing ? (
        <ContentEditor
          initial={editing}
          titleLabel={editing.type === 'category' ? 'Category title' : 'Thread title'}
          parentOptions={editing.type === 'thread' ? catOptions : undefined}
          onSaved={() => { setEditing(null); load() }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          {tree === null && <p class="text-ink-muted">Loading…</p>}
          {tree && categories.length === 0 && <p data-testid="discussion-empty" class="text-ink-muted">No categories yet.</p>}
          <div class="flex flex-col gap-8">
            {categories.map((c) => {
              const threads = (c.children || []).filter((t) => t.type === 'thread')
              threads.sort((a, b) => (b.last_activity_at || '').localeCompare(a.last_activity_at || ''))
              return (
                <div key={c.id} data-testid="category">
                  <div class="flex items-center gap-3 mb-1">
                    <h2 class="text-xl font-bold text-ink-heading">{c.title}</h2>
                    {admin && <ManageMenu item={c} onEdit={() => setEditing(c)} onDeleted={load} />}
                  </div>
                  {c.body_markdown && <p class="text-ink-muted text-sm mb-3">{c.body_markdown}</p>}
                  <ul class="flex flex-col gap-2 list-none m-0 p-0">
                    {threads.length === 0 && <li class="text-ink-muted text-sm">No threads yet.</li>}
                    {threads.map((t) => (
                      <li key={t.id} data-testid="thread-row" class="bg-bg-card border border-edge rounded-sm px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <a href={`/discussion/${t.id}`} class="text-ink-heading font-medium no-underline hover:text-accent">{t.title}</a>
                          <span class="text-xs text-ink-muted ml-2">
                            {(t.children || []).filter((r) => r.type === 'reply').length} replies
                          </span>
                        </div>
                        {canManage(t) && <ManageMenu item={t} onEdit={() => setEditing(t)} onDeleted={load} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

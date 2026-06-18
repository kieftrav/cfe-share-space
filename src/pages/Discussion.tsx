import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { user, canWrite } from '../store'

export function Discussion() {
  const [tree, setTree] = useState<Content[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [cat, setCat] = useState<number | null>(null)
  const [err, setErr] = useState('')

  async function load() {
    const { tree } = await api.get('/api/content/tree')
    setTree(tree)
  }
  useEffect(() => {
    load().catch(() => setTree([]))
  }, [])

  const categories = (tree || []).filter((n) => n.type === 'category')

  async function createThread() {
    setErr('')
    try {
      const parent = cat ?? categories[0]?.id
      if (!parent) return setErr('No category available — an admin must create one first.')
      await api.post('/api/content', { type: 'thread', parent_id: parent, title, body_markdown: body })
      setTitle(''); setBody(''); setShowForm(false)
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    }
  }

  return (
    <section data-testid="discussion">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold text-ink-heading">Discussion</h1>
        {canWrite() && (
          <button
            data-testid="new-thread-btn"
            class="px-4 py-2 rounded-md bg-accent text-bg font-medium"
            onClick={() => setShowForm((v) => !v)}
          >
            New thread
          </button>
        )}
      </div>

      {showForm && (
        <div data-testid="new-thread-form" class="bg-bg-card border border-edge rounded-xl p-5 mb-8">
          <select
            data-testid="thread-category"
            class="w-full mb-3 rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
            value={cat ?? categories[0]?.id ?? ''}
            onChange={(e) => setCat(Number((e.target as HTMLSelectElement).value))}
          >
            {categories.map((c) => (
              <option value={c.id}>{c.title}</option>
            ))}
          </select>
          <input
            data-testid="thread-title"
            class="w-full mb-3 rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
            placeholder="Thread title"
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          />
          <textarea
            data-testid="thread-body"
            class="w-full mb-3 rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink min-h-[120px]"
            placeholder="What's your question?"
            value={body}
            onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
          />
          {err && <p data-testid="thread-error" class="text-sm text-red-400 mb-2">{err}</p>}
          <button data-testid="thread-submit" class="px-4 py-2 rounded-md bg-accent text-bg font-medium" onClick={createThread}>
            Post thread
          </button>
        </div>
      )}

      {tree === null && <p class="text-ink-muted">Loading…</p>}
      {tree && categories.length === 0 && <p data-testid="discussion-empty" class="text-ink-muted">No categories yet.</p>}
      <div class="flex flex-col gap-8">
        {categories.map((c) => {
          const threads = (c.children || []).filter((t) => t.type === 'thread')
          threads.sort((a, b) => (b.last_activity_at || '').localeCompare(a.last_activity_at || ''))
          return (
            <div key={c.id} data-testid="category">
              <h2 class="text-xl font-bold text-ink-heading mb-1">{c.title}</h2>
              {c.body_markdown && <p class="text-ink-muted text-sm mb-3">{c.body_markdown}</p>}
              <ul class="flex flex-col gap-2 list-none m-0 p-0">
                {threads.length === 0 && <li class="text-ink-muted text-sm">No threads yet.</li>}
                {threads.map((t) => (
                  <li key={t.id} data-testid="thread-row" class="bg-bg-card border border-edge rounded-lg px-4 py-3">
                    <a href={`/discussion/${t.id}`} class="text-ink-heading font-medium no-underline hover:text-accent">
                      {t.title}
                    </a>
                    <span class="text-xs text-ink-muted ml-2">
                      {(t.children || []).filter((r) => r.type === 'reply').length} replies
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {!user.value && <p class="text-ink-muted text-sm mt-8">Sign in to start a thread or reply.</p>}
    </section>
  )
}

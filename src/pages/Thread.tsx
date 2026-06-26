import { useEffect, useState } from 'preact/hooks'
import { useLocation } from 'preact-iso'
import { api, type Content } from '../api'
import { Markdown } from '../components/Markdown'
import { CodeRef } from '../components/CodeRef'
import { ContentEditor } from '../components/ContentEditor'
import { ManageMenu } from '../components/ManageMenu'
import { canWrite, canManage } from '../store'

export function Thread({ id }: { id: string }) {
  const { route } = useLocation()
  const [item, setItem] = useState<Content | null>(null)
  const [replies, setReplies] = useState<Content[]>([])
  const [body, setBody] = useState('')
  const [path, setPath] = useState('')
  const [ghUrl, setGhUrl] = useState('')
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Content | null>(null) // the thread or a reply

  async function load() {
    const { item, children } = await api.get(`/api/content/${id}`)
    setItem(item)
    const r = (children as Content[]).filter((c) => c.type === 'reply')
    r.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    setReplies(r)
  }
  useEffect(() => {
    load().catch(() => setItem(null))
  }, [id])

  async function postReply() {
    setErr('')
    try {
      const metadata: any = {}
      if (ghUrl || path) metadata.code_ref = { github_url: ghUrl, repo_path: path }
      await api.post('/api/content', { type: 'reply', parent_id: Number(id), body_markdown: body, metadata })
      setBody(''); setPath(''); setGhUrl('')
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    }
  }

  if (!item) return <p class="text-ink-muted">Loading…</p>

  const editingThread = !!editing && editing.id === item.id

  return (
    <section data-testid="thread">
      <a href="/discussion" class="text-sm text-ink-muted no-underline">← Discussion</a>
      <div class="flex items-start justify-between gap-4 mt-2 mb-3">
        <h1 data-testid="thread-title-h" class="text-3xl font-bold text-ink-heading">{item.title}</h1>
        {canManage(item) && !editingThread && (
          <ManageMenu item={item} onEdit={() => setEditing(item)} onDeleted={() => route('/discussion')} />
        )}
      </div>

      {editingThread ? (
        // Focus mode: editing the thread shows only its editor.
        <ContentEditor initial={item} titleLabel="Thread title" onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />
      ) : (
        <>
          <div class="bg-bg-card border border-edge rounded-md p-6 mb-6">
            <Markdown source={item.body_markdown} />
            {item.metadata?.code_ref && <CodeRef data={item.metadata.code_ref} />}
          </div>

          <h2 class="text-lg font-bold text-ink-heading mb-3">{replies.length} replies</h2>
          <div class="flex flex-col gap-3 mb-8">
            {replies.map((r) => (
              <div key={r.id} data-testid="reply" class="bg-bg-card border border-edge rounded-md p-4">
                {editing && editing.id === r.id ? (
                  <ContentEditor initial={r} titleLabel="(reply)" onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />
                ) : (
                  <>
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1"><Markdown source={r.body_markdown} /></div>
                      {canManage(r) && <ManageMenu item={r} onEdit={() => setEditing(r)} onDeleted={load} />}
                    </div>
                    {r.metadata?.code_ref && <CodeRef data={r.metadata.code_ref} />}
                  </>
                )}
              </div>
            ))}
          </div>

          {canWrite() ? (
            <div data-testid="reply-form" class="bg-bg-card border border-edge rounded-md p-5">
              <h3 class="font-bold text-ink-heading mb-3">Add a reply</h3>
              <textarea
                data-testid="reply-body"
                class="w-full mb-3 rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink min-h-[100px]"
                placeholder="Your reply (markdown)"
                value={body}
                onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
              />
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input data-testid="reply-coderef-path" class="rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="Code ref repo path (optional, e.g. src/app.js)" value={path} onInput={(e) => setPath((e.target as HTMLInputElement).value)} />
                <input data-testid="reply-coderef-url" class="rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="GitHub URL (optional)" value={ghUrl} onInput={(e) => setGhUrl((e.target as HTMLInputElement).value)} />
              </div>
              {err && <p data-testid="reply-error" class="text-sm text-red-400 mb-2">{err}</p>}
              <button data-testid="reply-submit" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={postReply}>
                Post reply
              </button>
            </div>
          ) : (
            <p class="text-ink-muted text-sm">Sign in to reply.</p>
          )}
        </>
      )}
    </section>
  )
}

import { useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { Markdown } from './Markdown'
import { ManageMenu } from './ManageMenu'
import { canManage, isAdmin } from '../store'

const SHELL = 'grid grid-cols-1 md:grid-cols-2 gap-10 items-start bg-bg-card border border-edge rounded-md p-8'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export function CfeCard({
  cfe,
  editing,
  onEdit,
  onChanged,
  onSaved,
  onCancel,
}: {
  cfe?: Content
  editing?: boolean
  onEdit?: () => void
  onChanged?: () => void
  onSaved?: () => void
  onCancel?: () => void
}) {
  if (editing) return <CfeCardEdit cfe={cfe} onSaved={onSaved!} onCancel={onCancel!} />

  const c = cfe!
  const m = c.metadata || {}
  const manage = !!onChanged && canManage(c)
  const admin = isAdmin()

  async function toggleReview() {
    await api.put(`/api/content/${c.id}`, { metadata: { ...m, reviewed: !m.reviewed } })
    onChanged?.()
  }

  return (
    <article data-testid="cfe-card" class={`${SHELL} hover:border-accent/40 transition-colors`}>
      <div>
        {m.image ? (
          <img data-testid="cfe-image" src={m.image} alt={c.title} class="w-full rounded-sm border border-edge block" />
        ) : (
          <div class="w-full aspect-video rounded-sm border border-edge bg-bg flex items-center justify-center text-ink-muted text-sm">No image</div>
        )}
      </div>
      <div>
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <h3 class="text-2xl font-bold text-ink-heading">{c.title}</h3>
          {!m.reviewed && <span data-testid="cfe-inprogress-badge" class="text-xs px-2 py-0.5 rounded-sm border border-edge text-ink-muted">In progress</span>}
          {manage && (
            <span class="ml-auto">
              <ManageMenu
                item={c}
                onEdit={() => onEdit?.()}
                onDeleted={() => onChanged?.()}
                actions={admin ? [{ label: m.reviewed ? '✓ Reviewed (unset)' : 'Mark reviewed', testid: 'cfe-review', onClick: toggleReview }] : []}
              />
            </span>
          )}
        </div>
        {m.owner && <p class="text-xs text-ink-muted mb-3">by {m.owner}</p>}
        {m.tagline && <p class="text-accent font-medium mb-4">{m.tagline}</p>}
        {c.body_markdown && <div class="text-ink-muted mb-5"><Markdown source={c.body_markdown} /></div>}
        {Array.isArray(m.tags) && m.tags.length > 0 && (
          <div class="flex flex-wrap gap-2 mb-5">
            {m.tags.map((t: string) => <span class="text-xs px-2.5 py-1 rounded-sm bg-white/5 border border-edge text-ink-muted">{t}</span>)}
          </div>
        )}
        <div class="flex gap-3 flex-wrap">
          {m.github_url && <a data-testid="cfe-repo-link" href={m.github_url} target="_blank" rel="noopener" class="text-sm px-4 py-2 rounded-sm border border-edge text-ink hover:border-accent hover:text-accent no-underline">GitHub ↗</a>}
          {m.live_url && <a data-testid="cfe-live-link" href={m.live_url} target="_blank" rel="noopener" class="text-sm px-4 py-2 rounded-sm bg-accent text-bg font-medium no-underline">Live ↗</a>}
        </div>
      </div>
    </article>
  )
}

// The editable card: same shell + layout as the view, with inputs in place of text.
function CfeCardEdit({ cfe, onSaved, onCancel }: { cfe?: Content; onSaved: () => void; onCancel: () => void }) {
  const m = cfe?.metadata || {}
  const [title, setTitle] = useState(cfe?.title || '')
  const [github, setGithub] = useState(m.github_url || '')
  const [live, setLive] = useState(m.live_url || '')
  const [tagline, setTagline] = useState(m.tagline || '')
  const [owner, setOwner] = useState(m.owner || '')
  const [tags, setTags] = useState((m.tags || []).join(', '))
  const [bodyMd, setBodyMd] = useState(cfe?.body_markdown || '')
  const [image, setImage] = useState(m.image || '')
  const [err, setErr] = useState('')

  async function save() {
    setErr('')
    if (!title.trim()) return setErr('A name is required.')
    if (!github.trim()) return setErr('A GitHub repository link is required.')
    const metadata: any = {
      ...m,
      github_url: github,
      live_url: live || undefined,
      tagline,
      owner,
      tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
      reviewed: m.reviewed ?? false,
    }
    if (image) metadata.image = image
    const payload = { type: 'cfe', title, body_markdown: bodyMd, metadata }
    try {
      if (cfe?.id) await api.put(`/api/content/${cfe.id}`, payload)
      else await api.post('/api/content', payload)
      onSaved()
    } catch (e: any) {
      setErr(e?.message || 'Save failed')
    }
  }

  const inp = 'w-full rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink'
  return (
    <article data-testid="cfe-card-edit" class={SHELL}>
      <div class="flex flex-col gap-2">
        {image ? (
          <img data-testid="cfe-image-preview" src={image} class="w-full rounded-sm border border-edge block" />
        ) : (
          <div class="w-full aspect-video rounded-sm border border-edge bg-bg flex items-center justify-center text-ink-muted text-sm">No image</div>
        )}
        <input data-testid="cfe-image-input" type="file" accept="image/*" class="text-xs text-ink-muted" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setImage(await fileToDataUrl(f)) }} />
      </div>
      <div class="flex flex-col gap-3">
        <input data-testid="editor-title" class={`${inp} text-lg font-bold`} placeholder="Name" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        <input data-testid="cfe-tagline" class={inp} placeholder="Tagline" value={tagline} onInput={(e) => setTagline((e.target as HTMLInputElement).value)} />
        <input data-testid="cfe-owner" class={inp} placeholder="Owner" value={owner} onInput={(e) => setOwner((e.target as HTMLInputElement).value)} />
        <textarea data-testid="cfe-body" class={`${inp} min-h-[90px]`} placeholder="Description (markdown)" value={bodyMd} onInput={(e) => setBodyMd((e.target as HTMLTextAreaElement).value)} />
        <input data-testid="cfe-tags" class={inp} placeholder="Tags (comma separated)" value={tags} onInput={(e) => setTags((e.target as HTMLInputElement).value)} />
        <input data-testid="cfe-github" class={inp} placeholder="GitHub URL (required)" value={github} onInput={(e) => setGithub((e.target as HTMLInputElement).value)} />
        <input data-testid="cfe-live" class={inp} placeholder="Live URL (optional)" value={live} onInput={(e) => setLive((e.target as HTMLInputElement).value)} />
        {err && <p data-testid="editor-error" class="text-sm text-red-400">{err}</p>}
        <div class="flex gap-2">
          <button data-testid="editor-save" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={save}>Save</button>
          <button data-testid="editor-cancel" class="px-4 py-2 rounded-sm border border-edge text-ink" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </article>
  )
}

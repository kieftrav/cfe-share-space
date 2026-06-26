import { useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { MarkdownEditor } from './MarkdownEditor'

export type Draft = {
  id?: number
  type: string
  title: string
  slug: string
  body_markdown: string
  parent_id: number | null
  status: string
  metadata: Record<string, any>
}

export function draftFrom(c: Partial<Content> & { type: string }): Draft {
  return {
    id: c.id,
    type: c.type,
    title: c.title || '',
    slug: c.slug || '',
    body_markdown: c.body_markdown || '',
    parent_id: c.parent_id ?? null,
    status: c.status || 'published',
    metadata: { ...(c.metadata || {}) },
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// One editor for every content type; type-specific fields render off `draft.type`.
export function ContentEditor({
  initial,
  onSaved,
  onCancel,
  parentOptions,
  linkOptions,
  allowStatus = false,
  titleLabel = 'Title',
}: {
  initial: Partial<Content> & { type: string }
  onSaved: (item: Content) => void
  onCancel: () => void
  parentOptions?: { id: number; label: string }[]
  linkOptions?: { id: number; label: string }[]
  allowStatus?: boolean
  titleLabel?: string
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(initial))
  const [err, setErr] = useState('')
  const set = (k: keyof Draft, v: any) => setD((p) => ({ ...p, [k]: v }))
  const setMeta = (k: string, v: any) => setD((p) => ({ ...p, metadata: { ...p.metadata, [k]: v } }))

  const needsTitle = d.type !== 'reply'

  async function save() {
    setErr('')
    if (needsTitle && !d.title.trim()) return setErr('A title is required.')
    if (d.type === 'cfe' && !(d.metadata.github_url || '').trim()) return setErr('A GitHub URL is required.')
    if (d.type === 'external_link' && !(d.metadata.href || '').trim()) return setErr('A URL is required.')
    const payload = {
      type: d.type,
      title: d.title,
      slug: d.slug || null,
      body_markdown: d.body_markdown,
      parent_id: d.parent_id,
      status: allowStatus ? d.status : 'published',
      metadata: d.metadata,
    }
    try {
      const { item } = d.id
        ? await api.put(`/api/content/${d.id}`, payload)
        : await api.post('/api/content', payload)
      onSaved(item)
    } catch (e: any) {
      setErr(e?.message || 'Save failed')
    }
  }

  const field = 'w-full rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink'
  return (
    <div data-testid="content-editor" class="bg-bg-card border border-edge rounded-md p-5 mb-8 flex flex-col gap-3">
      {needsTitle && (
        <input
          data-testid="editor-title"
          class={field}
          placeholder={titleLabel}
          value={d.title}
          onInput={(e) => set('title', (e.target as HTMLInputElement).value)}
        />
      )}

      {(parentOptions || allowStatus) && (
        <div class="grid grid-cols-2 gap-3">
          {parentOptions && (
            <label class="text-xs text-ink-muted flex flex-col gap-1">
              Parent
              <select
                data-testid="editor-parent"
                class={field}
                value={d.parent_id ?? ''}
                onChange={(e) => { const v = (e.target as HTMLSelectElement).value; set('parent_id', v ? Number(v) : null) }}
              >
                <option value="">(none)</option>
                {parentOptions.map((p) => <option value={p.id}>{p.label}</option>)}
              </select>
            </label>
          )}
          {allowStatus && (
            <label class="text-xs text-ink-muted flex flex-col gap-1">
              Status
              <select data-testid="editor-status" class={field} value={d.status} onChange={(e) => set('status', (e.target as HTMLSelectElement).value)}>
                <option value="published">published</option>
                <option value="draft">draft</option>
              </select>
            </label>
          )}
        </div>
      )}

      {d.type === 'cfe' && (
        <div class="flex flex-col gap-2 border border-edge rounded-sm p-3">
          <span class="text-xs text-ink-muted">CFE details</span>
          <input data-testid="cfe-github" class={field} placeholder="GitHub URL (required)" value={d.metadata.github_url || ''} onInput={(e) => setMeta('github_url', (e.target as HTMLInputElement).value)} />
          <input data-testid="cfe-live" class={field} placeholder="Live URL (optional)" value={d.metadata.live_url || ''} onInput={(e) => setMeta('live_url', (e.target as HTMLInputElement).value)} />
          <input data-testid="cfe-tagline" class={field} placeholder="Tagline" value={d.metadata.tagline || ''} onInput={(e) => setMeta('tagline', (e.target as HTMLInputElement).value)} />
          <input data-testid="cfe-owner" class={field} placeholder="Owner" value={d.metadata.owner || ''} onInput={(e) => setMeta('owner', (e.target as HTMLInputElement).value)} />
          <input data-testid="cfe-tags" class={field} placeholder="Tags (comma separated)" value={(d.metadata.tags || []).join(', ')} onInput={(e) => setMeta('tags', (e.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean))} />
          <input data-testid="cfe-image-input" type="file" accept="image/*" class="text-sm text-ink-muted" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setMeta('image', await fileToDataUrl(f)) }} />
          {d.metadata.image && <img data-testid="cfe-image-preview" src={d.metadata.image} class="w-40 rounded-sm border border-edge" />}
        </div>
      )}

      {d.type === 'external_link' && (
        <input data-testid="ext-href" class={field} placeholder="External URL (https://…)" value={d.metadata.href || ''} onInput={(e) => setMeta('href', (e.target as HTMLInputElement).value)} />
      )}

      {d.type === 'featured' && linkOptions && (
        <label class="text-xs text-ink-muted flex flex-col gap-1">
          Linked discussion/thread
          <select data-testid="featured-link" class={field} value={d.metadata.links_content_id ?? ''} onChange={(e) => setMeta('links_content_id', Number((e.target as HTMLSelectElement).value) || undefined)}>
            <option value="">(none)</option>
            {linkOptions.map((o) => <option value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}

      {d.type !== 'external_link' && (
        <>
          <span class="text-xs text-ink-muted">Body (markdown)</span>
          <MarkdownEditor value={d.body_markdown} onInput={(v) => set('body_markdown', v)} />
        </>
      )}

      {err && <p data-testid="editor-error" class="text-sm text-red-400">{err}</p>}
      <div class="flex gap-2">
        <button data-testid="editor-save" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={save}>Save</button>
        <button data-testid="editor-cancel" class="px-4 py-2 rounded-sm border border-edge text-ink" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

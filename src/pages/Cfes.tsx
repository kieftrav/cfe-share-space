import { useEffect, useMemo, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { CfeCard } from '../components/CfeCard'
import { user, canWrite } from '../store'
import { ZOONIVERSE_CFE_URL } from '../config'

type View = 'reviewed' | 'all'

export function Cfes({ initialView = 'reviewed' }: { initialView?: View }) {
  const [cfes, setCfes] = useState<Content[] | null>(null)
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const { items } = await api.get('/api/content?type=cfe')
    setCfes(items)
  }
  useEffect(() => {
    load().catch(() => setCfes([]))
  }, [])

  const list = useMemo(() => {
    if (!cfes) return null
    let xs = view === 'reviewed' ? cfes.filter((c) => c.metadata?.reviewed) : cfes
    const needle = q.trim().toLowerCase()
    if (needle) {
      xs = xs.filter((c) => {
        const m = c.metadata || {}
        return [c.title, c.body_markdown, m.tagline, m.owner, ...(m.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
    }
    return xs
  }, [cfes, view, q])

  const tab = (v: View, label: string) => (
    <button
      data-testid={`cfe-view-${v}`}
      aria-selected={view === v}
      class={`px-3 py-1.5 text-sm border ${view === v ? 'border-accent text-accent' : 'border-edge text-ink-muted hover:text-ink'} -ml-px first:ml-0`}
      onClick={() => setView(v)}
    >
      {label}
    </button>
  )

  return (
    <section data-testid="catalog">
      <div data-testid="volunteer-callout" class="bg-bg-card border border-edge rounded-md px-5 py-4 mb-10 flex items-center gap-4 flex-wrap">
        <p class="text-ink-muted text-sm m-0 flex-1 min-w-[260px]">
          Are you a Zooniverse volunteer looking for where to access these projects?
        </p>
        <a
          data-testid="volunteer-callout-link"
          href={ZOONIVERSE_CFE_URL}
          target="_blank"
          rel="noopener"
          class="text-sm font-medium px-4 py-2 rounded-sm border border-edge text-ink hover:border-accent hover:text-accent no-underline whitespace-nowrap"
        >
          Visit the Zooniverse CFE page ↗
        </a>
      </div>

      <p class="text-xs uppercase tracking-wider text-ink-muted mb-3 mt-2">Custom Front Ends</p>
      <h1 class="text-4xl font-bold text-ink-heading tracking-tight mb-3">Custom Front Ends</h1>
      <p class="text-ink-muted text-lg max-w-[660px] mb-8">
        Custom front ends built by the community for the Zooniverse platform. Each links to its
        GitHub repository.
      </p>

      <div class="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div class="flex" role="tablist" data-testid="cfe-view-toggle">
          {tab('reviewed', 'Reviewed')}
          {tab('all', 'All')}
        </div>
        {canWrite() && (
          <button
            data-testid="submit-cfe-btn"
            class="px-4 py-2 rounded-sm bg-accent text-bg font-medium"
            onClick={() => setShowForm((v) => !v)}
          >
            Submit a CFE
          </button>
        )}
      </div>

      {showForm && (
        <CfeForm
          onCreated={() => {
            setShowForm(false)
            setView('all')
            load()
          }}
        />
      )}

      {view === 'all' && (
        <input
          data-testid="browse-search"
          class="w-full mb-8 rounded-sm border border-edge bg-bg px-4 py-2 text-ink"
          placeholder="Search all CFEs by name, tag, owner…"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        />
      )}

      <div data-testid="cfe-grid" class="flex flex-col gap-12">
        {list === null && <p class="text-ink-muted">Loading…</p>}
        {list && list.length === 0 && (
          <p data-testid="cfe-empty" class="text-ink-muted">
            {view === 'reviewed' ? 'No reviewed CFEs yet — switch to All to see in-progress ones.' : 'No CFEs match.'}
          </p>
        )}
        {list && list.map((c) => <CfeCard key={c.id} cfe={c} />)}
      </div>
    </section>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function CfeForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [github, setGithub] = useState('')
  const [tagline, setTagline] = useState('')
  const [desc, setDesc] = useState('')
  const [owner, setOwner] = useState(user.value?.display_name || user.value?.login || '')
  const [tags, setTags] = useState('')
  const [image, setImage] = useState('')
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (!title.trim()) return setErr('A name is required.')
    if (!github.trim()) return setErr('A GitHub repository link is required.')
    try {
      await api.post('/api/content', {
        type: 'cfe',
        title,
        body_markdown: desc,
        metadata: {
          github_url: github,
          tagline,
          owner,
          tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
          ...(image ? { image } : {}),
          reviewed: false,
        },
      })
      onCreated()
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit')
    }
  }

  const field = 'w-full mb-3 rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink'
  return (
    <div data-testid="cfe-form" class="bg-bg-card border border-edge rounded-md p-5 mb-8">
      <h2 class="font-bold text-ink-heading mb-3">Submit a CFE</h2>
      <input data-testid="cfe-form-title" class={field} placeholder="Name" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
      <input data-testid="cfe-form-github" class={field} placeholder="GitHub repository URL (required)" value={github} onInput={(e) => setGithub((e.target as HTMLInputElement).value)} />
      <input data-testid="cfe-form-owner" class={field} placeholder="Owner" value={owner} onInput={(e) => setOwner((e.target as HTMLInputElement).value)} />
      <input data-testid="cfe-form-tagline" class={field} placeholder="Tagline (optional)" value={tagline} onInput={(e) => setTagline((e.target as HTMLInputElement).value)} />
      <input data-testid="cfe-form-tags" class={field} placeholder="Tags, comma separated (optional)" value={tags} onInput={(e) => setTags((e.target as HTMLInputElement).value)} />
      <textarea data-testid="cfe-form-desc" class={`${field} min-h-[100px]`} placeholder="Description" value={desc} onInput={(e) => setDesc((e.target as HTMLTextAreaElement).value)} />
      <input data-testid="cfe-form-image" type="file" accept="image/*" class="text-sm text-ink-muted mb-3 block" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setImage(await fileToDataUrl(f)) }} />
      {err && <p data-testid="cfe-form-error" class="text-sm text-red-400 mb-2">{err}</p>}
      <button data-testid="cfe-form-submit" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={submit}>
        Submit
      </button>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { CfeCard } from '../components/CfeCard'
import { canWrite } from '../store'
import { ZOONIVERSE_CFE_URL } from '../config'

type View = 'reviewed' | 'all'

export function Cfes({ initialView = 'reviewed' }: { initialView?: View }) {
  const [cfes, setCfes] = useState<Content[] | null>(null)
  const [view, setView] = useState<View>(initialView)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)

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

      <h1 class="text-4xl font-bold text-ink-heading tracking-tight mb-3 mt-2">Custom Front Ends</h1>
      <p class="text-ink-muted text-lg max-w-[660px] mb-8">
        Custom front ends built by the community for the Zooniverse platform. Each links to its
        GitHub repository.
      </p>

      {/* Focus mode: while creating/editing, show only the editable card. */}
      {creating ? (
        <CfeCard editing onSaved={() => { setCreating(false); setView('all'); load() }} onCancel={() => setCreating(false)} />
      ) : editing ? (
        <CfeCard editing cfe={editing} onSaved={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />
      ) : (
        <>
          <div class="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div class="flex" role="tablist" data-testid="cfe-view-toggle">
              {tab('reviewed', 'Reviewed')}
              {tab('all', 'All')}
            </div>
            {canWrite() && (
              <button data-testid="submit-cfe-btn" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={() => setCreating(true)}>
                Submit a CFE
              </button>
            )}
          </div>

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
                {view === 'reviewed' ? 'No reviewed CFEs yet. Switch to All to see in-progress ones.' : 'No CFEs match.'}
              </p>
            )}
            {list && list.map((c) => <CfeCard key={c.id} cfe={c} onEdit={() => setEditing(c)} onChanged={load} />)}
          </div>
        </>
      )}
    </section>
  )
}

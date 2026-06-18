import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { CfeCard } from '../components/CfeCard'

export function Home() {
  const [cfes, setCfes] = useState<Content[] | null>(null)
  useEffect(() => {
    api.get('/api/content?type=cfe').then(({ items }) => setCfes(items)).catch(() => setCfes([]))
  }, [])

  return (
    <section data-testid="catalog">
      <span class="inline-block text-xs font-semibold tracking-widest uppercase text-accent bg-accent/15 px-4 py-1.5 rounded-full mb-4">
        Custom Front Ends
      </span>
      <h1 class="text-4xl font-bold text-ink-heading tracking-tight mb-3">CFE Catalog</h1>
      <p class="text-ink-muted text-lg max-w-[660px] mb-10">
        Custom front ends built by the community for the Zooniverse platform. Each links to its GitHub repository.
      </p>
      <div data-testid="cfe-grid" class="flex flex-col gap-12">
        {cfes === null && <p class="text-ink-muted">Loading…</p>}
        {cfes && cfes.length === 0 && <p data-testid="cfe-empty" class="text-ink-muted">No CFEs yet.</p>}
        {cfes && cfes.map((c) => <CfeCard key={c.id} cfe={c} />)}
      </div>
    </section>
  )
}

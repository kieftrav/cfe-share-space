import { useState } from 'preact/hooks'
import { api } from '../api'

type Result = { content_id: number; type: string; title: string; snippet: string }

const ROUTE: Record<string, (id: number) => string> = {
  cfe: () => '/',
  thread: (id) => `/discussion/${id}`,
  reply: (id) => `/discussion/${id}`,
  announcement: () => '/news',
  featured: () => '/featured',
  page: (id) => `/resources/${id}`,
  section: (id) => `/resources/${id}`,
}

export function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [searched, setSearched] = useState(false)

  async function run() {
    setSearched(true)
    const { results } = await api.get(`/api/content/search?q=${encodeURIComponent(q)}`)
    setResults(results)
  }

  return (
    <section data-testid="search">
      <h1 class="text-3xl font-bold text-ink-heading mb-6">Search</h1>
      <div class="flex gap-3 mb-8">
        <input
          data-testid="search-input"
          class="flex-1 rounded-md border border-edge bg-bg px-4 py-2 text-ink"
          placeholder="Search CFEs, discussions, announcements…"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button data-testid="search-submit" class="px-5 py-2 rounded-md bg-accent text-bg font-medium" onClick={run}>
          Search
        </button>
      </div>
      {searched && results && results.length === 0 && (
        <p data-testid="search-empty" class="text-ink-muted">No matches.</p>
      )}
      <ul data-testid="search-results" class="flex flex-col gap-3 list-none m-0 p-0">
        {results?.map((r) => {
          const href = (ROUTE[r.type] || ((id: number) => `/resources/${id}`))(r.content_id)
          return (
            <li key={r.content_id} data-testid="search-result" class="bg-bg-card border border-edge rounded-lg px-4 py-3">
              <a href={href} class="text-ink-heading no-underline hover:text-accent" data-result-type={r.type}>
                <span class="text-xs uppercase tracking-wide text-accent mr-2">{r.type}</span>
                {r.title}
              </a>
              {r.snippet && <p class="text-sm text-ink-muted mt-1" dangerouslySetInnerHTML={{ __html: r.snippet }} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import type { Content } from '../api'
import { Markdown } from './Markdown'

export function CfeCard({ cfe }: { cfe: Content }) {
  const m = cfe.metadata || {}
  return (
    <article
      data-testid="cfe-card"
      class="grid grid-cols-1 md:grid-cols-2 gap-10 items-start bg-bg-card border border-edge rounded-xl p-8 hover:border-accent/40 transition-colors"
    >
      <div>
        {m.image ? (
          <img data-testid="cfe-image" src={m.image} alt={cfe.title} class="w-full rounded-lg border border-edge block" />
        ) : (
          <div class="w-full aspect-video rounded-lg border border-edge bg-bg flex items-center justify-center text-ink-muted text-sm">
            No image
          </div>
        )}
      </div>
      <div>
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <h3 class="text-2xl font-bold text-ink-heading">{cfe.title}</h3>
          {!m.reviewed && (
            <span data-testid="cfe-inprogress-badge" class="text-xs px-2 py-0.5 rounded-sm border border-edge text-ink-muted">
              In progress
            </span>
          )}
        </div>
        {m.owner && <p class="text-xs text-ink-muted mb-3">by {m.owner}</p>}
        {m.tagline && <p class="text-accent font-medium mb-4">{m.tagline}</p>}
        {cfe.body_markdown && <div class="text-ink-muted mb-5"><Markdown source={cfe.body_markdown} /></div>}
        {Array.isArray(m.tags) && m.tags.length > 0 && (
          <div class="flex flex-wrap gap-2 mb-5">
            {m.tags.map((t: string) => (
              <span class="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-edge text-ink-muted">{t}</span>
            ))}
          </div>
        )}
        <div class="flex gap-3 flex-wrap">
          {m.github_url && (
            <a
              data-testid="cfe-repo-link"
              href={m.github_url}
              target="_blank"
              rel="noopener"
              class="text-sm px-4 py-2 rounded-md border border-edge text-ink hover:border-accent hover:text-accent no-underline"
            >
              GitHub ↗
            </a>
          )}
          {m.live_url && (
            <a
              data-testid="cfe-live-link"
              href={m.live_url}
              target="_blank"
              rel="noopener"
              class="text-sm px-4 py-2 rounded-md bg-accent text-bg font-medium no-underline"
            >
              Live ↗
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

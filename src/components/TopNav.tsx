import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { user } from '../store'
import { AuthButton } from './AuthButton'

const PRIMARY = [
  { href: '/', label: 'CFEs', key: 'cfes' },
  { href: '/news', label: 'News', key: 'news' },
  { href: '/featured', label: 'Featured Topics', key: 'featured' },
  { href: '/discussion', label: 'Discussion', key: 'discussion' },
]

export function TopNav() {
  const [resources, setResources] = useState<Content[]>([])
  const [openRes, setOpenRes] = useState(false)

  useEffect(() => {
    api
      .get('/api/content/tree')
      .then(({ tree }: { tree: Content[] }) => {
        const root = tree.find((n) => n.type === 'section' && (n.slug === 'resources' || n.title.toLowerCase() === 'resources'))
        setResources(root?.children || [])
      })
      .catch(() => {})
  }, [])

  return (
    <header data-testid="top-nav" class="border-b border-edge bg-bg-card/70 backdrop-blur sticky top-0 z-20">
      <nav class="mx-auto w-full max-w-[1100px] px-6 h-14 flex items-center gap-5">
        <a href="/" class="font-bold text-ink-heading no-underline whitespace-nowrap">CFE Share Space</a>
        <ul class="flex items-center gap-4 text-sm flex-1 list-none m-0 p-0">
          {PRIMARY.map((item) => (
            <li key={item.key}>
              <a href={item.href} data-testid={`nav-${item.key}`} class="text-ink-muted hover:text-ink no-underline">
                {item.label}
              </a>
            </li>
          ))}
          <li class="relative" onMouseLeave={() => setOpenRes(false)}>
            <button
              data-testid="nav-resources"
              class="text-ink-muted hover:text-ink bg-transparent border-0 cursor-pointer text-sm"
              onClick={() => setOpenRes(true)}
              onMouseEnter={() => setOpenRes(true)}
            >
              Resources ▾
            </button>
            {openRes && resources.length > 0 && (
              <div data-testid="resources-menu" class="absolute left-0 top-full mt-1 min-w-[200px] rounded-md border border-edge bg-bg-card py-1 shadow-lg">
                {resources.map((c) =>
                  c.type === 'external_link' ? (
                    <a
                      key={c.id}
                      data-testid={`res-link-${c.id}`}
                      href={c.metadata?.href || '#'}
                      target="_blank"
                      rel="noopener"
                      class="block px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-card-hover no-underline"
                    >
                      {c.title} ↗
                    </a>
                  ) : (
                    <a
                      key={c.id}
                      data-testid={`res-link-${c.id}`}
                      href={`/resources/${c.id}`}
                      class="block px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-card-hover no-underline"
                    >
                      {c.title}
                    </a>
                  ),
                )}
              </div>
            )}
          </li>
          <li>
            <a href="/search" data-testid="nav-search" class="text-ink-muted hover:text-ink no-underline">Search</a>
          </li>
          {user.value?.role === 'admin' && (
            <li>
              <a href="/admin" data-testid="nav-admin" class="text-accent hover:text-ink no-underline">Admin</a>
            </li>
          )}
        </ul>
        <AuthButton />
      </nav>
    </header>
  )
}

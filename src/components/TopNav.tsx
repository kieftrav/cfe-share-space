import { useEffect, useRef, useState } from 'preact/hooks'
import { useLocation } from 'preact-iso'
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
  const { path } = useLocation()
  const [resources, setResources] = useState<Content[]>([])
  const [openRes, setOpenRes] = useState(false)
  const resRef = useRef<HTMLLIElement>(null)

  // The active top-level page stays white (the rest are muted); hovering only shows a pointer.
  const isActive = (href: string) =>
    href === '/' ? path === '/' || path.startsWith('/cfes') : path.startsWith(href)
  const linkCls = (active: boolean) =>
    `${active ? 'text-ink' : 'text-ink-muted'} cursor-pointer no-underline`

  useEffect(() => {
    api
      .get('/api/content/tree')
      .then(({ tree }: { tree: Content[] }) => {
        const root = tree.find((n) => n.type === 'section' && (n.slug === 'resources' || n.title.toLowerCase() === 'resources'))
        setResources(root?.children || [])
      })
      .catch(() => {})
  }, [])

  // Close the dropdown on any click outside it (no hover races).
  useEffect(() => {
    if (!openRes) return
    const onDoc = (e: MouseEvent) => {
      if (resRef.current && !resRef.current.contains(e.target as Node)) setOpenRes(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [openRes])

  return (
    <header data-testid="top-nav" class="border-b border-edge bg-bg-card/70 backdrop-blur sticky top-0 z-20">
      <nav class="mx-auto w-full max-w-[1100px] px-6 h-14 flex items-center gap-5">
        <a href="/" class="font-bold text-ink-heading no-underline whitespace-nowrap">CFE Share Space</a>
        <ul class="flex items-center gap-4 text-sm flex-1 list-none m-0 p-0">
          {PRIMARY.map((item) => (
            <li key={item.key}>
              <a href={item.href} data-testid={`nav-${item.key}`} aria-current={isActive(item.href) ? 'page' : undefined} class={linkCls(isActive(item.href))}>
                {item.label}
              </a>
            </li>
          ))}
          <li class="relative" ref={resRef}>
            <button
              data-testid="nav-resources"
              aria-haspopup="true"
              aria-expanded={openRes}
              aria-current={isActive('/resources') ? 'page' : undefined}
              class={`bg-transparent border-0 text-sm ${linkCls(isActive('/resources'))}`}
              onClick={() => setOpenRes((v) => !v)}
            >
              Resources ▾
            </button>
            {openRes && (
              <div data-testid="resources-menu" class="absolute left-0 top-full mt-1 min-w-[220px] rounded-md border border-edge bg-bg-card py-1 shadow-lg">
                <a
                  data-testid="res-link-all"
                  href="/resources"
                  class="block px-4 py-2 text-sm text-ink hover:text-accent hover:bg-bg-card-hover no-underline border-b border-edge"
                  onClick={() => setOpenRes(false)}
                >
                  All resources →
                </a>
                {resources.map((c) =>
                  c.type === 'external_link' ? (
                    <a
                      key={c.id}
                      data-testid={`res-link-${c.id}`}
                      href={c.metadata?.href || '#'}
                      target="_blank"
                      rel="noopener"
                      class="block px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-card-hover no-underline"
                      onClick={() => setOpenRes(false)}
                    >
                      {c.title} ↗
                    </a>
                  ) : (
                    <a
                      key={c.id}
                      data-testid={`res-link-${c.id}`}
                      href={`/resources/${c.id}`}
                      class="block px-4 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-card-hover no-underline"
                      onClick={() => setOpenRes(false)}
                    >
                      {c.title}
                    </a>
                  ),
                )}
              </div>
            )}
          </li>
          <li>
            <a href="/search" data-testid="nav-search" aria-current={isActive('/search') ? 'page' : undefined} class={linkCls(isActive('/search'))}>Search</a>
          </li>
          {user.value?.role === 'admin' && (
            <li>
              <a href="/admin" data-testid="nav-admin" aria-current={isActive('/admin') ? 'page' : undefined} class={`no-underline cursor-pointer ${isActive('/admin') ? 'text-ink' : 'text-accent'}`}>Admin</a>
            </li>
          )}
        </ul>
        <AuthButton />
      </nav>
    </header>
  )
}

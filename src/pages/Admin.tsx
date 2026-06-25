import { useEffect, useState } from 'preact/hooks'
import { api, type Content } from '../api'
import { user } from '../store'
import { MarkdownEditor } from '../components/MarkdownEditor'

const TYPES = ['section', 'page', 'cfe', 'category', 'thread', 'reply', 'announcement', 'featured', 'external_link']

type Draft = {
  id?: number
  type: string
  title: string
  slug: string
  body_markdown: string
  parent_id: number | null
  status: string
  metadata: Record<string, any>
}

function emptyDraft(parent_id: number | null = null): Draft {
  return { type: 'page', title: '', slug: '', body_markdown: '', parent_id, status: 'published', metadata: {} }
}

function flatten(tree: Content[], depth = 0, out: (Content & { depth: number })[] = []) {
  for (const n of tree) {
    out.push({ ...n, depth })
    if (n.children) flatten(n.children, depth + 1, out)
  }
  return out
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export function Admin() {
  const [tab, setTab] = useState<'content' | 'users'>('content')
  const [tree, setTree] = useState<Content[]>([])
  const [flat, setFlat] = useState<(Content & { depth: number })[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [newLogin, setNewLogin] = useState('')
  const [newRole, setNewRole] = useState('contributor')
  const [menuId, setMenuId] = useState<number | null>(null)

  async function loadTree() {
    const { tree } = await api.get('/api/content/tree')
    setTree(tree)
    setFlat(flatten(tree))
  }
  async function loadUsers() {
    try {
      const { users } = await api.get('/api/users')
      setUsers(users)
    } catch {
      setUsers([])
    }
  }
  useEffect(() => {
    loadTree().catch(() => {})
    loadUsers()
  }, [])

  // Close any open row action-menu when clicking elsewhere.
  useEffect(() => {
    if (menuId === null) return
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-testid="node-actions"]')) setMenuId(null)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [menuId])

  if (user.value === undefined) return <p class="text-ink-muted">Loading…</p>
  if (user.value?.role !== 'admin') {
    return <p data-testid="admin-guard" class="text-ink-muted">Admins only. Sign in with an admin account.</p>
  }

  function setMeta(k: string, v: any) {
    setDraft((d) => (d ? { ...d, metadata: { ...d.metadata, [k]: v } } : d))
  }

  async function save() {
    if (!draft) return
    setMsg('')
    try {
      const payload = {
        type: draft.type,
        title: draft.title,
        slug: draft.slug || null,
        body_markdown: draft.body_markdown,
        parent_id: draft.parent_id,
        status: draft.status,
        metadata: draft.metadata,
      }
      if (draft.id) await api.put(`/api/content/${draft.id}`, payload)
      else await api.post('/api/content', payload)
      setDraft(null)
      await loadTree()
      setMsg('Saved.')
    } catch (e: any) {
      setMsg(e?.message || 'Save failed')
    }
  }

  function editNode(n: Content) {
    setDraft({
      id: n.id,
      type: n.type,
      title: n.title,
      slug: n.slug || '',
      body_markdown: n.body_markdown,
      parent_id: n.parent_id,
      status: n.status,
      metadata: { ...(n.metadata || {}) },
    })
  }

  async function del(n: Content) {
    if (!confirm(`Delete "${n.title}" and its children?`)) return
    await api.del(`/api/content/${n.id}`)
    if (draft?.id === n.id) setDraft(null)
    await loadTree()
  }

  async function move(n: Content & { depth: number }, dir: number) {
    const siblings = flat.filter((s) => s.parent_id === n.parent_id).sort((a, b) => a.position - b.position)
    const idx = siblings.findIndex((s) => s.id === n.id)
    const swap = siblings[idx + dir]
    if (!swap) return
    await api.put(`/api/content/${n.id}`, { position: swap.position })
    await api.put(`/api/content/${swap.id}`, { position: n.position })
    await loadTree()
  }

  async function setRole(id: string, role: string) {
    await api.put(`/api/users/${encodeURIComponent(id)}/role`, { role: role || null })
    await loadUsers()
  }

  // One-click review toggle: flip metadata.reviewed so a CFE moves on/off the landing page.
  async function toggleReviewed(n: Content) {
    const meta = { ...(n.metadata || {}), reviewed: !n.metadata?.reviewed }
    await api.put(`/api/content/${n.id}`, { metadata: meta })
    await loadTree()
  }

  async function addUser() {
    const login = newLogin.trim()
    if (!login) return setMsg('Enter a Zooniverse login.')
    try {
      await api.post('/api/users', { login, role: newRole })
      setNewLogin('')
      setMsg('User added.')
      await loadUsers()
    } catch (e: any) {
      setMsg(e?.message || 'Could not add user')
    }
  }

  return (
    <section data-testid="admin">
      <div class="flex items-center gap-4 mb-6">
        <h1 class="text-3xl font-bold text-ink-heading">Admin</h1>
        <div class="flex gap-2 ml-auto">
          <button
            data-testid="tab-content"
            class={`px-3 py-1.5 rounded-md border ${tab === 'content' ? 'border-accent text-accent' : 'border-edge text-ink-muted'}`}
            onClick={() => setTab('content')}
          >
            Content
          </button>
          <button
            data-testid="tab-users"
            class={`px-3 py-1.5 rounded-md border ${tab === 'users' ? 'border-accent text-accent' : 'border-edge text-ink-muted'}`}
            onClick={() => setTab('users')}
          >
            Users
          </button>
        </div>
      </div>

      {msg && <p data-testid="admin-msg" class="text-sm text-accent mb-4">{msg}</p>}

      {tab === 'content' && (
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="font-bold text-ink-heading">Content tree</h2>
              <button data-testid="new-root-btn" class="text-sm px-3 py-1.5 rounded-md bg-accent text-bg font-medium" onClick={() => setDraft(emptyDraft(null))}>
                + New
              </button>
            </div>
            <div data-testid="content-tree" class="flex flex-col gap-1">
              {flat.length === 0 && <p class="text-ink-muted text-sm">No content yet — create something.</p>}
              {flat.map((n) => (
                <div
                  key={n.id}
                  data-testid="tree-node"
                  data-id={n.id}
                  data-type={n.type}
                  class="flex items-center gap-2 bg-bg-card border border-edge rounded-md px-3 py-2 text-sm"
                  style={{ marginLeft: `${n.depth * 18}px` }}
                >
                  <span class="text-ink-heading">{n.title || '(untitled)'}</span>
                  <span class="text-xs text-ink-muted">{n.type}</span>
                  {n.status === 'draft' && <span class="text-xs text-orange-400">draft</span>}
                  {n.type === 'cfe' && n.metadata?.reviewed && <span class="text-xs text-accent">reviewed</span>}
                  <span data-testid="node-actions" class="ml-auto relative">
                    <button
                      data-testid="node-menu"
                      aria-haspopup="true"
                      aria-expanded={menuId === n.id}
                      title="Actions"
                      class="px-2 text-ink-muted hover:text-ink leading-none text-lg"
                      onClick={() => setMenuId((id) => (id === n.id ? null : n.id))}
                    >
                      ⋮
                    </button>
                    {menuId === n.id && (
                      <div data-testid="node-menu-panel" class="absolute right-0 top-full mt-1 z-10 min-w-[150px] rounded-sm border border-edge bg-bg-card py-1 shadow-lg flex flex-col text-left">
                        {n.type === 'cfe' && (
                          <button data-testid="node-review" class={`px-3 py-1.5 text-left hover:bg-bg-card-hover ${n.metadata?.reviewed ? 'text-accent' : 'text-ink hover:text-accent'}`} onClick={() => { setMenuId(null); toggleReviewed(n) }}>
                            {n.metadata?.reviewed ? '✓ reviewed (unset)' : 'Mark reviewed'}
                          </button>
                        )}
                        <button data-testid="node-up" class="px-3 py-1.5 text-left text-ink hover:bg-bg-card-hover" onClick={() => { setMenuId(null); move(n, -1) }}>↑ Move up</button>
                        <button data-testid="node-down" class="px-3 py-1.5 text-left text-ink hover:bg-bg-card-hover" onClick={() => { setMenuId(null); move(n, 1) }}>↓ Move down</button>
                        <button data-testid="node-addchild" class="px-3 py-1.5 text-left text-ink hover:bg-bg-card-hover" onClick={() => { setMenuId(null); setDraft(emptyDraft(n.id)) }}>＋ Add child</button>
                        <button data-testid="node-edit" class="px-3 py-1.5 text-left text-ink hover:bg-bg-card-hover" onClick={() => { setMenuId(null); editNode(n) }}>Edit</button>
                        <button data-testid="node-del" class="px-3 py-1.5 text-left text-red-400 hover:bg-bg-card-hover" onClick={() => { setMenuId(null); del(n) }}>Delete</button>
                      </div>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 class="font-bold text-ink-heading mb-3">Editor</h2>
            {!draft && <p class="text-ink-muted text-sm">Select a node to edit, or click + New.</p>}
            {draft && (
              <div data-testid="editor" class="flex flex-col gap-3">
                <input
                  data-testid="editor-title"
                  class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
                  placeholder="Title"
                  value={draft.title}
                  onInput={(e) => setDraft({ ...draft, title: (e.target as HTMLInputElement).value })}
                />
                <div class="grid grid-cols-2 gap-3">
                  <label class="text-xs text-ink-muted flex flex-col gap-1">
                    Type
                    <select
                      data-testid="editor-type"
                      class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
                      value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: (e.target as HTMLSelectElement).value })}
                    >
                      {TYPES.map((t) => <option value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label class="text-xs text-ink-muted flex flex-col gap-1">
                    Parent
                    <select
                      data-testid="editor-parent"
                      class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
                      value={draft.parent_id ?? ''}
                      onChange={(e) => {
                        const v = (e.target as HTMLSelectElement).value
                        setDraft({ ...draft, parent_id: v ? Number(v) : null })
                      }}
                    >
                      <option value="">(root)</option>
                      {flat.filter((n) => n.id !== draft.id).map((n) => (
                        <option value={n.id}>{'— '.repeat(n.depth)}{n.title || '(untitled)'} [{n.type}]</option>
                      ))}
                    </select>
                  </label>
                  <label class="text-xs text-ink-muted flex flex-col gap-1">
                    Status
                    <select
                      data-testid="editor-status"
                      class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
                      value={draft.status}
                      onChange={(e) => setDraft({ ...draft, status: (e.target as HTMLSelectElement).value })}
                    >
                      <option value="published">published</option>
                      <option value="draft">draft</option>
                    </select>
                  </label>
                  <label class="text-xs text-ink-muted flex flex-col gap-1">
                    Slug
                    <input
                      data-testid="editor-slug"
                      class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink"
                      value={draft.slug}
                      onInput={(e) => setDraft({ ...draft, slug: (e.target as HTMLInputElement).value })}
                    />
                  </label>
                </div>

                {draft.type === 'cfe' && (
                  <div class="flex flex-col gap-2 border border-edge rounded-md p-3">
                    <span class="text-xs text-ink-muted">CFE details</span>
                    <input data-testid="cfe-github" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="GitHub URL (required)" value={draft.metadata.github_url || ''} onInput={(e) => setMeta('github_url', (e.target as HTMLInputElement).value)} />
                    <input data-testid="cfe-live" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="Live URL (optional)" value={draft.metadata.live_url || ''} onInput={(e) => setMeta('live_url', (e.target as HTMLInputElement).value)} />
                    <input data-testid="cfe-tagline" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="Tagline" value={draft.metadata.tagline || ''} onInput={(e) => setMeta('tagline', (e.target as HTMLInputElement).value)} />
                    <input data-testid="cfe-tags" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="Tags (comma separated)" value={(draft.metadata.tags || []).join(', ')} onInput={(e) => setMeta('tags', (e.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean))} />
                    <input data-testid="cfe-owner" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="Owner" value={draft.metadata.owner || ''} onInput={(e) => setMeta('owner', (e.target as HTMLInputElement).value)} />
                    <input data-testid="cfe-image-input" type="file" accept="image/*" class="text-sm text-ink-muted" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setMeta('image', await fileToDataUrl(f)) }} />
                    {draft.metadata.image && <img data-testid="cfe-image-preview" src={draft.metadata.image} class="w-40 rounded-sm border border-edge" />}
                    <label class="flex items-center gap-2 text-sm text-ink">
                      <input data-testid="cfe-reviewed" type="checkbox" checked={!!draft.metadata.reviewed} onChange={(e) => setMeta('reviewed', (e.target as HTMLInputElement).checked)} />
                      Reviewed (show on landing page)
                    </label>
                  </div>
                )}

                {draft.type === 'external_link' && (
                  <input data-testid="ext-href" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" placeholder="External URL (https://help.zooniverse.org/…)" value={draft.metadata.href || ''} onInput={(e) => setMeta('href', (e.target as HTMLInputElement).value)} />
                )}

                {draft.type === 'featured' && (
                  <label class="text-xs text-ink-muted flex flex-col gap-1">
                    Linked discussion/thread
                    <select data-testid="featured-link" class="rounded-md border border-edge bg-bg px-3 py-2 text-sm text-ink" value={draft.metadata.links_content_id ?? ''} onChange={(e) => setMeta('links_content_id', Number((e.target as HTMLSelectElement).value) || undefined)}>
                      <option value="">(none)</option>
                      {flat.filter((n) => n.type === 'thread' || n.type === 'reply').map((n) => (
                        <option value={n.id}>{n.title || `#${n.id}`} [{n.type}]</option>
                      ))}
                    </select>
                  </label>
                )}

                <span class="text-xs text-ink-muted">Body (markdown)</span>
                <MarkdownEditor value={draft.body_markdown} onInput={(v) => setDraft({ ...draft, body_markdown: v })} />

                <div class="flex gap-2">
                  <button data-testid="editor-save" class="px-4 py-2 rounded-md bg-accent text-bg font-medium" onClick={save}>Save</button>
                  <button class="px-4 py-2 rounded-md border border-edge text-ink" onClick={() => setDraft(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <h2 class="font-bold text-ink-heading mb-3">User management</h2>
          <div data-testid="add-user" class="flex items-end gap-2 mb-5 flex-wrap bg-bg-card border border-edge rounded-md p-4">
            <label class="text-xs text-ink-muted flex flex-col gap-1">
              Zooniverse login
              <input
                data-testid="add-user-login"
                class="rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink"
                placeholder="e.g. researcher1"
                value={newLogin}
                onInput={(e) => setNewLogin((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === 'Enter' && addUser()}
              />
            </label>
            <label class="text-xs text-ink-muted flex flex-col gap-1">
              Role
              <select
                data-testid="add-user-role"
                class="rounded-sm border border-edge bg-bg px-3 py-2 text-sm text-ink"
                value={newRole}
                onChange={(e) => setNewRole((e.target as HTMLSelectElement).value)}
              >
                <option value="contributor">contributor</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button data-testid="add-user-submit" class="px-4 py-2 rounded-sm bg-accent text-bg font-medium" onClick={addUser}>
              Add user
            </button>
          </div>
          <table data-testid="users-table" class="w-full text-sm border border-edge rounded-md overflow-hidden">
            <thead class="bg-bg-card text-ink-muted">
              <tr>
                <th class="text-left px-3 py-2">Login</th>
                <th class="text-left px-3 py-2">Name</th>
                <th class="text-left px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={3} class="px-3 py-3 text-ink-muted">No users yet.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} data-testid="user-row" data-login={u.login} class="border-t border-edge">
                  <td class="px-3 py-2 text-ink">
                    {u.login}
                    {u.pending ? <span data-testid="user-pending" class="ml-2 text-xs text-ink-muted">(pending sign-in)</span> : null}
                  </td>
                  <td class="px-3 py-2 text-ink-muted">{u.display_name}</td>
                  <td class="px-3 py-2">
                    <select
                      data-testid="user-role-select"
                      class="rounded-md border border-edge bg-bg px-2 py-1 text-ink"
                      value={u.role || ''}
                      onChange={(e) => setRole(u.id, (e.target as HTMLSelectElement).value)}
                    >
                      <option value="">viewer</option>
                      <option value="contributor">contributor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

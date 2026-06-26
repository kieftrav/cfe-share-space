import { useEffect, useState } from 'preact/hooks'
import { api } from '../api'
import { user } from '../store'

// User administration only; content is managed in-context on each section page.
export function Admin() {
  const [users, setUsers] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [newLogin, setNewLogin] = useState('')
  const [newRole, setNewRole] = useState('contributor')

  async function loadUsers() {
    try {
      const { users } = await api.get('/api/users')
      setUsers(users)
    } catch {
      setUsers([])
    }
  }
  useEffect(() => {
    loadUsers()
  }, [])

  if (user.value === undefined) return <p class="text-ink-muted">Loading…</p>
  if (user.value?.role !== 'admin') {
    return <p data-testid="admin-guard" class="text-ink-muted">Admins only. Sign in with an admin account.</p>
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

  async function setRole(id: string, role: string) {
    await api.put(`/api/users/${encodeURIComponent(id)}/role`, { role: role || null })
    await loadUsers()
  }

  return (
    <section data-testid="admin">
      <h1 class="text-3xl font-bold text-ink-heading mb-2">Admin</h1>
      <p class="text-ink-muted mb-6">User administration. Manage content directly on each section's page.</p>

      {msg && <p data-testid="admin-msg" class="text-sm text-accent mb-4">{msg}</p>}

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
                  class="rounded-sm border border-edge bg-bg px-2 py-1 text-ink"
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
    </section>
  )
}

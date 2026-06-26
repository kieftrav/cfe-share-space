import { signal } from '@preact/signals'
import { api } from './api'

export type User = { id: string; login: string; display_name: string; role: string | null } | null

// undefined = still loading, null = anonymous, object = signed in
export const user = signal<User | undefined>(undefined)

export async function refreshMe() {
  try {
    const { user: u } = await api.get('/api/auth/me')
    user.value = u
  } catch {
    user.value = null
  }
}

export async function logout() {
  await api.post('/api/auth/logout')
  await refreshMe()
}

export const isAdmin = () => user.value?.role === 'admin'
// Any signed-in user can contribute.
export const canWrite = () => !!user.value
// Admins manage anything; everyone else only their own authored content.
export const canManage = (item: { author_id?: string | null }) =>
  isAdmin() || (!!user.value && item.author_id === user.value.id)

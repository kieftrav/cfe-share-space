import { signal } from '@preact/signals'
import { api } from './api'

export type User = { login: string; display_name: string; role: string | null } | null

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
// No whitelist: any signed-in Zooniverse user can contribute.
export const canWrite = () => !!user.value

import { useEffect, useState } from 'preact/hooks'
import { user, logout } from '../store'

export function AuthButton() {
  const [err, setErr] = useState('')
  const u = user.value

  // Surface ?auth_error=... left by the callback redirect, then strip it.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const e = p.get('auth_error')
    if (e) {
      setErr(e)
      p.delete('auth_error')
      const qs = p.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  if (u) {
    return (
      <div class="flex items-center gap-3 text-sm">
        <span data-testid="auth-user" class="text-ink-muted">
          {u.login}
          {u.role ? <span class="text-accent"> · {u.role}</span> : <span class="text-ink-muted"> · member</span>}
        </span>
        <button
          data-testid="auth-signout"
          class="px-3 py-1.5 rounded-md border border-edge text-ink hover:border-accent hover:text-accent"
          onClick={() => logout()}
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div class="flex items-center gap-2">
      {err && <span data-testid="auth-error" class="text-xs text-red-400 max-w-[220px] truncate" title={err}>{err}</span>}
      <button
        data-testid="auth-button"
        type="button"
        onClick={() => {
          // Full-page navigation (NOT client-side routing) so the server 302 to
          // Zooniverse actually fires. A same-origin <a> would be intercepted by
          // the SPA router and require a manual refresh.
          window.location.href = '/api/auth/login'
        }}
        class="text-sm font-medium px-4 py-1.5 rounded-md border border-edge text-ink hover:border-accent hover:text-accent cursor-pointer"
      >
        Sign in with Zooniverse
      </button>
    </div>
  )
}

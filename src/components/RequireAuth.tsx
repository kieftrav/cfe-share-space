import type { ComponentChildren } from 'preact'
import { user } from '../store'

// Discussion is researcher-only. Signed-out visitors get a sign-in prompt instead
// of the forum; the rest of the site stays public.
export function RequireAuth({ children }: { children: ComponentChildren }) {
  const u = user.value
  if (u === undefined) return <p class="text-ink-muted">Loading…</p>
  if (!u) {
    return (
      <section data-testid="auth-gate" class="text-center max-w-[520px] mx-auto py-20">
        <h1 class="text-2xl font-bold text-ink-heading mb-3">Discussions are for signed-in members</h1>
        <p class="text-ink-muted mb-7">
          Sign in with your Zooniverse account to read and join the CFE discussions.
        </p>
        <button
          data-testid="auth-gate-signin"
          type="button"
          onClick={() => {
            window.location.href = '/api/auth/login'
          }}
          class="text-sm font-medium px-5 py-2 rounded-md bg-accent text-bg cursor-pointer"
        >
          Sign in with Zooniverse
        </button>
      </section>
    )
  }
  return <>{children}</>
}

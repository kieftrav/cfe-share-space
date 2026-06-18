import type { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { TopNav } from './components/TopNav'
import { refreshMe } from './store'

export function App({ children }: { children: ComponentChildren }) {
  useEffect(() => {
    refreshMe()
  }, [])
  return (
    <div class="min-h-screen flex flex-col">
      <TopNav />
      <main data-testid="main" class="mx-auto w-full max-w-[1100px] px-6 py-12 flex-1">
        {children}
      </main>
    </div>
  )
}

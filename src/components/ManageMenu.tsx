import { useEffect, useRef, useState } from 'preact/hooks'
import { api, type Content } from '../api'

export type MenuAction = { label: string; testid: string; onClick: () => void; danger?: boolean }

// The ⋮ admin/owner action menu used on every content item; extra actions render above Edit/Delete.
export function ManageMenu({
  item,
  onEdit,
  onDeleted,
  actions = [],
}: {
  item: Content
  onEdit: () => void
  onDeleted: () => void
  actions?: MenuAction[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [open])

  async function del() {
    if (!confirm(`Delete "${item.title || 'this item'}"${item.children?.length ? ' and its children' : ''}?`)) return
    await api.del(`/api/content/${item.id}`)
    onDeleted()
  }

  const row = (label: string, testid: string, onClick: () => void, danger = false) => (
    <button
      data-testid={testid}
      class={`px-3 py-1.5 text-left text-sm hover:bg-bg-card-hover ${danger ? 'text-red-400' : 'text-ink hover:text-accent'}`}
      onClick={() => { setOpen(false); onClick() }}
    >
      {label}
    </button>
  )

  return (
    <span data-testid="manage-menu-wrap" ref={ref} class="relative inline-block">
      <button
        data-testid="manage-menu"
        aria-haspopup="true"
        aria-expanded={open}
        title="Actions"
        class="px-2 text-ink-muted hover:text-ink leading-none text-lg"
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open && (
        <div data-testid="manage-menu-panel" class="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-sm border border-edge bg-bg-card py-1 shadow-lg flex flex-col text-left">
          {actions.map((a) => row(a.label, a.testid, a.onClick, a.danger))}
          {row('Edit', 'manage-edit', onEdit)}
          {row('Delete', 'manage-delete', del, true)}
        </div>
      )}
    </span>
  )
}

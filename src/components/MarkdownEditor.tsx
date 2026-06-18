import { Markdown } from './Markdown'

export function MarkdownEditor({
  value,
  onInput,
  testid = 'md-editor',
}: {
  value: string
  onInput: (v: string) => void
  testid?: string
}) {
  return (
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <textarea
        data-testid={testid}
        class="min-h-[220px] w-full rounded-md border border-edge bg-bg px-3 py-2 text-sm font-mono text-ink"
        value={value}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
        placeholder="Write markdown…"
      />
      <div class="min-h-[220px] rounded-md border border-edge bg-bg-card px-3 py-2 overflow-auto">
        <Markdown source={value} />
      </div>
    </div>
  )
}

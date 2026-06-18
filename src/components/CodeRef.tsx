export type CodeRefData = {
  github_url?: string
  repo_path?: string
  line_start?: number | string
  line_end?: number | string
  code?: string
}

export function CodeRef({ data }: { data: CodeRefData }) {
  if (!data || (!data.github_url && !data.repo_path && !data.code)) return null
  const lines =
    data.line_start && data.line_end ? `:${data.line_start}-${data.line_end}` : data.line_start ? `:${data.line_start}` : ''
  return (
    <div data-testid="code-ref" class="my-3 rounded-lg border border-edge overflow-hidden">
      <div class="flex items-center justify-between bg-bg-card-hover px-3 py-1.5 text-xs">
        <span data-testid="code-ref-path" class="font-mono text-ink-muted truncate">
          {data.repo_path || 'code'}{lines}
        </span>
        {data.github_url && (
          <a
            data-testid="code-ref-link"
            href={data.github_url}
            target="_blank"
            rel="noopener"
            class="text-accent no-underline whitespace-nowrap ml-3"
          >
            View on GitHub ↗
          </a>
        )}
      </div>
      {data.code && (
        <pre class="m-0 bg-[#0b0d14] px-3 py-2 overflow-auto text-sm">
          <code>{data.code}</code>
        </pre>
      )}
    </div>
  )
}

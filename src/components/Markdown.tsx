import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function Markdown({ source, class: cls = '' }: { source: string; class?: string }) {
  const html = DOMPurify.sanitize(marked.parse(source || '', { async: false }) as string)
  return <div class={`prose-cfe ${cls}`} dangerouslySetInnerHTML={{ __html: html }} />
}

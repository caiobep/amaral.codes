export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function escapeMarkdownLabel(value: string): string {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]')
}

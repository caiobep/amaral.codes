export function recordToPageHeaderAdapter(
  headerProps: Record<string, string | object>,
) {
  const pageHeaders = Object.entries(headerProps)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')

  return `---\n${pageHeaders}\n---`
}

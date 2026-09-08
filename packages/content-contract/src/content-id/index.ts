export function createContentId(value: string): string {
  const id = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.'’`"()•]/g, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (id) return id
  throw new Error(`Could not create a content ID from "${value}"`)
}

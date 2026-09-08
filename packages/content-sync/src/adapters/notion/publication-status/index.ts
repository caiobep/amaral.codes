export function isPublishedNotionStatus(
  sourceName: string | undefined,
): boolean {
  return sourceName?.trim().toLowerCase() === 'published'
}

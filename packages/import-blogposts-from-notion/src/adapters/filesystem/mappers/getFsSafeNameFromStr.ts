export function getFsSafeNameFromStr(pageName: string): string {
  return (
    pageName
      .trim()
      .replaceAll(' ', '_')
      .replaceAll('/', '')
      .replaceAll('"', '')
      .replaceAll('?', '')
      .replaceAll(':', '') + '.md'
  )
}

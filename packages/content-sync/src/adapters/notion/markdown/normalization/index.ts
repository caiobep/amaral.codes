export function normalizeNotionMarkdown(markdown: string): string {
  const normalizedLines: string[] = []
  let containerDepth = 0
  let insideCodeFence = false

  for (const sourceLine of markdown.split('\n')) {
    const line = stripContainerIndent(sourceLine, containerDepth)
    const trimmed = line.trim()

    if (/^(```|~~~)/.test(trimmed)) insideCodeFence = !insideCodeFence
    if (insideCodeFence) {
      normalizedLines.push(line)
      continue
    }

    if (isClosingContainer(trimmed)) {
      containerDepth = Math.max(0, containerDepth - 1)
      normalizedLines.push('')
      continue
    }
    if (isOpeningContainer(trimmed)) {
      containerDepth += 1
      normalizedLines.push('')
      continue
    }

    normalizedLines.push(normalizeNotionLine(line))
  }

  return normalizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function stripContainerIndent(line: string, containerDepth: number): string {
  let result = line
  for (let index = 0; index < containerDepth && result.startsWith('\t'); index += 1) {
    result = result.slice(1)
  }
  return result
}

function isOpeningContainer(line: string): boolean {
  return /^<(?:columns|column|callout|details)(?:\s[^>]*)?>$/.test(line)
}

function isClosingContainer(line: string): boolean {
  return /^<\/(?:columns|column|callout|details)>$/.test(line)
}

function normalizeNotionLine(line: string): string {
  if (line.trim() === '<empty-block/>') return ''

  return line
    .replace(/\s*\{color="[a-z_]+"\}\s*$/i, '')
    .replace(/^(\s*)- \[[ xX]\]\s+/, '$1- ')
    .replace(/^<summary>([^<]+)<\/summary>$/i, '#### $1')
    .replace(/<span\s+color="[a-z_]+">([^<]*)<\/span>/gi, '$1')
    .replace(
      /<mention-(?:page|database|data-source)\s+url="([^"]+)">([^<]+)<\/mention-[^>]+>/gi,
      '$2',
    )
    .replace(
      /<mention-(?:page|database|data-source)\s+url="([^"]+)"\s*\/>/gi,
      '',
    )
    .replace(
      /<database\s+url="[^"]+"[^>]*>([^<]*)<\/database>/gi,
      '$1',
    )
    .replace(
      /\[([^\]]+)\]\(https:\/\/(?:(?:www\.)?notion\.so|[\w-]+\.notion\.site|app\.notion\.com)\/[^)]+\)/gi,
      '$1',
    )
}

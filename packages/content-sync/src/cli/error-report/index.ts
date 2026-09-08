const URL_PATTERN = /https?:\/\/\S+/giu
const UUID_PATTERN = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/giu
const COMPACT_ID_PATTERN = /\b[0-9a-f]{32}\b/giu
const NOTION_TOKEN_PATTERN = /\b(?:ntn_|secret_)[a-z0-9_-]+\b/giu

export function formatCliError(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : 'Unknown content synchronization failure'

  return message
    .replace(URL_PATTERN, '[redacted URL]')
    .replace(UUID_PATTERN, '[redacted ID]')
    .replace(COMPACT_ID_PATTERN, '[redacted ID]')
    .replace(NOTION_TOKEN_PATTERN, '[redacted credential]')
}

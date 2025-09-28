import 'dotenv/config'

const getEnvOrDie = (keys: string | string[]): string => {
  const candidates = Array.isArray(keys) ? keys : [keys]
  for (const key of candidates) {
    const value = process.env[key]
    if (value) return value
  }
  throw new Error(`Missing env var: ${candidates.join(' / ')}`)
}

export const environment = {
  NOTION_API_KEY: getEnvOrDie(['NOTION_API_KEY', 'NOTION_TOKEN']),
  NOTION_BLOG_DATABASE: getEnvOrDie(['NOTION_BLOG_DATABASE', 'NOTION_DATABASE_ID']),
  NOTION_BLOG_TAG: getEnvOrDie(['NOTION_BLOG_TAG', 'NOTION_BLOG_TAG_ID']),
}

export default environment

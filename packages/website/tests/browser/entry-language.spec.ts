import { expect, test } from '@playwright/test'
import type { AgentContentIndex } from '../../src/lib/agent-discovery'

interface LanguageMetadata {
  inLanguage?: string
  '@graph'?: LanguageMetadata[]
}

const entries = [
  { slug: 'fixture-essay', language: 'en' },
  { slug: 'fixture-portuguese', language: 'pt-BR' },
  { slug: 'lambda3-118-ios-macos', language: 'pt-BR' },
  { slug: 'functional-programming-with-react', language: 'en' },
] as const

for (const { slug, language } of entries) {
  test(`${slug} declares the same language across public representations`, async ({ page, request }) => {
    await page.goto(`/posts/${slug}`)
    await expect(page.locator('html')).toHaveAttribute('lang', language)

    const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents()
    const declaredLanguages = structuredData.flatMap((source) => {
      const document = JSON.parse(source) as LanguageMetadata
      const records = document['@graph'] ?? [document]
      return records.flatMap((record) => record.inLanguage ? [record.inLanguage] : [])
    })
    expect(declaredLanguages.length).toBeGreaterThan(0)
    expect(new Set(declaredLanguages)).toEqual(new Set([language]))

    const markdown = await request.get(`/posts/${slug}.md`)
    expect(markdown.ok()).toBe(true)
    expect(await markdown.text()).toContain(`- Language: ${language}`)

    const response = await request.get('/content-index.json')
    expect(response.ok()).toBe(true)
    const index = await response.json() as AgentContentIndex
    expect(index.entries.find((entry) => entry.id === slug)?.language).toBe(language)
  })
}

import { describe, expect, it } from 'vitest'
import { escapeHtml, escapeMarkdownLabel } from './serialization.ts'

describe('public markup serialization', () => {
  it('escapes HTML text and double-quoted attributes in the established order', () => {
    expect(escapeHtml('&"<>')).toBe('&amp;&quot;&lt;&gt;')
    expect(escapeHtml('A &amp; B')).toBe('A &amp;amp; B')
    expect(escapeHtml("plain 'text'")).toBe("plain 'text'")
  })

  it('escapes brackets in Markdown labels while preserving other characters', () => {
    expect(escapeMarkdownLabel('A [nested [label]]')).toBe('A \\[nested \\[label\\]\\]')
    expect(escapeMarkdownLabel('A \\ path & (text)')).toBe('A \\ path & (text)')
  })
})

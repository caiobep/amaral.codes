import { expect, it } from 'vitest'
import { getCmsCodeLanguage } from './cms-code-language'

it.each(['typescript', 'ts', 'tsx', 'javascript', 'js', 'python', 'c#', 'clj'])(
  'accepts the bundled language or alias %s',
  language => {
    expect(getCmsCodeLanguage(language)).toBe(language)
  },
)

it.each([
  undefined,
  '',
  'plain',
  'plaintext',
  'text',
  'txt',
  'unknown-cms-language',
  'typescript\n```',
  '__proto__',
  'toString',
])(
  'renders unrecognized or plain language labels as plaintext: %s',
  language => {
    expect(getCmsCodeLanguage(language)).toBe('plaintext')
  },
)

it('accepts Shiki’s ANSI special language', () => {
  expect(getCmsCodeLanguage('ansi')).toBe('ansi')
})

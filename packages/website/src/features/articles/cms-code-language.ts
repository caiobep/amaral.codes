import { bundledLanguages } from 'shiki/langs'
import type { BundledLanguage } from 'shiki/langs'

export function getCmsCodeLanguage(
  language: string | undefined,
): BundledLanguage | 'plaintext' | 'ansi' {
  if (language === 'ansi') return language
  return isBundledLanguage(language) ? language : 'plaintext'
}

function isBundledLanguage(
  language: string | undefined,
): language is BundledLanguage {
  return language !== undefined && Object.hasOwn(bundledLanguages, language)
}

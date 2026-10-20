import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type { TalkData } from '@amaral.codes/content-contract'
import {
  ENTRY_LANGUAGES,
  TALK_FORMATS,
  TALK_MATERIAL_TYPES,
} from '@amaral.codes/content-contract'
import { requirePublicUrl } from '@amaral.codes/content-contract/public-url'
import { getText, requireText } from '../../../properties/index.ts'
import { readOption } from '../options/index.ts'

export function mapTalk(page: NotionPage): TalkData {
  return {
    format: readOption(page, 'Talk format', TALK_FORMATS, 'talk'),
    event: getText(page, 'Event'),
    language: readOption(page, 'Language', ENTRY_LANGUAGES, undefined),
    materials: [{
      label: getText(page, 'Material label') ?? 'Open material',
      type: readOption(page, 'Material type', TALK_MATERIAL_TYPES, 'pdf'),
      url: requirePublicUrl(requireText(page, 'Material URL'), 'Material URL'),
    }],
  }
}

import {
  ENTRY_LANGUAGES, PODCAST_PLAYERS, TALK_FORMATS, TALK_MATERIAL_TYPES,
} from '@amaral.codes/content-contract'
import { isPublicHttpsUrl } from '@amaral.codes/content-contract/public-url'
import type { ArrayFieldValidation, Field, TextFieldSingleValidation } from 'payload'
import { array, text } from 'payload/shared'
import { z } from 'zod'

export const validatePublicUrl: TextFieldSingleValidation = async (value, options) => {
  const result = await text(value, options)
  if (result !== true || !value) return result
  return isPublicHttpsUrl(value) || 'Use a public HTTPS URL without credentials.'
}

export const validatePlayers: ArrayFieldValidation = async (value, options) => {
  const result = await array(value, options)
  if (result !== true) return result
  const players = z.array(z.object({ service: z.string() })).safeParse(value)
  if (!players.success) return true
  const services = players.data.map(player => player.service)
  return new Set(services).size === services.length || 'Use each podcast player once.'
}

const publicUrl = {
  type: 'text' as const,
  validate: validatePublicUrl,
}

export const podcastFields: Field = {
  name: 'podcast', type: 'group',
  admin: { condition: data => data.category === 'podcast' },
  fields: [
    { name: 'show', type: 'text', required: true },
    { name: 'episode', type: 'text' },
    { ...publicUrl, name: 'sourceUrl', label: 'Original episode URL', required: true },
    {
      name: 'audio', label: 'Audio file', type: 'upload', relationTo: 'media',
      filterOptions: { mimeType: { equals: 'audio/mpeg' } },
    },
    {
      name: 'players', type: 'array', required: true, minRows: 1,
      validate: validatePlayers,
      fields: [
        {
          name: 'service', type: 'select', required: true,
          options: PODCAST_PLAYERS.map(value => ({
            value,
            label: {
              applePodcasts: 'Apple Podcasts', spotify: 'Spotify',
              pocketCasts: 'Pocket Casts', overcast: 'Overcast',
            }[value],
          })),
        },
        { ...publicUrl, name: 'url', required: true },
      ],
    },
  ],
}

export const talkFields: Field = {
  name: 'talk', type: 'group',
  admin: { condition: data => data.category === 'talk' },
  fields: [
    { name: 'format', type: 'select', options: [...TALK_FORMATS], defaultValue: 'talk', required: true },
    { name: 'event', type: 'text' },
    { name: 'language', type: 'select', options: [...ENTRY_LANGUAGES] },
    { ...publicUrl, name: 'recordingUrl', label: 'Recording URL' },
    {
      name: 'materials', type: 'array', required: true, minRows: 1,
      fields: [
        { name: 'label', type: 'text', required: true, defaultValue: 'Slides' },
        {
          name: 'source', type: 'select', required: true, defaultValue: 'upload',
          options: [{ label: 'Upload PDF', value: 'upload' }, { label: 'Public URL', value: 'url' }],
        },
        {
          name: 'file', type: 'upload', relationTo: 'media', required: true,
          filterOptions: { mimeType: { equals: 'application/pdf' } },
          admin: { condition: (_data, siblingData) => siblingData.source === 'upload' },
        },
        {
          ...publicUrl, name: 'url', label: 'Material URL', required: true,
          admin: { condition: (_data, siblingData) => siblingData.source === 'url' },
        },
        {
          name: 'type', type: 'select', options: [...TALK_MATERIAL_TYPES], defaultValue: 'pdf', required: true,
          admin: { condition: (_data, siblingData) => siblingData.source === 'url' },
        },
      ],
    },
  ],
}

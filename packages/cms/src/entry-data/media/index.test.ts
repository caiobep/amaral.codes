import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { podcastData, recordingUrl, talkData, uploadedMediaUrl } from './index'

const media = {
  id: 123, filename: 'episode 1.mp3', mimeType: 'audio/mpeg', filesize: 1024,
  url: 'http://127.0.0.1:4010/api/media/file/episode%201.mp3',
  createdAt: '2026-09-01', alt: 'Episode audio',
}
const podcast = {
  show: 'Example show', episode: '1', sourceUrl: 'https://example.com/episode',
  players: [{ id: 'cms-row', service: 'spotify', url: 'https://open.spotify.com/episode/example' }],
}

describe('populated media mapping', () => {
  it('maps audio to a private preview path and byte length without CMS metadata', () => {
    expect(podcastData({ ...podcast, audio: media })).toEqual({
      show: 'Example show', episode: '1', sourceUrl: 'https://example.com/episode',
      players: [{ service: 'spotify', url: 'https://open.spotify.com/episode/example' }],
      audioUrl: '/podcasts/cms-preview/episode%201.mp3', audioBytes: 1024,
    })
  })

  it.each([null, undefined])('supports original-source episodes without audio (%s)', (audio) => {
    expect(podcastData({ ...podcast, episode: '', audio })).toEqual({
      show: podcast.show, episode: undefined, sourceUrl: podcast.sourceUrl,
      players: [{ service: 'spotify', url: podcast.players[0].url }],
    })
  })

  it.each([
    123, null, { ...media, filesize: 0 }, { ...media, filesize: 1.5 },
    { ...media, mimeType: 'application/pdf' }, { ...media, filename: '../private.mp3' },
    { ...media, filename: 'folder\\private.mp3' }, { ...media, filename: '' },
  ])('rejects unpopulated or invalid audio instead of dropping it: %j', (audio) => {
    expect(() => uploadedMediaUrl(audio, 'podcasts')).toThrow(ZodError)
  })

  it('maps PDF uploads and public material URLs and removes row IDs and hidden fields', () => {
    expect(talkData({
      format: 'workshop', event: '', language: null, recordingUrl: 'https://example.com/video',
      materials: [
        { id: 'row1', label: 'Slides', source: 'upload', file: { ...media, filename: 'slides.pdf', mimeType: 'application/pdf' }, url: 'stale', type: 'keynote' },
        { id: 'row2', label: 'Source deck', source: 'url', type: 'keynote', url: 'https://example.com/slides.key', file: 123 },
      ],
    })).toEqual({
      format: 'workshop', event: undefined, language: undefined,
      materials: [
        { label: 'Slides', type: 'pdf', url: '/talks/cms-preview/slides.pdf' },
        { label: 'Source deck', type: 'keynote', url: 'https://example.com/slides.key' },
      ],
    })
  })

  it('rejects non-PDF uploads and incomplete material choices', () => {
    expect(() => talkData({ materials: [{ label: 'Slides', source: 'upload', file: media }] })).toThrow(ZodError)
    expect(() => talkData({ materials: [{ label: 'Slides' }] })).toThrow(ZodError)
  })
})

describe('recording URL', () => {
  it('returns only the public recording URL for the preview renderer', () => {
    expect(recordingUrl({ recordingUrl: 'https://example.com/recording', id: 'private' })).toBe('https://example.com/recording')
  })

  it.each(['', null, undefined])('normalizes an absent recording (%s)', (value) => {
    expect(recordingUrl({ recordingUrl: value })).toBeUndefined()
  })

  it.each(['javascript:alert(1)', 'http://example.com', 'https://example.com?token=private'])('rejects unsafe recording %s', (value) => {
    expect(() => recordingUrl({ recordingUrl: value })).toThrow(ZodError)
  })
})

import { editorMedia } from './media-config.mjs'

const types = [
  ['post', 'posts', 'Posts', 'article'],
  ['podcast', 'podcasts', 'Podcasts', 'podcasts'],
  ['talk', 'talks', 'Talks', 'co_present'],
]
const postTypes = ['essay', 'note', 'review', 'link', 'video']


const optionalString = (name, label) => ({
  name,
  label,
  widget: 'string',
  required: false,
})
const optionalNumber = (name, label) => ({
  name,
  label,
  widget: 'number',
  value_type: 'int',
  min: 1,
  required: false,
})
const languageField = {
  name: 'language',
  label: 'Language',
  widget: 'select',
  required: false,
  options: [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt-BR' },
  ],
}

const sharingFields = [
  {
    name: 'sharing', label: 'Social sharing', widget: 'object', required: false,
    collapsed: true,
    hint: 'Optional overrides for shared links. Your article title and homepage summary stay unchanged.',
    fields: [
      optionalString('title', 'Sharing title'),
      { name: 'description', label: 'Sharing description', widget: 'text', required: false },
      { name: 'image', label: 'Sharing image', widget: 'image', required: false },
      { ...optionalString('imageAlt', 'Image description'), hint: 'Required when you choose a sharing image.' },
    ],
  },
  {
    name: 'linkCards', label: 'Link cards', widget: 'list', required: false,
    collapsed: true,
    hint: 'Optional saved title, description, and image for a standalone link in your writing.',
    fields: [
      { name: 'url', label: 'Link URL', widget: 'string' },
      { name: 'title', label: 'Link title', widget: 'string' },
      { name: 'description', label: 'Link description', widget: 'text', required: false },
      { name: 'image', label: 'Link image', widget: 'image', required: false },
      optionalString('imageAlt', 'Image description'),
    ],
  },
]

const podcastFields = [
  {
    name: 'podcast',
    label: 'Podcast details',
    widget: 'object',
    collapsed: true,
    summary: '{{fields.show}} · {{fields.episode}}',
    fields: [
      { name: 'show', label: 'Show', widget: 'string' },
      optionalString('episode', 'Episode'),
      { name: 'sourceUrl', label: 'Episode page', widget: 'string' },
      {
        name: 'players',
        label: 'Listen on',
        widget: 'list',
        min: 1,
        fields: [
          {
            name: 'service',
            label: 'Service',
            widget: 'select',
            options: ['applePodcasts', 'spotify', 'pocketCasts', 'overcast'],
          },
          { name: 'url', label: 'Player URL', widget: 'string' },
        ],
      },
      optionalString('audioUrl', 'Hosted audio URL'),
      optionalNumber('audioBytes', 'Audio size in bytes'),
    ],
  },
]

const talkFields = [
  {
    name: 'talk',
    label: 'Talk details',
    widget: 'object',
    collapsed: true,
    summary: '{{fields.event}} · {{fields.format}}',
    fields: [
      {
        name: 'format',
        label: 'Format',
        widget: 'select',
        options: ['talk', 'workshop', 'brownbag'],
        default: 'talk',
      },
      optionalString('event', 'Event'),
      languageField,
      {
        name: 'materials',
        label: 'Slides and materials',
        widget: 'list',
        min: 1,
        fields: [
          { name: 'label', label: 'Link label', widget: 'string' },
          {
            name: 'type',
            label: 'File type',
            widget: 'select',
            options: ['pdf', 'keynote', 'powerpoint'],
          },
          { name: 'url', label: 'File URL', widget: 'string' },
          {
            name: 'preview',
            label: 'Preview image',
            widget: 'object',
            required: false,
            fields: [
              { name: 'src', label: 'Image', widget: 'image' },
              {
                name: 'width',
                label: 'Width',
                widget: 'number',
                value_type: 'int',
                min: 1,
              },
              {
                name: 'height',
                label: 'Height',
                widget: 'number',
                value_type: 'int',
                min: 1,
              },
            ],
          },
        ],
      },
    ],
  },
]

function talkFieldsFor(mediaEnabled) {
  const fields = structuredClone(talkFields)
  if (mediaEnabled) {
    const materials = fields[0].fields.find(field => field.name === 'materials')
    Object.assign(materials.fields.find(field => field.name === 'url'), {
      label: 'Slides file', widget: 'file', media_library: { name: 'cloudflare_r2' },
      hint: 'Upload a PDF or original deck to the private media library, or paste its existing URL.',
    })
  }
  return fields
}

function fieldsFor(category, mediaEnabled) {
  return [
    { name: 'title', label: 'Title', widget: 'string' },
    {
      name: 'summary',
      label: 'Summary',
      widget: 'text',
      required: false,
      hint: 'The secondary text shown beside the title on the homepage and in the archive.',
    },
    {
      name: 'body',
      label: 'Writing',
      widget: 'markdown',
      modes: ['rich_text', 'raw'],
      required: false,
      sanitize_preview: true,
      hint: 'Write here or add a photo. Switch to Markdown for code and embedded HTML.',
    },
    {
      name: 'date',
      label: 'Publication date',
      widget: 'datetime',
      type: 'date',
      default: '{{now}}',
      hint: 'Defaults to today for a new entry. Existing publication dates stay unchanged unless edited.',
    },
    category === 'post'
      ? { name: 'category', label: 'Type', widget: 'select', options: postTypes.map(value => ({ label: value[0].toUpperCase() + value.slice(1), value })), dropdown_threshold: 0, default: 'note' }
      : { name: 'category', widget: 'hidden', default: category },
    ...(category === 'post' ? [
      { name: 'language', widget: 'hidden', default: '{{locale}}', i18n: true },
    ] : [languageField]),
    {
      name: 'topics', label: 'Topics', widget: 'relation', required: false,
      collection: 'topics', multiple: true, value_field: 'name',
      display_fields: ['name'], search_fields: ['name', 'description'],
      dropdown_threshold: 0,
      hint: 'Pick existing topics. Add new ones in the Topics collection before using them here.',
    },
    {
      ...optionalNumber('featuredOrder', 'Homepage order'),
      hint: 'Leave empty for the archive only. Use 1 for the first homepage card, 2 for the next.',
    },
    ...(category === 'podcast' ? podcastFields : []),
    ...(category === 'talk' ? talkFieldsFor(mediaEnabled) : []),
    ...sharingFields,
  ]
}

function localizeFields(fields) {
  return fields.map(field => ({
    ...field,
    i18n: field.i18n ?? true,
    ...(field.fields ? { fields: localizeFields(field.fields) } : {}),
  }))
}

export function createEditorConfig({
  repository,
  demonstration = false,
  media,
  siteUrl = 'https://amaral.codes',
}) {
  return {
    backend: demonstration
      ? { name: 'test-repo' }
      : {
          name: 'github',
          repo: repository,
          branch: 'main',
          preview_context: 'publishing-preview',
          auth_methods: ['token'],
        },
    publish_mode: demonstration ? 'simple' : 'editorial_workflow',
    i18n: { structure: 'multiple_files', locales: ['en', 'pt-BR'], default_locale: 'en', initial_locales: 'default', omit_default_locale_from_file_path: true },
    output: { omit_empty_optional_fields: true },
    app_title: 'Caio Amaral · Publishing',
    site_url: siteUrl,
    display_url: siteUrl,
    logo: { src: '/favicon.svg', show_in_header: true },
    media_folder: 'media',
    public_folder: '/media',
    media_libraries: {
      ...(media ? { cloudflare_r2: editorMedia(media) } : {}),
      default: {
        config: {
          max_file_size: 20 * 1024 * 1024,
          filename_template: '{{slug}}-{{uuid_short}}',
          transformations: {
            raster_image: {
              format: 'webp',
              quality: 85,
              width: 2400,
              height: 2400,
            },
          },
        },
      },
    },
    collections: [...types.map(([category, folder, label, icon]) => ({
      name: folder,
      label,
      icon,
      label_singular: label.slice(0, -1),
      folder: `entries/${folder}`,
      create: true,
      delete: false,
      slug: {
        template: '{{slug}}',
        editable: ['create'],
        hint: 'The URL is fixed after creation to preserve existing links.',
      },
      i18n: category === 'post',
      format: 'yaml-frontmatter',
      extension: 'md',
      preview_path: category === 'post' ? '{{locale | lower}}/posts/{{slug}}' : 'posts/{{slug}}',
      summary: '{{title}} · {{date | date("MMM D, YYYY")}}',
      table_columns: [
        'title',
        ...(category === 'post' ? [{ field: 'category', label: 'Type' }] : []),
        'date',
        'summary',
        'topics',
        { field: 'featuredOrder', label: 'Homepage order' },
      ],
      sortable_fields: {
        fields: ['date', 'title', 'featuredOrder'],
        default: { field: 'date', direction: 'descending' },
      },
      view_filters: [
        ...(category === 'post' ? postTypes.map(value => ({ label: value[0].toUpperCase() + value.slice(1), field: 'category', pattern: `^${value}$` })) : []),
        { label: 'On the homepage', field: 'featuredOrder', gt: 0 },
        { label: 'Needs a summary', field: 'summary', empty: true },
      ],
      editor: { preview: true },
      fields: category === 'post' ? localizeFields(fieldsFor(category, Boolean(media))) : fieldsFor(category, Boolean(media)),
    })), {
      name: 'topics', label: 'Topics', label_singular: 'Topic', icon: 'label',
      folder: 'taxonomy/topics', extension: 'yml', format: 'yaml',
      create: true, delete: false, identifier_field: 'name',
      slug: { template: '{{name}}', editable: ['create'] },
      summary: '{{name}}', table_columns: ['name', 'description'],
      sortable_fields: { fields: ['name'], default: { field: 'name', direction: 'ascending' } },
      editor: { preview: false },
      fields: [
        { name: 'name', label: 'Topic', widget: 'string', unique: true,
          hint: 'The exact label saved in posts. Renaming requires updating posts that use it; the build checks those references.' },
        { name: 'description', label: 'Description', widget: 'text', required: false },
      ],
    }],
  }
}

export const categoryFolders = Object.fromEntries(
  [...postTypes.map(category => [category, category === 'essay' ? 'essays' : `${category}s`]), ['podcast', 'podcasts'], ['talk', 'talks']],
)

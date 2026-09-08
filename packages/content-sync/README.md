# Content sync

This package turns dedicated Notion databases into an ephemeral Astro content
snapshot:

- **BlogDB** owns essays, notes, reviews, links, and videos.
- **PodcastsDB** owns podcast appearances.
- **Website Projects** owns software and physical projects.

It uses Notion's official Markdown API, downloads expiring Notion assets, converts
images to WebP, and writes each collection through a staging directory. The files
exist only in a local or cloud build workspace and are not committed. The deployed
website never receives Notion credentials.

## Architecture

The package uses explicit hexagonal boundaries:

- `domain` owns content identity, publication rules, and slug behavior.
- `application` owns sync use cases and ports.
- `adapters` translate Notion, Markdown, and filesystem behavior into those ports.
- `composition-root/index.ts` is the only place that wires concrete adapters together.

Dependencies point inward. `npm run quality:hygiene` enforces these import boundaries
and the repository's folder-per-tested-module convention.

## Configuration

Copy `.env.example` to `packages/content-sync/.env`:

```dotenv
NOTION_TOKEN=
NOTION_ENTRIES_DATA_SOURCE_ID=
NOTION_PODCASTS_DATABASE_ID=
NOTION_PROJECTS_DATA_SOURCE_ID=
```

Share every database with the integration represented by `NOTION_TOKEN`. Entries
and projects use data-source IDs. Podcasts use the database page ID because the
adapter resolves its single data source before querying it.

## Authoring workflow

1. Create an entry in the appropriate Notion database.
2. Keep the entry in any non-public status while it is incomplete.
3. Give the entry a short `Slug`; otherwise the title becomes the slug.
4. Review the entry in Notion. Set entries and projects to the exact status
   `Published` only when their text and attachments are safe to make public.
   Every other status is excluded.
5. Run `npm run content:dev` when a local website preview is useful. Production
   refreshes and validates every public collection before Astro builds.

```sh
# Refresh every configured collection.
npm run content:sync

# Refresh all public content and start the local website.
npm run content:dev

# Refresh one collection.
npm run content:sync:entries
npm run content:sync:podcasts
npm run content:sync:projects

```

Synced editorial entries and podcasts use separate ignored snapshots under
`packages/website/src/content/entries/synced`. Synced projects live in
`packages/website/src/content/projects/synced`. The sync process owns only those
directories; hand-maintained content beside them is never replaced or reserved by
the generated snapshot.

## Entries schema

The compact `BlogDB` schema uses `Name`, `Status`, `Category`, `AI summary`, and
the formula date `Created At`. Only rows whose status is exactly `Published` are
mapped into the public snapshot. A recognized `Category` such as `Essay`,
`Review`, or `Link` becomes the website entry type. Other category values become
topics, and an empty category defaults to `Note`.

The richer schema remains supported. It uses `Name`, `Type`, `Status`, `Summary`,
and `Date`, with optional `Slug`, `Topics`, and `Featured order` fields. Explicit
rich-schema fields take precedence when both forms are present.

Podcast entries also use `Show`, `Episode`, `Source URL`, player URLs, `Audio URL`,
and `Audio bytes`. Talk entries use `Talk format`, `Event`, `Language`, `Material
label`, `Material type`, and a locally hosted `Material URL` under `/talks/`.

## Podcasts schema

The legacy `PodcastsDB` schema uses `Name`, `Created`, `Tags`, `Description`,
`Link`, and optional `File`. Only pages with a public Notion URL are exported.
`Link` supplies the episode destination and player URL; the show and episode number
are derived from the tags and title.

## Projects schema

Every entry needs `Name`, `Kind`, `Status`, `Summary`, `Order`, and `Category`.
Optional fields include `Slug`, `Technologies`, `Featured order`, external link
fields, and either a code preview or visual metadata. Featured projects also use
`Problem`, `Approach`, and `Result` to populate their factual summary.

Only projects whose Notion status is exactly `Published` are mapped into the
public snapshot.

Project imagery and talk files should use stable public URLs. The sync process
handles images embedded in a Notion page body, but large canonical media such as
podcast audio and slide decks belongs in object storage.

Transient Notion image URLs are downloaded and converted to local WebP files for
Astro. Transient audio, video, PDF, and generic file URLs are rejected because
they cannot become durable static routes without object storage; use stable
public HTTPS URLs for those media types.

## Safety properties

- The source adapter may list non-public Notion rows to evaluate publication,
  but only exact `Published` entries and projects cross the mapping boundary.
- Public domain objects and generated Markdown contain no workflow status.
- An empty source or a source with no public records is rejected instead of erasing
  the current snapshot.
- Collection baselines reject severe count drops. Set
  `PUBLICATION_ALLOW_LARGE_DROP=1` only for a reviewed, intentional reduction;
  the override never permits an empty collection.
- A failed fetch or conversion leaves the current synced collection untouched.
- Duplicate slugs stop the sync before files are replaced.
- Generated frontmatter excludes Notion record IDs and private workflow metadata.
- Notion page bodies are authoritative inside the managed directories.
- Credential-free code builds use deterministic content fixtures in CI.
- Production builds receive read-only Notion credentials only while acquiring
  the candidate static snapshot.

## Verification

```sh
npm run quality -w @amaral.codes/content-sync
```

The gate runs strict type-aware linting, TypeScript, unit coverage above the package
thresholds, and per-function CRAP analysis capped at 6.

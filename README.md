# amaral.codes

Static personal website and its content tooling. Production builds acquire a
validated public snapshot from Notion before Astro runs. The deployed website
does not call Notion or another editorial service at runtime.

## Workspace boundaries

| Workspace | Owns | Does not own |
| --- | --- | --- |
| `packages/content-contract` | Shared public metadata schemas, identifiers, and URL policy | Acquisition, rendering, or filesystem access |
| `packages/website` | Astro pages, components, content collections, publishable media, feeds, search, PWA behavior, and browser tests | Content acquisition credentials or recovery downloads |
| `packages/content-sync` | Synchronizing public Entries and Projects from Notion, materializing expiring assets, and atomically updating an ignored build snapshot | Rendering, routing, or deployment |
| `scripts` | Repository-wide hygiene and cleanup | Product behavior |

Inside the website, generated and hand-maintained Markdown lives in `src/content`.
Generated Notion snapshots are isolated under ignored `synced/` directories.
Application logic lives in `src/lib` and `src/scripts`, route composition in
`src/pages`, and files that must be published without transformation in `public`.

## Data lifecycle

1. Write recurring content in the private **Website Entries** or **Website Projects**
   database in Notion. Keep entries in `Draft` while they are incomplete.
2. Set an entry or project to the exact Notion status `Published` only when it is
   safe to expose. Every other status remains private. Podcasts use their
   dedicated database's public-page signal instead of a workflow status.
3. `npm run build:production` fetches the complete public dataset, atomically
   replaces the ignored `synced/` snapshots, rejects empty or unexpectedly small
   collections, and rejects unsafe output before Astro runs.
4. Astro creates one static snapshot containing pages, feeds, search data,
   metadata, and materialized inline images. Only that static output is deployed.

[`publication-policy.json`](publication-policy.json) is the versioned release
contract for collection paths, expected counts, and the permitted reduction
ratio. Update its expected counts deliberately as public collections grow; the
same policy is enforced before the atomic swap and again before Astro builds.

`npm run content:dev` provides the same acquisition step before local development.
The normal `npm run build` remains credential-free for code validation. CI builds
against deliberate public fixtures rather than receiving Notion credentials.

Podcast recovery downloads and temporary QA evidence are intentionally kept
outside the Git workspace. Optimized images and small previews may live in
`packages/website/public`; canonical audio, video, and editable slide files belong
in object storage.

Canonical files awaiting an object-storage release belong in ignored `.local`
staging directories. Presentations use `.local/presentation-canonical-assets/`;
other media uses `.local/canonical-assets/<content-type>/<slug>/`. Keep each path
aligned with its eventual `https://assets.amaral.codes` URL.

## Infrastructure

The Astro build is deployed as static assets on Cloudflare Workers using
`packages/website/wrangler.jsonc`. A narrow Worker entry point handles content
negotiation for post detail routes; all representations are still generated at
build time, and other assets continue through Cloudflare's direct static path.
The production-only configuration disables `workers.dev` and declares
`amaral.codes` as the sole Custom Domain.

Every public post has a `/posts/<slug>.md` representation. Requests to the
canonical post URL with `Accept: text/markdown` receive that same artifact with
`Content-Type: text/markdown` and `Vary: Accept`; normal browser requests continue
to receive HTML. Post HTML and Worker responses advertise the Markdown alternate
and the site-wide agent index through standard `Link` relations.

Agent discovery is generated from the same validated public content snapshot:

- `/llms.txt` is the concise published-content index.
- `/llms-full.txt` combines the full text of published entries.
- `/content-index.json` is the versioned metadata contract for all public entries
  and projects, including older public entries excluded from the two curated files.

These endpoints are immutable build artifacts. Public Markdown and metadata do
not carry workflow status. They also contain no drafts, runtime Notion
identifiers, generated timestamps, or other private workflow metadata.

`npm run verify:cloudflare` checks routing intent and compiles a dry-run
bundle without uploading it. `npm run deploy:cloudflare` is the live cutover
command: it refreshes and validates public content before Wrangler attaches the
Worker to the apex Custom Domain. Review conflicting apex DNS records before
deliberately running that command.

Canonical audio, video, PDF, Keynote, and PowerPoint files use stable HTTPS URLs
from object storage; small page-critical previews remain bundled with the
website. Object-storage provisioning and uploads are separate release operations,
not part of a normal site build.

Do not add an object-storage binding to the static site. The website reads public,
immutable asset URLs and production builds remain independent of Cloudflare APIs.

The accepted commit-free, build-time Notion publishing model is documented in
[`ARCHITECTURE.md`](ARCHITECTURE.md). Repository support is in place; Cloudflare
build secrets and the content-triggered Deploy Hook remain rollout work.

## Commands

```sh
npm run dev            # local Astro server
npm run build          # credential-free quality gates plus Astro build
npm run build:production # fresh Notion snapshot, publication checks, and Astro build
npm run quality        # repository, sync package, and website checks
npm run test:browser   # Playwright journeys
npm run content:sync   # refresh ignored local Markdown from Notion
npm run content:sync:entries
npm run content:sync:projects
npm run content:dev    # sync public Notion entries, then start the local site
npm run deploy:cloudflare:dry-run # validate the static Worker bundle without uploading
npm run verify:publication # require and validate every generated collection
npm run deploy:cloudflare # refresh content, run release gates, and deploy
npm run clean          # remove generated output
```

Notion field mappings and synchronization behavior are documented in
[`packages/content-sync/README.md`](packages/content-sync/README.md).

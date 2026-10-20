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
Feature-owned UI, styling, and browser behavior live together in `src/features`.
Shared application logic remains in `src/lib` and site-wide initialization in
`src/scripts`; route composition lives in `src/pages`, and files published
without transformation live in `public`.

### Where to edit

- Search: start in `packages/website/src/features/search`. The header and full
  search page share a browser loader and engine; build-time document generation
  remains in `packages/website/src/lib/search/documents.ts`.
- Appearance: `packages/website/src/features/appearance` owns theme and palette
  definitions, first-paint initialization, and the preference controls. Palette
  colors remain in the website styles.
- Category wording and icons: `packages/website/src/features/entries` owns the
  presentation catalog. Podcast service labels and icons live in
  `packages/website/src/features/podcasts`. Plain presentation data stays
  separate from Astro icon imports so browser consumers remain lightweight.
- Project images and code samples: `packages/website/src/features/projects`
  owns `ProjectVisual.astro`; each page owns its layout and loading priority.
- Articles: `packages/website/src/features/articles` owns the article shell,
  local styling, and browser behavior. Talk materials and sharing controls live
  in the neighboring `talks` and `sharing` features.
- Legacy redirect routes: `packages/website/src/features/redirects` owns their
  shared page and browser behavior; `packages/website/src/lib/redirects` owns
  allowed destinations.
- Public Markdown and metadata: `packages/website/src/lib/agent-markdown` and
  `packages/website/src/lib/structured-data`. Language policy lives in
  `packages/content-contract/src/entry-language.ts`: explicit entry language,
  then legacy talk language, then Portuguese for podcasts or English otherwise.
- Notion field translation: `packages/content-sync/src/adapters/notion/properties`
  owns shared readers; each collection mapper owns its field names and policy.

Use descriptive colocated test names, such as `search.ts` and `search.test.ts`.
Browser journeys remain under `packages/website/tests/browser`. The quality gate
checks Astro component contracts and follows browser imports through local
modules to prevent build-time content and publishing dependencies from shipping
to the browser.

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

`npm run content:sync -- all` refreshes content before local development.
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

Install once from the repository root with `npm ci`. Start with these commands:

```sh
npm run dev            # local Astro server
npm run quality        # all local code and content checks
npm run build          # quality checks, static site, and PWA validation
npm run preview        # serve the existing build
npm run test:browser   # browser journeys against the existing build
```

For deterministic local verification, use
`AMARAL_CONTENT_SOURCE=fixtures npm run build`. Browser tests and performance
checks use that generated site.

The root manifest owns shared development tools. Package manifests own runtime
dependencies and commands that need a package's working directory. The website's
`build` / `postbuild` lifecycle generates and validates the service worker.

Each package exposes `lint`, `typecheck`, `test`, and `quality`.
The root quality gate checks repository rules first, then runs every package's
quality gate. A package failure still fails the overall command; the remaining
packages run so their diagnostics are available too.

<details>
<summary>Focused checks and tooling ownership</summary>

```sh
npm run quality -w @amaral.codes/content-sync
npm run typecheck -w @amaral.codes/website
npm test -w @amaral.codes/website -- src/features/appearance/model.test.ts
npm test -w @amaral.codes/content-contract -- --watch
npm run lint -w @amaral.codes/content-sync -- --fix
npm run perf -- --assert --runs=3 # performance budgets against the existing build
npm test -w @amaral.codes/website -- --coverage
npm run perf -- --preset=desktop # optional desktop measurements
npm run clean          # remove generated output
```

Shared coverage settings live in `scripts/testing`; each package's
`vitest.config.ts` owns its test discovery and coverage source lists. Website
quality-source discovery also supplies its complexity check. The root quality
chain lists repository checks directly; package quality chains list their own
lint, types, fresh coverage, and complexity checks. Keep those stages visible
when changing the workflow.

</details>

<details>
<summary>Content publishing and release checks</summary>

These commands acquire public content from Notion or validate release artifacts:

```sh
npm run content:sync -- all          # refresh every configured collection
npm run content:sync -- entries      # refresh one collection
npm run content:sync -- podcasts
npm run content:sync -- projects
npm run build:production             # fresh snapshot, publication checks, build
npm run verify:publication           # validate every generated collection
npm run verify:cloudflare            # validate existing build; no upload
npm run build:production && npm run verify:cloudflare # fresh release dry-run
npm run verify:release               # full code, asset, browser and performance checks
npm run deploy:cloudflare            # refresh, build, validate, and deploy
```

Sync requires exactly one target. Missing targets, unknown targets, and extra
arguments are rejected before reading configuration or acquiring content. To preview fresh content, run
`npm run content:sync -- all && npm run dev`.

Field performance measurements remain available directly through their tool:
`npm exec -w @amaral.codes/website -- node scripts/commands/measure-pagespeed.mjs`.

Notion field mappings and synchronization behavior are documented in
[`packages/content-sync/README.md`](packages/content-sync/README.md).

</details>

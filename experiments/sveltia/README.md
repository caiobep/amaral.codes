# Sveltia publishing experiment

## Consolidated publishing integration

The current implementation prepares four editorial collections: Posts, Podcasts, Talks, and Topics. Posts stores essays, notes, reviews, links, and videos together, with a Type selector and filters. The build projects them back into the website's established categorized entry folders. The 63-entry migration preserves body bytes and existing public URL stems, keeps a backup manifest, and refuses stale edits. Existing Podcasts and Talks remain byte-for-byte unchanged. A private `publishing/legacy-urls.json` registry preserves the original URLs of the 43 consolidated posts.

The proposed private repository contains content, media, topics, link-preview data, and a small publishing bootstrap. Website code comes from a reviewed full commit SHA in the canonical public source repository. `publishing/source.json` accepts only that repository and an immutable revision. Generated source, editor, routes, and website output stay under ignored `.publishing/`; they are not a second maintained website. Publish the source on an integration branch before updating the pin; leave the production branch unchanged during review.

Posts use native linked English and Brazilian Portuguese files. Existing Portuguese-only notes remain editable. Sveltia requires the default English locale when creating a new bilingual entry; it cannot create a Portuguese-only entry from the new-entry form. New post URLs include the locale from first publication, and adding a translation does not move either URL. Homepage, search, feeds, related reads, canonical metadata, language links, and Markdown endpoints use the generated route metadata. Only the primary version enters the main indexes.

Draft builds require an explicit verified Access boundary and use `wrangler versions upload`, never `deploy`. Hashed aliases avoid exposing draft titles in hostnames. They do not change the published preview's active version. The Cloudflare-managed build command for branch previews still needs an actual connected build check before automatic draft publishing can be claimed. Workers' native check does not expose a preview URL to Sveltia. The prepared GitHub status bridge recognizes only the observed Cloudflare app and preview Worker check, verifies the open same-repository draft's exact commit, and reports the protected URL with an ephemeral repository token. It checks out trusted `main`, not the draft branch, and needs only content read and status write permissions.

Native R2 configuration is conditional on connecting a dedicated `amaral-publishing-media` bucket. The editor's key must have Object Read & Write on that bucket only. This includes object deletion, so it must never receive access to the existing material bucket. Keep public bucket endpoints disabled; the preview streams reads from `/_media/cms-uploads/` behind Access with no storage of browser credentials in code. Enter the Secret Access Key in Sveltia's native settings, never in configuration. Exact-origin CORS is required for signed direct browser uploads. Existing Git-backed photos and protected deck delivery remain available during connection. Before a future public-site cutover, establish a public release path for approved uploaded assets; an Access-protected preview media URL is not a public production URL.

Translation controls are prepared, but automatic translation requires a separately configured provider key and intentional use. No text is sent to a translation provider by the build.

Verification and activation are separate. Local native saves and a protected public/synthetic Cloudflare canary have runtime evidence. The immutable remote-source bootstrap, status bridge, R2 upload credentials, and automatic draft build chain require their connected activation checks. Historical experiment receipts below describe earlier releases and do not establish those new checks.


This experiment keeps the existing Astro website and edits portable Markdown through Sveltia. It does not change production or the EmDash deployment.

The proposed content repository is private. Its `main` branch contains published entries, grouped by type under `entries/`, and images under `media/`. Sveltia's editorial workflow saves drafts to separate branches and publishes them by merging into `main`. A production build must read only `main`; draft branch builds must stay protected.

Collection icons and desktop table columns use native Sveltia configuration. Topics have their own catalog under `taxonomy/topics/`; preparation seeds it from the exact labels already used by public entries. Posts use a searchable multiple-choice relation that preserves those labels. Catalog names must be unique, and builds reject unresolved references so topic renames and post updates must land together. The topic collection stays outside article generation and does not create public post URLs. The Language field remains entry metadata; multilingual versions and automatic translation require a separate internationalization setup and provider key.

The editor uses a fine-grained GitHub token restricted to this repository, with Contents and Pull requests read/write permissions. Tokens are entered in the editor, never added to configuration or build output. Optional empty fields are omitted to preserve the strict public metadata contract. Publication dates use a native date picker with today as the new-entry default; existing timestamp values are preserved. Summaries have a dedicated field. Writing opens in rich text with Markdown available for code and embedded HTML. A metadata-only save of a representative code article preserves the exact body in the browser-only test backend.

## Local verification

Run from the repository root:

```sh
node --test experiments/sveltia/*.test.mjs
node experiments/sveltia/prepare.mjs
```

Preparation expects a verified public archive of 63 entries and 25 images, plus an extracted, pinned Sveltia package under the ignored `.trial/vendor/package` directory. It validates the configuration against Sveltia's shipped schema, refuses to overwrite the content snapshot, and creates a disposable copy of the existing website. It relocates image URLs to `/media/` without rewriting other Markdown or frontmatter.

`.trial/editor/demo/` uses Sveltia's browser-only test backend seeded with the public archive. Changes there stay in the browser and do not publish to GitHub or a website. `.trial/editor/admin/` is the configured GitHub editor. Neither the demo nor its seed files belong in a production build.

## Protected deployment

The private `caiobep/amaral-content` repository now contains the public archive and a fixed website snapshot for this isolated preview. `prepare-publishing.mjs` prepares that snapshot; `build.mjs` validates public metadata, privacy rules, raw HTML, and unique URLs before building. Draft branches are rejected before website files are changed. The preview dependencies pin the patched YAML parser and the Cloudflare build uses a pinned Node runtime.

The static editor is deployed at `https://amaral-publishing-preview.caiobep.workers.dev/admin/`. Cloudflare Access protects all traffic with the existing owner-only email policy, and version URLs are disabled. Anonymous requests to the site, editor, configuration, images, search index, and service worker require Access. The deployed archive shows all 63 entries, homepage summaries, and representative code and images.

The editor's restricted-token sign-in is working. A native Sveltia canary saved to a private draft branch, reopened with its summary and body intact, moved through review, and published by merging into `main`. A second revision then verified automatic publishing: Sveltia published commit `fc336e5`, Cloudflare Workers Builds succeeded in 1 minute 29 seconds, and the revised summary and body appeared on the protected preview without a manual deployment. Draft branch builds remain disabled. Real iPhone usability requires separate verification before migration can be considered complete.

The Cloudflare GitHub app is authorized for only `caiobep/amaral-content`. Its dedicated managed build token was reduced to Workers Scripts Edit and Account Settings Read for the existing account before any build ran. It has no storage, database, zone, certificate, or user permissions. Workers deployment permission is account-wide. Version URLs remain disabled. The preview has an Assets binding and an R2 binding for published talk materials; ordinary pages and editor assets continue through the direct static path.

## Talk material delivery

The archive originally referenced `assets.amaral.codes`, a planned hostname with no public DNS record. All nine deck files already existed in `amaral-codes-assets`; each matches its preserved canonical file byte for byte. The preview build changes those URLs only in generated Astro input to same-origin `/talks/<slug>/slides.*` paths. Source entries remain unchanged. It also generates an exact allowlist from published talk metadata, outside the static output.

A small streaming Worker reads only allowlisted objects, accepts GET and HEAD, supports byte ranges, and returns private, non-storable responses. It contains no upload, listing, or deletion handler. Cloudflare Access protects these preview URLs. No new credential, bucket, public endpoint, or DNS record was created, and no bucket publication setting was changed. The existing asset bucket's managed public endpoint was already enabled; the protected preview does not rely on that endpoint.

All seven real PDF decks rendered in the deployed preview, and the React deck advanced from slide 1 to slide 2 of 22. Thirteen anonymous requests, including all nine material URLs, redirected to Access. R2 objects and production were not modified. The browser automation download helper timed out, so native download completion and Safari/iPhone behavior require separate verification.

## Enhanced editor verification

The pinned NPM editor is bundled and hosted with the preview. The article preview reuses the website typography and article CSS and includes a homepage-card view. Date sorting, homepage and missing-summary filters, stable existing slugs, and collapsed podcast/talk details use native configuration. New raster uploads become WebP with a 2400-pixel maximum edge and unique names. The isolated preview disables the website offline cache.

The stylesheet adapter preserves nested CSS selector parentheses. Its previous conversion changed `:not(pre) > code` into `:not(pre > code)`, applying inline-code styling to prose and reducing code contrast to 1.83:1. A nested-selector regression covers this failure. Preview-only layout rules remove the full-page sidebar rail, use the pane's available title width, and preserve horizontal scrolling inside code blocks.

The real preview component reproduced the reported failure in isolated browser frames. Corrected rendering passed at 390, 600, and 800 CSS pixels, with normal prose styling, 16.33:1 code contrast, and no page overflow. The homepage-card toggle also worked at 390 pixels. The tested, generated, and deployed stylesheet bytes match. All 19 experiment tests and `npm run quality` passed. Evidence is in `.trial/acceptance/editor-preview/`. The integrated browser cannot load Sveltia's blob iframe, so native Safari editor rendering remains **CODE-LEVEL READY — RUNTIME UNVERIFIED**; the component-frame evidence must not be described as a completed native editor test.

A clean index export with `npm ci --ignore-scripts && npm run build` verifies that all required snapshot files are present, independently of local ignored files. The browser-only canary verified a new photo note, its summary, date and homepage order, and a saved 2400×1466 WebP. Those canary changes are excluded from Git and deployment.

The integrated browser leaves Sveltia’s blob preview iframe blank and its viewport override did not take effect. A separate HTTP iframe provided a genuine 390-pixel browsing viewport for responsive testing: the native mobile navigation and single-column editor rendered without horizontal overflow, and a new note saved and reopened with its body, summary, date, homepage order, image, and alt text. A generated HEIC using an already-public archive image converted to a 2400×1466 WebP of 85.5 KB. These browser-only canaries are excluded from Git and deployment.

The real Git-backed canary exposed Sveltia's unquoted YAML dates. The build now reads dates as strings and serializes validated frontmatter into the generated Astro input so Astro also retains string dates. Source Markdown and body bytes stay unchanged. The regression test covers date-only values, timestamps, summaries, and exact code-block bytes; a clean build with the actual saved draft generated all 64 entries successfully.

Custom preview rendering in Safari and physical iPhone usability remain unverified. Git-backed draft saving, publishing, automatic builds, and the resulting protected website have runtime proof. The isolated preview is ready for a user trial; production and billing remain unchanged.

| Scenario | Expected | Observed | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Save a draft | Private draft, published branch unchanged | Native Sveltia created draft PRs and preserved fields on reopen | Private PRs 1 and 2 | RUNTIME VERIFIED |
| Publish an edit | Git merge triggers a build and updates the page | Build `8ea73679` succeeded; revised summary and body rendered | `.trial/acceptance/automatic-published-note.png` and `deployment.json` | RUNTIME VERIFIED |
| Anonymous access | Site, editor, assets, and new post require Access | Nine routes redirected to Access; version URLs stayed disabled | `.trial/acceptance/deployment.json` | RUNTIME VERIFIED |
| PDF preview | Real R2 deck bytes render through protected same-origin URLs | All seven PDFs rendered; React navigation advanced to slide 2 | `.trial/acceptance/pdf/browser-verification.json` and `react-slide-2.png` | RUNTIME VERIFIED |
| Material boundary | Only published material keys can be read; anonymous users require Access | Nine files matched originals; thirteen anonymous routes required Access; write/unknown-key regression tests passed | `.trial/acceptance/pdf/r2-verification.json` and `security-verification.json` | RUNTIME VERIFIED |

Validation commands: `node --test experiments/sveltia/*.test.mjs` passed all 12 tests; explicit ESLint checks for the build module and its regression test passed; `npm run quality` passed the full applicable repository gates. A clean `npm ci --ignore-scripts && npm run build` built 64 entries, and Cloudflare repeated the real install/build/deploy successfully with the restricted token.

The PDF delivery change passed all 18 experiment tests, explicit ESLint checks, `npm run quality`, the private repository build with 63 real entries, and Wrangler's dry run. The deployed Worker reported a 1 ms startup time; this is not a per-request CPU measurement. The privacy check found zero matches for ten known credentials in source and the built site, and all 460 primary-checkout fingerprints were unchanged. See `.trial/acceptance/pdf/` for the focused receipts. Committing and pushing this follow-up requires explicit approval before automatic-build durability can be claimed.

## Sharing and rich links

The protected preview supports optional per-entry social titles, descriptions, images, and image descriptions. The editor includes a Social sharing view alongside Article and Homepage card. Shared-link previews use the same description generator as the website. Custom images do not inherit the default JPEG dimensions or MIME type. Canonical, Open Graph, Twitter, structured-data, and feed origins use the preview hostname in the isolated snapshot.

Standalone paragraph links can use saved title, description, and image metadata. Existing published metadata is stored in the private snapshot; authors can override it using Link cards. New uncached links are enriched during builds, with at most twelve requests and three concurrent jobs. HTTPS targets and every redirect undergo public-address validation and pinned DNS resolution. Responses have time and size limits. Downloaded images are decoded, resized, stripped of metadata, and hosted with the site. Unavailable sources retain a readable text card. Drafts are not sent to a metadata service. Newly fetched metadata is not automatically committed by CI, so uncached sources may be revisited on later builds until their metadata is saved.

All 63 articles passed generated Open Graph, Twitter, canonical-origin, default-image, and local-image checks. The archive contains ten rich standalone paragraph cards; ordinary links in tight lists remain normal links. An isolated clean build also verified custom social overrides without changing the article heading or assigning false JPEG dimensions to a custom WebP. Browser component frames at 390px and 800px verified default/custom sharing images, view switching, rich cards, and absence of page overflow. The integrated browser cannot inspect Sveltia's blob preview iframe; native Safari and physical iPhone editor behavior remain unverified. Social services cannot unfurl this Access-protected preview.

The focused regression suite has 30 passing tests, and the required `npm run quality` gate passes. A fresh source export installs and builds all 63 entries. Known-credential scanning found no matches in the source snapshot or built assets. The original primary-checkout fingerprint inventory is no longer an unchanged baseline because concurrent work modified that checkout; this preview task preserves those edits and does not deploy production. These manual preview updates still require an explicitly approved private-repository commit/push before future automatic builds can retain them.

Preview appearance controls now offer Light and Dark for all three preview views using the real website theme variables. Selection survives switching views and is scoped to the preview document; entry content and the surrounding CMS appearance stay unchanged. The toolbar wraps at phone width. All 31 experiment tests, the full quality gate, and the 63-entry private build pass. Component browser checks covered both themes at 390px and 800px. Native Safari/iPhone preview verification remains outstanding; see `.trial/acceptance/preview-theme-verification.md`. The manual preview deployment still awaits an approved private-repository commit/push.

Sharing artwork now identifies each article instead of repeating a generic banner. The editor's live artwork and build-time PNGs use the website's Instrument Serif and Instrument Sans with the post title, category, date, and optional authored summary. Per-entry overrides and custom images remain supported. Generated PNGs live only in the published build snapshot, use content hashes in their URLs, and are excluded from Git. Caption fitting keeps long text clear of the footer. The bundled OFL font licenses accompany the rendering fonts. All 34 experiment regressions, explicit lint, full quality, clean install/build, and the 63-image metadata check pass. Component screenshots compare actual PNGs and live artwork at matching mobile widths; native phone rendering and public social unfurling remain unverified. See `.trial/acceptance/sharing-redesign/`.

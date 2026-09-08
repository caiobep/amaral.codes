# Repository Engineering Rules

## Architecture

- Keep the content pipeline hexagonal. `domain` contains technology-free rules and types. `application` contains use cases and ports. `adapters` implement ports for Notion, Markdown, and the filesystem. Only `composition-root/index.ts` wires concrete adapters together.
- Dependencies point inward: adapters may depend on application and domain; application may depend on domain; domain may not depend on application, adapters, Astro, Notion, or filesystem APIs.
- Keep framework and service types out of domain and application interfaces. Translate them at adapter boundaries.
- Prefer a small use case with explicit ports over helper modules that mix API calls, mapping, persistence, and logging.

## Tests

- A source module with a colocated unit test must live in its own folder. Use `feature/index.ts` with `feature/index.test.ts` (or the equivalent extension).
- Keep end-to-end tests under the package-level `tests/` directory. Do not colocate browser specs with source modules.
- Add tests at domain and application boundaries first. Adapter tests should focus on translation and external-service behavior.
- `npm run quality` is the required local gate. Coverage and CRAP limits may not be weakened to make a change pass.
- Keep `scripts/check-architecture.mjs` in the root quality gate. New architecture rules must be executable where practical, rather than documentation-only conventions.

## Content And Assets

- Keep entries grouped by content type under `packages/website/src/content/entries`: `essays`, `notes`, `reviews`, `links`, `videos`, `podcasts`, and `talks`.
- Never write drafts or previews into tracked content directories. Only public content may be written under `synced/`.
- Do not commit large audio, video, editable presentation bundles, or other replaceable binaries. Store them in object storage and keep stable metadata plus optimized previews in Git.
- Never expose Notion page IDs, tokens, signed attachment URLs, or private workflow metadata in synced frontmatter.

## Scope And Quality

- Keep files below the repository size limits and functions at CRAP 6 or lower.
- Keep authored JavaScript and TypeScript modules at or below 24 top-level functions. Split mixed responsibilities instead of adding exceptions to the executable gate.
- Delete dead files and duplicate assets only after verifying imports, content references, and intentionally stable public URLs.
- Work with existing uncommitted changes. Do not revert unrelated work.

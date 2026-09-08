# Local CMS Trial

Run `npm run cms:dev` from the repository root, then open
`http://127.0.0.1:4010/admin` and create your local account.

## Try On Your Phone

On trusted Wi-Fi, start with `CMS_TRIAL_HOST=<your-Mac-LAN-IP> npm run cms:dev`.
Open `https://<your-Mac-LAN-IP>:4010/admin` on both your Mac and phone, and sign in
with your existing local account. Preview uses the same address on port 4324.
Both servers bind only to that address; omit the variable to return to loopback.
The Mac must remain awake and connected. No tunnel or router port forwarding is
needed. The launcher creates a self-signed HTTPS certificate in ignored local
storage using OpenSSL; no system trust settings are changed. Accept the certificate warning
for this address on ports 4010 and 4324 before using embedded preview. Certificates
last one year; remove the matching `.local/https/` certificate and key to renew.
Do not use this development mode on public or untrusted networks.

## Try The Workflow

1. Open **Notes** and edit a local draft, or create one with a title and slug.
2. Write in the rich-text editor. Type `/` to insert headings, lists, images,
   quotes, and other supported blocks. Changes autosave after a pause.
3. Open **Live Preview** to see the actual Astro article alongside the editor.
   Choose Phone, Tablet, or Desktop to check the layout. Preview refreshes after
   saving, not on every keystroke. The separate preview link also works.
4. Choose **Podcast** or **Talk** under category to reveal the relevant fields.
   Podcasts support an MP3 and links to listening apps. Talks support uploaded
   PDFs, public material links, and a recording link.
5. Use **Publish changes** to save a local published revision. Continue editing
   its draft and compare the two from the preview toolbar. Payload's version
   history lets you inspect and restore older revisions (up to 30 per entry).

**Publish does not deploy the website.** The dashboard and editor display this
boundary. This trial is for evaluating the authoring experience before choosing
a production publishing architecture.

## Boundaries

- Notion, Markdown content, normal builds, and Cloudflare deployment stay unchanged.
- This trial covers notes, essays, reviews, links, videos, podcasts, talks, and
  embedded image uploads. Projects remain in the existing workflow.
- Links use ordinary URLs. CMS document relationships and internal-link selectors
  are disabled until a public routing and publication workflow exists for them.
- The database, credentials, and uploads live in ignored `.local/` storage.
  API content, versions, media, and previews require a login.
- Both servers bind to loopback by default, with opt-in LAN access for testing.
  This is not a hosted CMS. Do not expose it through a tunnel or deploy its development server.
- Stopping the command leaves your local content intact. Use `npm run dev` for
  the original website workflow; switching back requires no content migration.

## What Is Not Wired Yet

- Publishing, unpublishing, and restoring versions affect only this local CMS.
  They do not regenerate public pages, search, RSS, sitemaps, or Markdown exports.
- There is no production host, R2 upload adapter, backup schedule, remote private
  preview, scheduled publishing worker, or multi-editor approval workflow.
- Media stays local and private. Uploads are not automatically migrated from
  Notion or copied to the public CDN. PDF previews work with uploaded PDFs;
  externally hosted PDFs still require that server to allow browser access.
- A local laptop is not a phone publishing service. Remote authoring needs an
  authenticated hosted editor with durable storage, not an exposed dev server.
- Payload adds a server, database, updates, and backup responsibilities. The
  public site can remain static and fast, but a CMS does not remove the need for
  a validated publishing step.
- Back up the local database before changing collection fields. Development
  schema synchronization is not a production migration strategy; production
  needs reviewed migrations and tested backup restoration.

The trial uses Payload's native [autosave](https://payloadcms.com/docs/versions/autosave),
[versions](https://payloadcms.com/docs/versions/overview), and
[server-side live preview](https://payloadcms.com/docs/live-preview/server),
rather than maintaining a separate editor or revision system.

## Checks

`npm run quality -w @amaral.codes/cms` checks the CMS logic. With the trial
stopped, `npm run test:browser -w @amaral.codes/cms` starts isolated test servers
and uses `.local/test/`, which is reset on each run. It never resets `.local/cms.db`.
Set `CMS_TRIAL_HOST=<your-Mac-LAN-IP>` on that test command to exercise LAN HTTPS
in WebKit, including login, live preview, media, and mobile layouts. The default
loopback run uses Chromium. Only the browser test accepts untrusted certificates;
the preview server trusts the exact generated certificate.

Before replacing the existing publisher, this still needs a production host,
object storage, backups, an authenticated remote preview, and a validated static
publication/export path. The current prototype intentionally provisions none of
those services. The public website does not call Payload at runtime.

import Link from 'next/link'

export function TrialOverview() {
  return (
    <section className="trial-overview" aria-label="Writing workspace">
      <h1>Your writing desk</h1>
      <nav aria-label="Writing actions">
        <Link href="/admin/collections/entries/create">Write a note</Link>
        <Link href="/admin/collections/entries">Continue a draft</Link>
        <Link href="/admin/collections/media">Browse media</Link>
      </nav>
      <details>
        <summary>What can I try here?</summary>
        <p>
          Edit the example drafts or start a new note. Changes autosave privately.
          Live Preview shows the article beside the editor, with phone, tablet,
          and desktop sizes. Versions lets you compare and restore saved revisions.
        </p>
        <p>
          Choose Podcast or Talk to attach audio, slides, recordings, and original-source links.
          Images, PDFs, and MP3s belong in Media and can be reused across entries.
        </p>
        <p>
          Publishing and unpublishing affect this local trial only. The live website,
          search, and feeds still use the existing publisher. This editor is available
          on this computer; remote access, production storage, scheduled publishing,
          and deployment are not connected yet.
        </p>
      </details>
    </section>
  )
}

import type {
  DocumentExporter,
  DocumentMaterializer,
  DocumentReader,
  DocumentWriter,
} from './ports.ts'
import type { ContentIdentity } from '../domain/content/index.ts'

interface DocumentExporterDependencies<TSource> {
  resolveDestination: (root: string, identity: ContentIdentity) => string
  materializer: DocumentMaterializer<TSource>
  reader: DocumentReader<TSource>
  writer: DocumentWriter
}

export function createDocumentExporter<TSource>(
  dependencies: DocumentExporterDependencies<TSource>,
): DocumentExporter<TSource, string> {
  return {
    export: async ({ identity, scope, source }) => {
      const documentDirectory = dependencies.resolveDestination(scope, identity)
      const markdown = await dependencies.reader.read(source)
      const content = await dependencies.materializer.materialize(
        markdown,
        documentDirectory,
        source,
      )

      await dependencies.writer.write(documentDirectory, {
        content,
        metadata: identity.metadata,
        slug: identity.slug,
      })
    },
  }
}

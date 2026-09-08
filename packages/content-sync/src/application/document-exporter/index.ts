import type {
  DocumentDestinationResolver,
  DocumentExporter,
  DocumentMaterializer,
  DocumentReader,
  DocumentWriter,
} from '../ports.ts'

interface DocumentExporterDependencies<TSource> {
  destinations: DocumentDestinationResolver
  materializer: DocumentMaterializer<TSource>
  reader: DocumentReader<TSource>
  writer: DocumentWriter
}

export function createDocumentExporter<TSource>(
  dependencies: DocumentExporterDependencies<TSource>,
): DocumentExporter<TSource, string> {
  return {
    export: async ({ identity, scope, source }) => {
      const documentDirectory = dependencies.destinations.resolve(scope, identity)
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

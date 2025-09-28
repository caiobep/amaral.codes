import path from 'node:path'
import type { Blogpost } from '../../domain/blogpost.ts'
import {
  createBlogpostFileWriter,
  type BlogpostFileWriterOptions,
} from '../../adapters/filesystem/use-cases/index.ts'
import {
  createNotionMarkdownExporter,
  getTagNameAndIcon,
} from '../../adapters/notion-api/use-cases/index.ts'
import {
  embedToIframeProcessor,
  bookmarkToInlineLinkMentionProcessor,
  imageToDownloadedWebpProcessor,
  imageUrlProcessor,
  videoToIFrameProcessor,
} from '../../adapters/notion-block-to-md/index.ts'
import type { GetAllBlogpostPageMetadataReturn } from '../../adapters/notion-api/use-cases/getBlogPosts/getBlogPosts.ts'
import type { BlockTransformer } from '../../adapters/notion-block-to-md/types.ts'
import type { BlockType } from 'notion-to-md/build/types'

export type PageExportInput = GetAllBlogpostPageMetadataReturn

export type ExportPagesOptions = {
  destinationPath?: string
  cleanDestination?: boolean
  writerOptions?: BlogpostFileWriterOptions
  writeToFs?: boolean
}

export type ExportPagesDependencies = {
  createFileWriter?: typeof createBlogpostFileWriter
  createMarkdownExporter?: typeof createNotionMarkdownExporter
  getTagNameAndIcon?: typeof getTagNameAndIcon
  createProcessors?: (
    params: {
      imageDir?: string
      writeToFs: boolean
    },
  ) => Partial<Record<BlockType, BlockTransformer>>
}

const defaultDependencies: Required<ExportPagesDependencies> = {
  createFileWriter: createBlogpostFileWriter,
  createMarkdownExporter: createNotionMarkdownExporter,
  getTagNameAndIcon,
  createProcessors: ({ imageDir, writeToFs }) => {
    const processors: Partial<Record<BlockType, BlockTransformer>> = {
      embed: embedToIframeProcessor,
      video: videoToIFrameProcessor,
      bookmark: bookmarkToInlineLinkMentionProcessor,
    }

    if (writeToFs) {
      if (!imageDir) {
        throw new Error('imageDir is required when writing to the filesystem')
      }
      processors.image = imageToDownloadedWebpProcessor(imageDir)
    } else {
      processors.image = imageUrlProcessor
    }

    return processors
  },
}

export async function exportPagesToMarkdown(
  pages: PageExportInput[],
  options: ExportPagesOptions,
  dependencies: ExportPagesDependencies = {},
): Promise<Blogpost[]> {
  const {
    destinationPath,
    cleanDestination = true,
    writerOptions,
    writeToFs = true,
  } = options
  if (writeToFs && !destinationPath) {
    throw new Error('destinationPath is required when writeToFs is enabled')
  }

  if (!pages.length) {
    console.warn('No pages to export')
    return []
  }

  const {
    createFileWriter,
    createMarkdownExporter,
    createProcessors,
    getTagNameAndIcon: getTag,
  } = { ...defaultDependencies, ...dependencies }

  let writeBlogpostFile: ((blogpost: Blogpost) => Promise<void>) | undefined
  if (writeToFs) {
    writeBlogpostFile = await createFileWriter(destinationPath!, {
      clean: cleanDestination,
      ...writerOptions,
    })
  }
  const imageDownloadDir =
    writeToFs && destinationPath
      ? path.join(destinationPath, 'images')
      : undefined
  const getPageContentInMd = await createMarkdownExporter(
    createProcessors({ imageDir: imageDownloadDir, writeToFs }),
  )

  const tasks = pages.map(page =>
    exportSinglePage(page, getPageContentInMd, writeBlogpostFile, getTag),
  )

  return Promise.all(tasks)
}

async function exportSinglePage(
  page: PageExportInput,
  getPageContentInMd: (pageId: string) => Promise<string>,
  writeBlogpostFile: ((blogpost: Blogpost) => Promise<void>) | undefined,
  getTag: typeof getTagNameAndIcon,
): Promise<Blogpost> {
  const { tagIds = [], ...pageMetadata } = page
  const tags = await Promise.all(tagIds.map(getTag))
  const content = await getPageContentInMd(page.id)
  const blogpost = { ...pageMetadata, tags, content }

  if (writeBlogpostFile) {
    try {
      await writeBlogpostFile(blogpost)
    } catch (err) {
      console.error(err)
    }
  }

  return blogpost
}

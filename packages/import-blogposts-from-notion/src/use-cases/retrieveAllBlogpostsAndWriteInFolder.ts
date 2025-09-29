import path from 'path'
import {
  createNotionMarkdownExporter,
  getAllBlogpostPageMetadata,
  getTagNameAndIcon,
} from '../adapters/notion-api/use-cases/index.ts'
import { createBlogpostFileWriter } from '../adapters/filesystem/use-cases/index.ts'
import { imageToDownloadedWebpProcessor, } from '../adapters/notion-block-to-md/index.ts'

/**
 * Fetch all blog posts from Notion and writes them as markdown files in a folder.
 * @param {string} destinationPath - The path to the folder where the markdown files will be written.
 **/
export async function retrieveAllBlogpostsAndWriteInFolder(
  destinationPath: string,
) {
  const blogpostPages = await getAllBlogpostPageMetadata()
  const writeBlogpostFile = await createBlogpostFileWriter(destinationPath)
  const imageDownloadDir = path.join(destinationPath, 'images')

  const getPageContentInMd = await createNotionMarkdownExporter({
    image: imageToDownloadedWebpProcessor(imageDownloadDir),
  })

  const tasks = blogpostPages.map(async page => {
    const { tagIds, ...pageMetadata } = page
    const tags = await Promise.all(tagIds.map(getTagNameAndIcon))
    const content = await getPageContentInMd(page.id)

    await writeBlogpostFile({ ...pageMetadata, tags, content }).catch(
      console.error,
    )
  })

  await Promise.all(tasks)
}

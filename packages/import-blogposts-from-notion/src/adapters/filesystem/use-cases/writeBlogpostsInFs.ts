import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import type { Blogpost } from '../../../domain/blogpost.ts'
import { getFsSafeNameFromStr } from '../mappers/index.ts'
import { renderRecordAsMarkdownWithMetadata } from '../../notion-block-to-md/index.ts'

export type BlogpostFileWriterOptions = {
  clean?: boolean
}

export async function createBlogpostFileWriter(
  directory: string,
  options: BlogpostFileWriterOptions = {},
): Promise<(blogpost: Blogpost) => ReturnType<typeof writeBlogpostInFs>> {
  const shouldClean = options.clean ?? true

  if (shouldClean) {
    const dirCleaningTime = performance.now()
    try {
      await fs.rm(directory, { recursive: true, force: true })
      await fs.mkdir(directory, { recursive: true })
    } catch (ex) {
      console.error(`Could not clean dir ${directory} \r\n ${ex}`)
    }
    console.log('Cleaning dir in: ', performance.now() - dirCleaningTime, 'ms')
  } else {
    await fs.mkdir(directory, { recursive: true })
  }

  await fs.mkdir(path.join(directory, 'images'), { recursive: true })

  return (blogpost: Blogpost) => writeBlogpostInFs(directory, blogpost)
}

export async function writeBlogpostInFs(
  directory: string,
  blogpost: Blogpost,
): Promise<void> {
  const fileName = getFsSafeNameFromStr(blogpost.title)

  const { title, content, ...metadata } = blogpost
  const fileContents = renderRecordAsMarkdownWithMetadata({
    header: title,
    content,
    metadata,
  })

  console.log('Writing file: ', fileName + ' to dir: ', directory)

  try {
    await fs.writeFile(path.join(directory, fileName), fileContents)
    console.log('Writing file: ', fileName + ' to dir: ', directory + ' [done]')
  } catch (ex) {
    throw new Error(`Could not write file ${fileName}. \r\n ${ex}`)
  }
}

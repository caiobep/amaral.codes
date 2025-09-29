import { Command } from 'commander'
import process from 'node:process'
import 'dotenv/config'
import { retrieveAllBlogpostsAndWriteInFolder } from '../../use-cases/retrieveAllBlogpostsAndWriteInFolder.ts'
import { retrieveNotionNoteInMarkdown } from '../../use-cases/retrieveNotionNoteInMarkdown.ts'

const program = new Command()

program
  .name('notion-utils')
  .description('A set of utilities for searching/exporting data from Notion')

program
  .command('export-blogposts')
  .arguments('[outputPath]')
  .option(
    '-o, --output-path <path>',
    'Target folder for exported markdown files',
  )
  .action(async (outputPathArg: string | undefined, command: Command) => {
    const { outputPath } = command.opts() as { outputPath?: string }
    const destination = (outputPathArg ?? outputPath)?.trim()

    if (!destination) {
      console.error(
        'Missing output directory. Pass it as an argument or with --output-path.',
      )
      process.exit(1)
      return
    }

    await retrieveAllBlogpostsAndWriteInFolder(destination)
  })

program
  .command('note')
  .arguments('[noteId]')
  .action(async (noteId: string) => {
    const noteContents = await retrieveNotionNoteInMarkdown(noteId)
    process.stdout.write(noteContents)
  })

program.parseAsync(process.argv).catch(err => {
  console.error(err)
  process.exit(1)
})

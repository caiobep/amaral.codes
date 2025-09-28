import { Command } from 'commander'
import process from 'node:process'
import 'dotenv/config'
import { retrieveAllBlogpostsAndWriteInFolder } from '../../use-cases/retrieveAllBlogpostsAndWriteInFolder.ts'

const program = new Command()

program
  .name('notion-utils')
  .description('A set of utilities for searching/exporting data from Notion')
  .arguments('[outputPath]')
  .option('-o, --output-path <path>', 'Target folder for exported markdown files')
  .action(async (outputPathArg: string | undefined, command: Command) => {
    const { outputPath } = command.opts<{ outputPath?: string }>()
    const destination = (outputPathArg ?? outputPath)?.trim()

    if (!destination) {
      console.error('Missing output directory. Pass it as an argument or with --output-path.')
      process.exit(1)
      return
    }

    await retrieveAllBlogpostsAndWriteInFolder(destination)
  })

program.parseAsync(process.argv).catch(err => {
  console.error(err)
  process.exit(1)
})

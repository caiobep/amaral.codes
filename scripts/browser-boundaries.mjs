import fs from 'node:fs/promises'
import { builtinModules } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const NODE_BUILTINS = new Set(builtinModules.flatMap(name => [name, `node:${name}`]))

export async function findBrowserBoundaryViolations(websiteRoot) {
  const repositoryRoot = path.dirname(path.dirname(websiteRoot))
  const sourceRoot = path.join(websiteRoot, 'src')
  const files = await listFiles(sourceRoot)
  const roots = files.filter(file => isBrowserRoot(file, sourceRoot))
  const astroSources = new Map(await Promise.all(files
    .filter(file => file.endsWith('.astro'))
    .map(async file => [file, extractAstroScripts(await fs.readFile(file, 'utf8'))])))
  roots.push(...[...astroSources].filter(([, source]) => source.trim()).map(([file]) => file))

  const compilerOptions = loadCompilerOptions(websiteRoot)
  const sourceCache = new Map(astroSources)
  const failures = []

  for (const root of roots.sort()) {
    await walkBrowserDependencies({
      chain: [root],
      compilerOptions,
      failures,
      repositoryRoot,
      sourceCache,
      sourceRoot,
      websiteRoot,
    })
  }

  return [...new Set(failures)].sort()
}

async function walkBrowserDependencies(context) {
  const file = context.chain.at(-1)
  if (!file || context.chain.slice(0, -1).includes(file)) return
  const source = await readSource(file, context.sourceCache)

  for (const specifier of readRuntimeImports(file, source)) {
    const forbidden = describeForbiddenSpecifier(specifier)
    if (forbidden) {
      context.failures.push(formatViolation(context.chain, specifier, forbidden, context.websiteRoot))
      continue
    }

    const resolved = resolveRepoImport(specifier, file, context.compilerOptions, context.repositoryRoot)
    if (!resolved) continue
    const forbiddenFile = describeForbiddenFile(resolved, context.sourceRoot, context.repositoryRoot)
    if (forbiddenFile) {
      context.failures.push(formatViolation([...context.chain, resolved], undefined, forbiddenFile, context.websiteRoot))
      continue
    }
    await walkBrowserDependencies({ ...context, chain: [...context.chain, resolved] })
  }
}

function readRuntimeImports(file, source) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const imports = []

  function visit(node) {
    if (ts.isImportDeclaration(node) && !isTypeOnlyImport(node)) {
      addModuleSpecifier(imports, node.moduleSpecifier)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && !isTypeOnlyExport(node)) {
      addModuleSpecifier(imports, node.moduleSpecifier)
    } else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1) {
      addModuleSpecifier(imports, node.arguments[0])
    } else if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require'
      && node.arguments.length === 1) {
      addModuleSpecifier(imports, node.arguments[0])
    } else if (ts.isImportEqualsDeclaration(node)
      && !node.isTypeOnly
      && ts.isExternalModuleReference(node.moduleReference)) {
      addModuleSpecifier(imports, node.moduleReference.expression)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return imports
}

function isTypeOnlyImport(node) {
  const clause = node.importClause
  if (!clause) return false
  if (clause.isTypeOnly) return true
  const bindings = clause.namedBindings
  return !clause.name
    && ts.isNamedImports(bindings)
    && bindings.elements.length > 0
    && bindings.elements.every(element => element.isTypeOnly)
}

function isTypeOnlyExport(node) {
  if (node.isTypeOnly) return true
  return Boolean(node.exportClause)
    && ts.isNamedExports(node.exportClause)
    && node.exportClause.elements.length > 0
    && node.exportClause.elements.every(element => element.isTypeOnly)
}

function addModuleSpecifier(imports, node) {
  if (node && ts.isStringLiteralLike(node)) imports.push(node.text)
}

function resolveRepoImport(specifier, importer, compilerOptions, repositoryRoot) {
  const resolved = ts.resolveModuleName(specifier, importer, compilerOptions, ts.sys)
    .resolvedModule?.resolvedFileName
  if (!resolved) return undefined
  const repositoryPath = resolved.includes(`${path.sep}node_modules${path.sep}`) && ts.sys.realpath
    ? ts.sys.realpath(resolved)
    : resolved
  if (repositoryPath.includes(`${path.sep}node_modules${path.sep}`)) return undefined
  return isInside(repositoryPath, repositoryRoot) ? repositoryPath : undefined
}

function describeForbiddenSpecifier(specifier) {
  if (NODE_BUILTINS.has(specifier)) return 'Node built-in modules are server-only'
  if (specifier === 'astro:content') return 'astro:content is build-time only'
  if (specifier === '@amaral.codes/content-contract') {
    return 'content-contract metadata and schema validation are build-time only'
  }
  if (specifier === '@amaral.codes/content-sync' || specifier.startsWith('@amaral.codes/content-sync/')) {
    return 'content-sync is server-only'
  }
  return undefined
}

function describeForbiddenFile(file, sourceRoot, repositoryRoot) {
  const relative = toPosix(path.relative(sourceRoot, file))
  if (relative === 'content/schemas/index.ts' || relative.startsWith('content/schemas/')) {
    return 'content schemas are build-time only'
  }
  if (relative === 'lib/content.ts' || relative.startsWith('lib/content/')) {
    return 'lib/content is build-time only'
  }
  if (relative === 'lib/search/documents.ts') return 'search documents are build-time only'
  const repositoryRelative = toPosix(path.relative(repositoryRoot, file))
  if (repositoryRelative === 'packages/content-sync/src/index.ts'
    || repositoryRelative.startsWith('packages/content-sync/src/')) {
    return 'content-sync is server-only'
  }
  if (repositoryRelative === 'packages/content-contract/src/metadata/index.ts'
    || repositoryRelative.startsWith('packages/content-contract/src/metadata/')) {
    return 'content-contract metadata and schema validation are build-time only'
  }
  return undefined
}

function formatViolation(chain, specifier, reason, websiteRoot) {
  const displayChain = chain.map(file => toPosix(path.relative(websiteRoot, file)))
  if (specifier) displayChain.push(specifier)
  return `browser import chain ${displayChain.join(' -> ')}: ${reason}`
}

function isBrowserRoot(file, sourceRoot) {
  if (!SOURCE_EXTENSIONS.has(path.extname(file)) || isTestFile(file)) return false
  const relative = toPosix(path.relative(sourceRoot, file))
  return relative.startsWith('scripts/') || (relative.startsWith('features/') && file.endsWith('.client.ts'))
}

function isTestFile(file) {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(file)
}

function extractAstroScripts(source) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)]
    .filter(([, attributes]) => !/\btype\s*=\s*["']application\/ld\+json["']/iu.test(attributes))
    .map(([, attributes, body]) => {
      const sourceAttribute = /\bsrc\s*=\s*["']([^"']+)["']/iu.exec(attributes)?.[1]
      return sourceAttribute ? `import ${JSON.stringify(sourceAttribute)}\n${body}` : body
    })
    .join('\n')
}

function loadCompilerOptions(websiteRoot) {
  const configPath = ts.findConfigFile(websiteRoot, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) return { allowJs: true, moduleResolution: ts.ModuleResolutionKind.Bundler }
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  return ts.parseJsonConfigFileContent(config.config, ts.sys, websiteRoot).options
}

async function readSource(file, cache) {
  if (!cache.has(file)) cache.set(file, await fs.readFile(file, 'utf8'))
  return cache.get(file)
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : [target]
  }))
  return nested.flat()
}

function isInside(file, directory) {
  const relative = path.relative(directory, file)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}

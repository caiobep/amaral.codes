import path from 'node:path'
import ts from 'typescript'

const FORBIDDEN_INNER_IMPORTS = /^(?:node:|astro(?:\/|$)|@astrojs\/|@notionhq\/)/
const DEPENDENCY_GROUPS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

export function collectModuleSpecifiers(source, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const specifiers = []

  function visit(node) {
    const declarationSpecifier = getDeclarationSpecifier(node)
    if (declarationSpecifier) specifiers.push(declarationSpecifier)

    const callSpecifier = getCallSpecifier(node)
    if (callSpecifier) specifiers.push(callSpecifier)

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

export function findPipelineDependencyViolations(file, source, roots) {
  const specifiers = collectModuleSpecifiers(source, file)
  if (isInside(file, roots.domainRoot)) {
    return specifiers
      .filter(specifier => isOuterDomainDependency(specifier))
      .map(specifier => `cannot depend on outer layer ${specifier}.`)
  }
  if (isInside(file, roots.applicationRoot)) {
    return specifiers
      .filter(specifier => specifier.includes('adapters') || FORBIDDEN_INNER_IMPORTS.test(specifier))
      .map(specifier => `cannot depend on adapter ${specifier}.`)
  }
  if (!isInside(file, roots.adapterRoot)) return []
  return findSiblingAdapterImports(file, specifiers, roots.adapterRoot)
    .map(specifier => `cannot import sibling adapter ${specifier}. Wire it in composition-root/index.ts.`)
}

export function findWorkspaceDependencyViolations(
  packageName,
  manifest,
  dependencyPolicy,
) {
  const allowedDependencies = dependencyPolicy[packageName]
  if (!allowedDependencies) {
    return [`${packageName} has no workspace dependency policy.`]
  }

  const workspaceNames = new Set(Object.keys(dependencyPolicy))
  const internalDependencies = new Set(DEPENDENCY_GROUPS.flatMap(group => (
    Object.keys(manifest[group] ?? {}).filter(name => workspaceNames.has(name))
  )))

  return [...internalDependencies]
    .filter(name => !allowedDependencies.includes(name))
    .map(name => `${packageName} cannot depend on ${name}.`)
}

function getDeclarationSpecifier(node) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
    && node.moduleSpecifier
    && ts.isStringLiteralLike(node.moduleSpecifier)) {
    return node.moduleSpecifier.text
  }
  if (ts.isImportEqualsDeclaration(node)
    && ts.isExternalModuleReference(node.moduleReference)
    && node.moduleReference.expression
    && ts.isStringLiteralLike(node.moduleReference.expression)) {
    return node.moduleReference.expression.text
  }
  return undefined
}

function getCallSpecifier(node) {
  if (!ts.isCallExpression(node)) return undefined
  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
  const [argument] = node.arguments
  return (isDynamicImport || isRequire) && argument && ts.isStringLiteralLike(argument)
    ? argument.text
    : undefined
}

function isOuterDomainDependency(specifier) {
  return specifier.includes('application')
    || specifier.includes('adapters')
    || FORBIDDEN_INNER_IMPORTS.test(specifier)
}

function findSiblingAdapterImports(file, specifiers, adapterRoot) {
  const currentAdapter = path.relative(adapterRoot, file).split(path.sep)[0]
  return specifiers
    .filter(specifier => specifier.startsWith('.'))
    .filter((specifier) => {
      const target = path.resolve(path.dirname(file), specifier)
      if (!isInside(target, adapterRoot)) return false
      return path.relative(adapterRoot, target).split(path.sep)[0] !== currentAdapter
    })
}

function isInside(file, directory) {
  const relative = path.relative(directory, file)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..'
}

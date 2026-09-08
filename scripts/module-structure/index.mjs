import ts from 'typescript'

export const MAX_TOP_LEVEL_FUNCTIONS = 24

export function findModuleStructureViolations(
  modules,
  maximumFunctions = MAX_TOP_LEVEL_FUNCTIONS,
) {
  return modules.flatMap(({ filePath, source }) => {
    const functionCount = countTopLevelFunctions(filePath, source)
    return functionCount > maximumFunctions
      ? [{ filePath, functionCount, maximumFunctions }]
      : []
  })
}

export function countTopLevelFunctions(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  )
  let functionCount = 0

  sourceFile.forEachChild(node => {
    if (isTopLevelFunction(node)) functionCount += 1
    if (!ts.isVariableStatement(node)) return
    functionCount += node.declarationList.declarations
      .filter(isFunctionVariable)
      .length
  })

  return functionCount
}

function isTopLevelFunction(node) {
  return ts.isFunctionDeclaration(node)
    || (ts.isExportAssignment(node) && isFunctionExpression(node.expression))
}

function isFunctionVariable(declaration) {
  return declaration.initializer !== undefined
    && isFunctionExpression(declaration.initializer)
}

function isFunctionExpression(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
}

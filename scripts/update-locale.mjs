import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Converter } from 'opencc-js/cn2t'
import ts from 'typescript'
import { createTaiwanTranslator } from '../plugin/taiwan-text.mjs'

const upstream = process.argv[2]
if (!upstream) {
  console.error('用法：npm run update-locale -- <上游原始碼目錄>')
  process.exit(1)
}

const sourceFiles = globSync('packages/*/*/src/**/*.{ts,tsx}', { cwd: upstream })
  .map(file => resolve(upstream, file))
  .filter(file => /\blocale\.register\(/.test(readFileSync(file, 'utf8')))
const program = ts.createProgram(sourceFiles, {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  jsx: ts.JsxEmit.Preserve,
  allowImportingTsExtensions: true,
  noLib: true,
  noEmit: true,
  types: [],
  paths: {
    '@deepseek-ai/dsh-commands/builtin': [resolve(upstream, 'packages/interaction/commands/src/builtin.ts')],
  },
})
const checker = program.getTypeChecker()

// Read upstream dictionary literals without running any upstream modules.
function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isIdentifier(node)) {
    const parent = node.parent
    let symbol = ts.isShorthandPropertyAssignment(parent)
      ? checker.getShorthandAssignmentValueSymbol(parent)
      : checker.getSymbolAtLocation(node)
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
    const declaration = symbol?.valueDeclaration
    if (declaration?.initializer) return literal(declaration.initializer)
  }
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return literal(node.expression)
  }
  if (ts.isPropertyAccessExpression(node)) return literal(node.expression)[node.name.text]
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) {
    const entries = Object.create(null)
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        Object.assign(entries, literal(property.expression))
      } else if (ts.isPropertyAssignment(property)) {
        const name = ts.isComputedPropertyName(property.name) ? literal(property.name.expression) : property.name.text
        entries[name] = literal(property.initializer)
      } else if (ts.isShorthandPropertyAssignment(property)) {
        entries[property.name.text] = literal(property.name)
      } else {
        throw new Error(`無法讀取字典屬性 ${property.getText()}`)
      }
    }
    return entries
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return literal(node.left) + literal(node.right)
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'join') {
    return literal(node.expression.expression).join(node.arguments.length ? literal(node.arguments[0]) : ',')
  }
  throw new Error(`無法讀取 ${node.getSourceFile().fileName} 的字典值 ${node.getText()}`)
}

const translate = createTaiwanTranslator(Converter)
const overrides = JSON.parse(readFileSync(new URL('../plugin/locale-overrides.json', import.meta.url), 'utf8'))

const dictionaries = new Map()
function collect(node) {
  if (ts.isCallExpression(node) && /\blocale\.register$/.test(node.expression.getText())) {
    const [namespaceArg, dictionaryArg, entryArg] = node.arguments
    const namespace = literal(namespaceArg)
    let chinese
    let english
    if (entryArg) {
      // The directory browser registers each language from a local tuple array.
      let loop = node.parent
      while (loop && !ts.isForOfStatement(loop)) loop = loop.parent
      if (!loop) throw new Error(`無法讀取 ${namespace} 的語言清單`)
      chinese = literal(loop.expression).find(([language]) => language === 'zh')?.[1]
    } else {
      ({ zh: chinese, en: english } = literal(dictionaryArg))
    }
    if (!chinese || dictionaries.has(namespace)) throw new Error(`缺少或重複的字典：${namespace}`)
    dictionaries.set(namespace, Object.fromEntries(
      Object.entries(chinese).map(([key, value]) => [
        key, namespace === 'command' && key.startsWith('token.') ? english[key] : translate(value),
      ]),
    ))
  }
  ts.forEachChild(node, collect)
}

for (const file of sourceFiles) collect(program.getSourceFile(file))
if (!dictionaries.has('common') || !dictionaries.has('settings.locale')) {
  throw new Error('找不到上游共用詞庫')
}
for (const [namespace, entries] of Object.entries(overrides)) {
  const dictionary = dictionaries.get(namespace)
  for (const [key, value] of Object.entries(entries)) {
    if (!Object.hasOwn(dictionary ?? {}, key)) throw new Error(`未知的字典鍵：${namespace}.${key}`)
    dictionary[key] = value
  }
}
const sorted = Object.fromEntries([...dictionaries].sort(([a], [b]) => a.localeCompare(b, 'en')))
writeFileSync(new URL('../plugin/zh-Hant.json', import.meta.url), JSON.stringify(sorted, null, 2) + '\n')
const count = [...dictionaries.values()].reduce((sum, entries) => sum + Object.keys(entries).length, 0)
console.log(`已產生 ${dictionaries.size} 組繁體中文詞庫，共 ${count} 條介面文字。`)

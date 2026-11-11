import { Converter } from 'opencc-js/cn2t'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { createTaiwanTranslator, hasHan } from './taiwan-text.mjs'

const translate = createTaiwanTranslator(Converter)

export function translateMarkdown(markdown) {
  if (!hasHan(markdown)) return markdown
  const edits = []
  function addEdit(start, end) {
    const source = markdown.slice(start, end)
    const translated = translate(source)
    if (source !== translated) edits.push({ start, end, translated })
  }
  function visit(node) {
    if (node.type === 'text' && hasHan(node.value)) {
      const { start, end } = node.position
      addEdit(start.offset, end.offset)
    }
    if ((node.type === 'image' || (node.type === 'imageReference' && node.referenceType === 'full')) && hasHan(node.alt)) {
      const { start, end } = node.position
      const label = /^!\[((?:\\.|[^\[\]\\])*)\]/u.exec(markdown.slice(start.offset, end.offset))?.[1]
      if (label !== undefined) addEdit(start.offset + 2, start.offset + 2 + label.length)
    }
    // A shortcut or collapsed reference uses its visible label as the link ID.
    if (node.type === 'linkReference' && node.referenceType !== 'full') return
    for (const child of node.children ?? []) visit(child)
  }
  visit(fromMarkdown(markdown))

  let result = ''
  let offset = 0
  for (const edit of edits) {
    result += markdown.slice(offset, edit.start) + edit.translated
    offset = edit.end
  }
  return result + markdown.slice(offset)
}

export function localizePluginDocuments(service, method, languageIndex) {
  const original = service[method]
  const previous = Object.getOwnPropertyDescriptor(service, method)
  async function readDetail(...args) {
    const detail = await original.apply(this, args)
    const language = args[languageIndex]
    if (typeof language !== 'string' || language.toLowerCase() !== 'zh-hant' || detail.status !== 'found') return detail
    return { ...detail, markdown: translateMarkdown(detail.markdown) }
  }
  service[method] = readDetail
  return () => {
    if (service[method] !== readDetail) return
    if (previous) Object.defineProperty(service, method, previous)
    else delete service[method]
  }
}

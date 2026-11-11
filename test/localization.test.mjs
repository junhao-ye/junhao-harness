import assert from 'node:assert/strict'
import test from 'node:test'
import { Converter } from 'opencc-js/cn2t'
import { localizePluginDocuments, translateMarkdown } from '../plugin/plugin-documents.mjs'
import { createTaiwanTranslator, localizeMetadata } from '../plugin/taiwan-text.mjs'

const translate = createTaiwanTranslator(Converter)

test('外掛名稱及摘要使用台灣詞彙，保留既有繁體翻譯', () => {
  const original = text => typeof text === 'string' ? text : text.en
  let active = 'zh-Hant'
  const locale = { resolveText: original, getLocale: () => ({ active }) }
  const dispose = localizeMetadata(locale, translate)

  assert.equal(locale.resolveText({ en: 'Voice recognition', zh: '语音识别插件' }), '語音辨識外掛')
  assert.equal(locale.resolveText({ en: 'Permission', 'zh-cn': '权限' }), '權限')
  assert.equal(locale.resolveText({ en: 'Terminal', zh: '终端', 'zh-tw': '終端介面' }), '終端介面')
  assert.equal(locale.resolveText({ en: 'Terminal', 'zh-hant': '終端工具', 'zh-tw': '終端介面' }), '終端工具')
  assert.equal(locale.resolveText({ en: 'Terminal' }), 'Terminal')
  assert.equal(locale.resolveText('安装源 {registry}，请检查 `安装路径`'), '安裝來源 {registry}，請檢查 `安装路径`')

  active = 'en'
  assert.equal(locale.resolveText({ en: 'Voice recognition', zh: '语音识别插件' }), 'Voice recognition')
  dispose()
  assert.equal(locale.resolveText, original)
})

test('詳細說明保留 Markdown 的程式碼、連結目的地和參照 ID', () => {
  const source = [
    '# 配置插件权限',
    '',
    '[打开设置](https://example.com/设置(插件)) 或使用 `插件.配置`。',
    '',
    '![语音识别设置](./语音识别.png)',
    '',
    '[终端说明][文档]，以及 [安装方法][]。',
    '',
    '[文档]: ./文档.md',
    '[安装方法]: ./安装方法.md',
    '',
    '```sh',
    'echo "配置插件"',
    '```',
  ].join('\n')
  const expected = source
    .replace('# 配置插件权限', '# 設定外掛權限')
    .replace('[打开设置]', '[開啟設定]')
    .replace('![语音识别设置]', '![語音辨識設定]')
    .replace('[终端说明]', '[終端機說明]')
  assert.equal(translateMarkdown(source), expected)
  assert.equal(translateMarkdown('Configure an API Key'), 'Configure an API Key')
})

test('詳細說明只在繁體中文模式轉換，保留上游檔案資訊', async () => {
  const source = { status: 'found', path: 'docs/详情.md', markdown: '配置插件权限' }
  const service = { readDetail: async () => source }
  const dispose = localizePluginDocuments(service, 'readDetail', 1)

  assert.deepEqual(await service.readDetail('package', 'zh-Hant'), { ...source, markdown: '設定外掛權限' })
  assert.equal(await service.readDetail('package', 'zh'), source)
  dispose()
  assert.equal(await service.readDetail('package', 'zh-Hant'), source)
})

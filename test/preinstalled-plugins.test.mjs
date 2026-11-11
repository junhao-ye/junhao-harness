import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { initProfile } from '@deepseek-ai/dsh-app-boot'
import { Converter } from 'opencc-js/cn2t'
import { createBundledPluginTranslator, localizeGuizangCatalog } from '../plugin/bundled-plugin-text.mjs'
import { preparePreinstalledPlugins } from '../scripts/preinstalled-plugins.mjs'

const webBundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']
const media = 'dsh-media-desk'
const guizang = 'dsh-guizang-design'

async function testProfile(t) {
  const home = await mkdtemp(join(tmpdir(), 'junhao-plugins-'))
  t.after(() => rm(home, { force: true, recursive: true }))
  const profile = join(home, 'profiles', 'web')
  const manifestPath = join(profile, 'package.json')
  return { home, profile, manifestPath, read: async () => JSON.parse(await readFile(manifestPath, 'utf8')) }
}

test('首次啟動預裝兩個外掛，之後保留停用或移除選擇', async t => {
  const { home, profile, manifestPath, read } = await testProfile(t)
  const launches = await Promise.allSettled([preparePreinstalledPlugins(home), preparePreinstalledPlugins(home)])
  for (const launch of launches) if (launch.status === 'rejected') throw launch.reason
  const manifest = await read()
  assert.deepEqual(manifest.dsh.profile.bundles, [...webBundles, media, guizang])
  for (const [name, dependency] of [[media, 'junhao-bundled-media-desk'], [guizang, 'junhao-bundled-guizang-design']]) {
    assert.match(manifest.dependencies[name], /^link:/)
    const directory = dirname(fileURLToPath(import.meta.resolve(`${dependency}/package.json`)))
    assert.equal(await realpath(join(profile, 'node_modules', name)), await realpath(directory))
  }

  manifest.dsh.profile.bundles = webBundles
  delete manifest.dependencies[guizang]
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf8')
  await preparePreinstalledPlugins(home)
  assert.deepEqual(await read(), manifest)
})

test('保留使用者自行安裝的外掛與 Web 設定', async t => {
  const { home, profile, manifestPath, read } = await testProfile(t)
  initProfile(profile, webBundles)
  const manifest = await read()
  manifest.dependencies[media] = '2.6.1'
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf8')
  const patch = join(profile, 'cordis.patch.yml')
  const settings = '# 既有的使用者設定\n[]\n'
  await writeFile(patch, settings, 'utf8')

  await preparePreinstalledPlugins(home)
  const updated = await read()
  assert.equal(updated.dependencies[media], '2.6.1')
  assert.deepEqual(updated.dsh.profile.bundles, [...webBundles, guizang])
  assert.equal(await readFile(patch, 'utf8'), settings)
})

test('自媒體工作台依請求語言翻譯提示，保留插入的使用者文字', async t => {
  const { home } = await testProfile(t)
  await preparePreinstalledPlugins(home)
  const mediaPackage = import.meta.resolve('junhao-bundled-media-desk/package.json')
  const { tr, withLang } = await import(new URL('src/i18n.js', mediaPackage))
  const render = () => tr('更新账号档案：{title}', { title: '我的标题' })
  assert.equal(withLang('zh-TW', render), '更新帳號資料：我的标题')
  assert.equal(withLang('zh-CN', render), '更新账号档案：我的标题')
  assert.equal(withLang('en-US', () => tr('文件不存在')), 'File not found')
  const { Settings } = await import(new URL('src/settings.js', mediaPackage))
  const settings = new Settings(home)
  await settings.update({ language: 'zh-Hant' })
  assert.equal((await settings.read()).language, 'zh-Hant')
})

test('自媒體工作台可切換範例語言並保留既有文字', async t => {
  const { home } = await testProfile(t)
  await preparePreinstalledPlugins(home)
  const mediaPackage = import.meta.resolve('junhao-bundled-media-desk/package.json')
  const { buildSeed, localizeSamples } = await import(new URL('src/seed.js', mediaPackage))
  const state = buildSeed(new Date(), 'zh')
  const savedDraft = { article: '我修改的简体草稿' }
  state.items[0].drafts = savedDraft
  const personalItem = { id: 'personal', title: '我自己的标题' }
  state.items.push(personalItem)
  const customizedStyle = '我的预设'
  state.styles[0].name = customizedStyle
  localizeSamples(state, 'zh-Hant')
  assert.equal(state.sampleLang, 'zh-Hant')
  assert.equal(state.accounts[0].handle, '範例帳號')
  assert.match(state.items[0].title, /賺錢/u)
  assert.equal(state.items[0].drafts.article, undefined)
  assert.equal(state.items.at(-1), personalItem)
  assert.equal(state.styles[0].name, customizedStyle)
  assert.equal(state.styles[0].source, '預設')
  localizeSamples(state, 'en')
  assert.equal(state.accounts[0].handle, 'Sample account')
  localizeSamples(state, 'zh')
  assert.deepEqual(state.items[0].drafts, savedDraft)
  assert.equal(state.accounts[0].handle, '示例账号')
})

test('歸藏設計翻譯內建目錄與草稿，保留作品資料與範例網址', () => {
  const translate = createBundledPluginTranslator(Converter)
  const catalog = {
    skills: [{ name: 'guizang-page-skill', title: '网页排版', starter: '/guizang-page-skill 帮我排成网页。' }],
    recipes: [{ title: '一篇文章，三种出口', summary: '内容生产工作流' }],
    examples: [{ title: '官方示例', url: '/guizang-design/examples/示例/index.html' }],
    works: [{ title: '我的标题' }],
    voice: { text: '我的写作习惯' },
  }
  const localized = localizeGuizangCatalog(catalog, translate)
  assert.deepEqual(localized.skills[0], { name: 'guizang-page-skill', title: '網頁排版', starter: '/guizang-page-skill 幫我排成網頁。' })
  assert.deepEqual(localized.recipes[0], { title: '一篇文章，三種呈現方式', summary: '內容製作流程' })
  assert.deepEqual(localized.examples[0], { title: '官方範例', url: catalog.examples[0].url })
  assert.equal(localized.works, catalog.works)
  assert.equal(localized.voice, catalog.voice)
})

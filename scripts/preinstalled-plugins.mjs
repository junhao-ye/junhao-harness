import { mkdir, readFile, realpath, symlink } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initProfile, readProfileManifest, resolveProfileDir } from '@deepseek-ai/dsh-app-boot'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { saveManifest } from '@deepseek-ai/dsh-plugin-manager/operations'

const bundles = [
  { name: 'dsh-media-desk', dependency: 'junhao-bundled-media-desk' },
  { name: 'dsh-guizang-design', dependency: 'junhao-bundled-guizang-design' },
]

function bundleDirectory(dependency) {
  return dirname(fileURLToPath(import.meta.resolve(`${dependency}/package.json`)))
}

async function linkBundle(directory, destination) {
  try {
    await symlink(directory, destination, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    // A previous startup can leave the link before the manifest is saved.
    if (await realpath(destination) !== await realpath(directory)) {
      throw new Error(`外掛路徑已被其他安裝占用：${destination}`, { cause: error })
    }
  }
}

async function patchFile(file, replacements) {
  const original = await readFile(file, 'utf8')
  let patched = original
  for (const [before, after] of replacements) {
    if (patched.includes(after)) continue
    if (patched.split(before).length !== 2) {
      throw new Error(`無法套用預裝外掛修正：${file}`)
    }
    patched = patched.replace(before, () => after)
  }
  if (original !== patched) await writeFileAtomic(file, patched, { mode: 0o644 })
}

async function patchMediaDesk() {
  const directory = bundleDirectory('junhao-bundled-media-desk')
  const localeDirectory = join(directory, 'src', 'junhao-locale')
  await mkdir(localeDirectory, { recursive: true })
  for (const name of ['taiwan-text.mjs', 'bundled-plugin-text.mjs']) {
    const source = await readFile(new URL(`../plugin/${name}`, import.meta.url), 'utf8')
    const destination = join(localeDirectory, name)
    const installed = await readFile(destination, 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
    if (source !== installed) await writeFileAtomic(destination, source, { mode: 0o644 })
  }

  await patchFile(join(directory, 'src', 'i18n.js'), [
    ["import { EN } from './en.js'", [
      "import { EN } from './en.js'",
      "import { Converter } from 'opencc-js/cn2t'",
      "import { createBundledPluginTranslator, normalizeBundledLanguage } from './junhao-locale/bundled-plugin-text.mjs'",
      'const junhaoTranslate = createBundledPluginTranslator(Converter)',
    ].join('\n')],
    ['const current = new AsyncLocalStorage()', 'export { junhaoTranslate }\n\nconst current = new AsyncLocalStorage()'],
    ["return String(value ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh'",
      "return normalizeBundledLanguage(value) ?? 'zh'"],
    ["const text = currentLang() === 'en' ? (EN[zh] ?? zh) : zh",
      "const lang = currentLang()\n  const text = lang === 'en' ? (EN[zh] ?? zh) : lang === 'zh-Hant' ? junhaoTranslate(zh) : zh"],
    ["return currentLang() === 'en' ? (PLATFORM_EN[platform] ?? platform) : platform",
      "const lang = currentLang()\n  if (lang === 'zh-Hant' && Object.hasOwn(PLATFORM_EN, platform)) return junhaoTranslate(platform)\n  return lang === 'en' ? (PLATFORM_EN[platform] ?? platform) : platform"],
  ])
  await patchFile(join(directory, 'src', 'settings.js'), [
    ["['auto', 'zh', 'en'].includes(patch.language)", "['auto', 'zh', 'zh-Hant', 'en'].includes(patch.language)"],
  ])
  // Upstream keeps a snapshot of its demo content in each supported language.
  await patchFile(join(directory, 'src', 'seed.js'), [
    ["import { currentLang, normalizeLang } from './i18n.js'", [
      "import { currentLang, junhaoTranslate, normalizeLang } from './i18n.js'",
      "import { translateBundledFields } from './junhao-locale/bundled-plugin-text.mjs'",
    ].join('\n')],
    ["return normalizeLang(lang) === 'en' ? localizeSamples(state, 'en') : state",
      "return normalizeLang(lang) === 'zh' ? state : localizeSamples(state, lang)"],
    ["const TABLES = { zh: textTables('zh'), en: textTables('en') }", [
      "const TABLES = { zh: textTables('zh'), en: textTables('en') }",
      "TABLES['zh-Hant'] = Object.fromEntries(Object.entries(TABLES.zh).map(([kind, rows]) => [",
      '  kind, Object.fromEntries(Object.entries(rows).map(([id, fields]) => [id, translateBundledFields(fields, junhaoTranslate)])),',
      ']))',
    ].join('\n')],
    ['[TABLES.zh.items[row.id], TABLES.en.items[row.id]]', 'Object.values(TABLES).map(table => table.items[row.id])'],
    ['[TABLES.zh[key][row.id], TABLES.en[key][row.id]]', 'Object.values(TABLES).map(table => table[key][row.id])'],
    ["[presetText(row.id, 'zh'), presetText(row.id, 'en')]", "Object.keys(TABLES).map(lang => presetText(row.id, lang))"],
  ])
  await patchFile(join(directory, 'src', 'style-presets.js'), [
    ['export const STYLE_CATEGORIES', [
      "import { junhaoTranslate } from './i18n.js'",
      "import { translateBundledFields } from './junhao-locale/bundled-plugin-text.mjs'",
      '',
      'export const STYLE_CATEGORIES',
    ].join('\n')],
    ['return Object.fromEntries(PRESET_TEXT_FIELDS.map(field => [field, text[field]]))', [
      'const fields = Object.fromEntries(PRESET_TEXT_FIELDS.map(field => [field, text[field]]))',
      "  return lang === 'zh-Hant' ? translateBundledFields(fields, junhaoTranslate) : fields",
    ].join('\n')],
    ["...(lang === 'en' ? presetText(row.id, 'en') : {})", '...presetText(row.id, lang)'],
  ])

  // The npm release ships a compiled client. Patch its existing language detector and string lookup.
  await patchFile(join(directory, 'dist', 'client.js'), [
    ['function jt(){return typeof document>"u"||(document.documentElement.lang||navigator.language||"zh").toLowerCase().startsWith("zh")?"zh":"en"}',
      'function jt(){if(typeof document>"u")return "zh";const lang=document.documentElement.lang||navigator.language||"zh";return /^zh-(?:hant|tw|hk|mo)(?:-|$)/i.test(lang)?"zh-Hant":/^zh(?:-|$)/i.test(lang)?"zh":"en"}'],
    ['let t=e==="zh"||e==="en"?e:"auto";', 'let t=e==="zh"||e==="zh-Hant"||e==="en"?e:"auto";'],
    ['function n(e,t){let o=W()==="en"?ze[e]??e:e;', [
      'let junhaoTranslate = text => text;',
      'function n(e,t){let o=W()==="en"?ze[e]??e:W()==="zh-Hant"&&Object.hasOwn(ze,e)?junhaoTranslate(e):e;',
    ].join('\n')],
    [String.raw`{value:"zh",label:()=>"\u4E2D\u6587"},{value:"en",label:()=>"English"}`,
      '{value:"zh-Hant",label:()=>"繁體中文"},{value:"zh",label:()=>W()==="zh-Hant"?"簡體中文":"简体中文"},{value:"en",label:()=>"English"}'],
    ['function ma(){se();', 'function ma(){const activeLanguage=se();'],
    ['M.default.useEffect(()=>{Re()},[])', 'M.default.useEffect(()=>{Re()},[activeLanguage])'],
    ['async function Re(){try{let e=await Q("settings");Ze(e.language);let t=await Q("state");C({settings:e,state:t.state,model:t.model,modelOk:t.modelOk,modelError:t.modelError,canUndo:t.canUndo,error:null})}catch(e){C({error:e.message})}}', [
      'let junhaoStateRequest = 0;',
      'async function Re(){',
      '  const request = ++junhaoStateRequest;',
      '  try {',
      '    const settings = await Q("settings");',
      '    if (request !== junhaoStateRequest) return;',
      '    Ze(settings.language);',
      '    const lang = W();',
      '    const state = await Q("state");',
      '    if (request !== junhaoStateRequest || lang !== W()) return;',
      '    C({settings,state:state.state,model:state.model,modelOk:state.modelOk,modelError:state.modelError,canUndo:state.canUndo,error:null});',
      '  } catch (error) {',
      '    if (request === junhaoStateRequest) C({error:error.message});',
      '  }',
      '}',
    ].join('\n')],
    ['function ha(e){e.slots.inject', [
      'async function ha(e){',
      '  const [{ Converter }, { createBundledPluginTranslator }] = await Promise.all([',
      '    import(new URL("junhao/opencc-cn2t.mjs", document.baseURI).href),',
      '    import(new URL("junhao/bundled-plugin-text.mjs", document.baseURI).href),',
      '  ]);',
      '  if (e.fiber.uid === null) return;',
      '  junhaoTranslate = createBundledPluginTranslator(Converter);',
      '  e.slots.inject',
    ].join('\n')],
  ])
}

async function patchGuizangDesign() {
  const directory = bundleDirectory('junhao-bundled-guizang-design')
  // The published routes access the host's work library and need Web authentication.
  await patchFile(join(directory, 'lib', 'index.js'), [
    ["export const inject = ['webServer', 'skills', 'tools']",
      "export const inject = ['webServer', 'skills', 'tools', 'connection']"],
    ['async handler(req, res) {', [
      'async handler(req, res) {',
      '        const rejection = ctx.connection.requestRejection({ headers: req.headers })',
      '        if (rejection !== undefined) return sendJson(res, rejection, { error: \'未登入或無法存取\' })',
    ].join('\n')],
  ])
  // Keep the sidebar label and iframe accessible when Junhao uses zh-Hant.
  await patchFile(join(directory, 'lib', 'client.js'), [
    ["const LABEL = { zh: '歸藏设计', en: 'Guizang Design' }",
      "const LABEL = { zh: '歸藏設計', 'zh-Hant': '歸藏設計', en: 'Guizang Design' }\n      const label = () => LABEL[lang] ?? LABEL.en"],
    ['title: LABEL[lang]', 'title: label()'],
    ['label: () => LABEL[lang] }, StudioIcon)', 'label }, StudioIcon)'],
  ])

  await patchFile(join(directory, 'gallery', 'index.html'), [
    ['<script src="i18n.js"></script>\n<link', '<!-- The app module loads the locale dictionary. -->\n<link'],
    ['<script src="app.js"></script>', '<script type="module" src="app.js"></script>'],
  ])
  await patchFile(join(directory, 'gallery', 'i18n.js'), [
    ['window.GZ_I18N = (() => {', [
      "import { Converter } from '../junhao/opencc-cn2t.mjs'",
      "import { createBundledPluginTranslator, normalizeBundledLanguage } from '../junhao/bundled-plugin-text.mjs'",
      'const translate = createBundledPluginTranslator(Converter)',
      'export { translate }',
      'export default (() => {',
    ].join('\n')],
    [String.raw`  const norm = (v) => (/^en\b/i.test(v || '') ? 'en' : /^zh\b/i.test(v || '') ? 'zh' : null)`, [
      "  STR['zh-Hant'] = Object.fromEntries(Object.entries(STR.zh).map(([key, text]) => [key, translate(text)]))",
      '  const norm = normalizeBundledLanguage',
    ].join('\n')],
    ["document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'",
      "document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang"],
  ])
  await patchFile(join(directory, 'gallery', 'app.js'), [
    ['const i18n = window.GZ_I18N', [
      "import i18n, { translate } from './i18n.js'",
      "import { localizeGuizangCatalog } from '../junhao/bundled-plugin-text.mjs'",
    ].join('\n')],
    ["toLocaleDateString('zh-CN',", 'toLocaleDateString(document.documentElement.lang,'],
    ['  data = await fetch(`api/catalog?lang=${i18n.lang}`, { cache: \'no-store\' }).then((r) => r.json())', [
      '  const lang = i18n.lang',
      "  const catalog = await fetch(`api/catalog?lang=${lang}`, { cache: 'no-store' }).then((r) => r.json())",
      '  if (lang !== i18n.lang) return',
      "  data = lang === 'zh-Hant' ? localizeGuizangCatalog(catalog, translate) : catalog",
    ].join('\n')],
  ])
}

export async function preparePreinstalledPlugins(home) {
  const profile = resolveProfileDir('web', home)
  await mkdir(profile, { recursive: true })
  await withFileLock(join(profile, 'package.json'), async () => {
    await patchMediaDesk()
    await patchGuizangDesign()
    initProfile(profile, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
    const manifest = readProfileManifest('dsh', profile)
    const preinstalled = new Set(manifest.junhao?.preinstalledBundles ?? [])
    const pending = bundles.filter(({ name }) => !preinstalled.has(name))
    if (pending.length === 0) return

    const dependencies = { ...manifest.dependencies }
    const enabled = [...(manifest.dsh?.profile?.bundles ?? [])]
    for (const { name, dependency } of pending) {
      // Defer to a user's existing installation and activation state.
      if (Object.hasOwn(dependencies, name) || enabled.includes(name)) continue
      const directory = bundleDirectory(dependency)
      const modules = join(profile, 'node_modules')
      await mkdir(modules, { recursive: true })
      await linkBundle(directory, join(modules, name))
      dependencies[name] = `link:${relative(profile, directory).split(sep).join('/')}`
      enabled.push(name)
    }

    // Save the installation record with the bundle selection, so a later removal stays removed.
    await saveManifest(profile, {
      ...manifest,
      dependencies,
      dsh: { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles: enabled } },
      junhao: { ...manifest.junhao, preinstalledBundles: [...preinstalled, ...pending.map(({ name }) => name)] },
    })
  })
}

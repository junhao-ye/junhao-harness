import { createTaiwanTranslator } from './taiwan-text.mjs'

const terms = [
  [/工作流(?!程)/gu, '工作流程'],
  ['內容生產工作流程', '內容製作流程'],
  ['語氣檔案', '寫作風格檔案'],
  ['作品庫', '作品集'],
  ['圖文卡片', '社群圖卡'],
  ['版式', '版型'],
  ['做同款', '沿用版型'],
  ['單檔案', '單一檔案'],
  ['頭圖', '橫幅封面'],
  ['全屏', '全螢幕'],
  ['粘貼', '貼上'],
  ['登錄', '登入'],
  ['帳號檔案', '帳號資料'],
  ['跟隨 DeepSeek Harness', '跟隨 Junhao Harness'],
  ['工作臺', '工作台'],
  ['介面地址', 'API 網址'],
  ['密鑰', '金鑰'],
  [/[覆復]盤/gu, '成效回顧'],
  ['排期', '排程'],
  ['成稿', '完稿'],
  ['接入', '串接'],
  ['帳號主頁', '帳號首頁'],
  ['一條資料', '一筆資料'],
  ['錄入', '輸入'],
  ['釋出之後', '發布後'],
  ['把資料錄進來', '輸入成效資料'],
  ['臺電腦', '台電腦'],
  ['生圖來源', '圖片來源'],
  ['生圖模型', '圖片生成模型'],
  ['生圖工具', '圖片生成工具'],
  ['生圖額度', '圖片生成額度'],
  ['生圖功能', '圖片生成功能'],
  ['生圖能力', '圖片生成功能'],
]

const wording = new Map([
  ['概覽', '總覽'],
  ['用一套設計做所有內容', '用同一套設計製作各種內容'],
  ['檢視全部', '查看全部'],
  ['一篇文章，三種出口', '一篇文章，三種呈現方式'],
  ['演講回收', '演講轉為文章'],
  ['先去 AI 味，再排版', '先潤飾 AI 文風，再排版'],
  ['去 AI 味', '潤飾 AI 文風'],
  ['封面矩陣', '多平台封面組合'],
  ['這裡就開始替你成效回顧。', '就能在這裡查看成效。'],
  ['抓我的帳號', '從我的帳號擷取內容'],
])

export function normalizeBundledLanguage(value) {
  if (/^zh-(?:hant|tw|hk|mo)(?:-|$)/i.test(value ?? '')) return 'zh-Hant'
  if (/^zh(?:-|$)/i.test(value ?? '')) return 'zh'
  if (/^en(?:-|$)/i.test(value ?? '')) return 'en'
  return null
}

export function createBundledPluginTranslator(Converter) {
  const translate = createTaiwanTranslator(Converter, terms)
  return text => {
    const converted = translate(text)
    return wording.get(converted) ?? converted
  }
}

export function translateBundledFields(fields, translate) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (typeof value === 'string') return [key, translate(value)]
    if (Array.isArray(value)) return [key, value.map(item => typeof item === 'string' ? translate(item) : item)]
    return [key, value]
  }))
}

export function localizeGuizangCatalog(catalog, translate) {
  function fields(entries, keys) {
    return entries.map(entry => {
      const result = { ...entry }
      for (const key of keys) {
        if (typeof entry[key] === 'string') result[key] = translate(entry[key])
      }
      return result
    })
  }
  return {
    ...catalog,
    skills: fields(catalog.skills, ['title', 'family', 'short', 'blurb', 'starter']),
    recipes: fields(catalog.recipes, ['title', 'summary', 'prompt']),
    examples: fields(catalog.examples, ['title', 'summary']),
  }
}

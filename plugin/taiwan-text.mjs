const terms = [
  ['插件', '外掛'],
  ['許可權', '權限'],
  ['默認', '預設'],
  ['輸入框', '輸入欄'],
  ['點擊', '點選'],
  ['配置', '設定'],
  ['運行', '執行'],
  ['全域性', '全域'],
  ['智慧體', 'Agent'],
  [/(\p{Script=Han})Agent/gu, '$1 Agent'],
  [/Agent(\p{Script=Han})/gu, 'Agent $1'],
  ['構建', '建置'],
  ['生成', '產生'],
  ['計劃', '計畫'],
  ['反饋', '回饋'],
  ['當前', '目前'],
  ['新建', '新增'],
  ['API Key', 'API 金鑰'],
  ['自定義', '自訂'],
  ['提供商', '供應商'],
  ['檢測', '偵測'],
  ['支持', '支援'],
  ['只讀', '唯讀'],
  ['賬戶', '帳戶'],
  ['賬號', '帳號'],
  ['登入會話', '登入工作階段'],
  ['瀏覽器會話', '瀏覽器工作階段'],
  ['終端會話', '終端機工作階段'],
  ['會話', '對話'],
  ['安裝源', '安裝來源'],
  ['外掛源', '外掛來源'],
  ['外掛發現頁面', '探索外掛頁面'],
  ['外掛發現介面', '探索外掛介面'],
  ['索引源', '索引來源'],
  ['備選源', '備援來源'],
  ['映象源', '鏡像來源'],
  ['映象', '映像'],
  ['服務端', '伺服器端'],
  ['客戶端', '用戶端'],
  ['語音識別', '語音辨識'],
  ['識別模型', '辨識模型'],
  ['識別服務', '辨識服務'],
  ['安裝包', '安裝套件'],
  ['外掛包名', '外掛套件名稱'],
  ['外掛包', '外掛套件'],
  ['npm 包', 'npm 套件'],
  ['軟體包', '套件'],
  ['包名', '套件名稱'],
  ['倉庫', '儲存庫'],
  ['列表', '清單'],
  [/(?:“發現”|「發現」)(?:標籤頁|分頁)/gu, '「探索外掛」分頁'],
  ['標籤頁', '分頁'],
  ['選項卡', '分頁'],
  ['詳情', '詳細資料'],
  ['禁用', '停用'],
  ['日誌', '記錄'],
  ['後臺', '背景'],
  ['進程', '處理程序'],
  ['本地化', '在地化'],
  ['本地', '本機'],
  ['程式碼塊', '程式碼區塊'],
  ['獲取', '取得'],
  ['憑據', '憑證'],
  ['校驗', '驗證'],
  ['跳轉', '跳至'],
  ['新增依賴', '新增相依套件'],
  ['安裝依賴', '安裝相依套件'],
  ['轉寫錄音', '將錄音轉為文字'],
  ['社羣', '社群'],
  ['示例', '範例'],
  ['下載地址', '下載網址'],
  ['訪問', '存取'],
  [/終端(?!機|裝置)/gu, '終端機'],
]

export const hasHan = text => /\p{Script=Han}/u.test(text)

// Preserve interpolation tokens, inline code and URLs in UI strings.
export function createTaiwanTranslator(Converter, extraTerms = []) {
  const convert = Converter({ from: 'cn', to: 'twp' })
  const replacements = [...terms, ...extraTerms]
  return text => text.split(/(\{\w+\}|\x60[^\x60]+\x60|https?:\/\/[^\s<>\x60。，；）)]+)/u).map((part, index) => {
    if (index % 2) return part
    let translated = convert(part)
    for (const [original, replacement] of replacements) translated = translated.replaceAll(original, replacement)
    return translated
  }).join('')
}

export function localizeMetadata(locale, translate) {
  const original = locale.resolveText
  const previous = Object.getOwnPropertyDescriptor(locale, 'resolveText')
  function resolveText(text) {
    const resolved = original.call(this, text)
    if (this.getLocale().active.toLowerCase() !== 'zh-hant') return resolved

    if (typeof text !== 'string') {
      const traditional = text['zh-hant'] ?? text['zh-tw']
      if (traditional !== undefined) return traditional
      const chinese = text.zh ?? text['zh-cn'] ?? text['zh-hans']
      if (chinese !== undefined) return translate(chinese)
    }
    return hasHan(resolved) ? translate(resolved) : resolved
  }
  locale.resolveText = resolveText
  return () => {
    if (locale.resolveText !== resolveText) return
    if (previous) Object.defineProperty(locale, 'resolveText', previous)
    else delete locale.resolveText
  }
}

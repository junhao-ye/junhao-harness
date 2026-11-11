# Junhao Harness

Junhao Harness 是以 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 為基礎的繁體中文 Web 版。它透過上游的 Cordis 外掛機制載入 `zh-Hant` 詞庫，並在瀏覽器分頁、側邊欄與首頁顯示 Junhao 品牌。

## 啟動

在專案目錄中使用 Node.js 24.9 以上版本執行以下命令。

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm start
```

預設使用本機連接埠 3080，並在瀏覽器開啟包含登入權杖的啟動連結。首次使用時，可跟著畫面登入 DeepSeek 或新增 API 金鑰，也可稍後在「設定 → 模型」完成設定。接著從首頁選擇工作區並新增對話。可在「設定 → 一般 → 語言」切換介面語言。

若要指定連接埠，執行 `npm start -- --port 39081 --no-open`，再開啟終端機印出的完整啟動連結。本版預設把設定、對話與憑證儲存在專案內的 `.junhao/home`，可用 `JUNHAO_HOME` 指定其他目錄。

## 詞庫與上游版本

本版使用 DeepSeek Harness `0.2.2-rc.1`。繁體詞庫採用台灣用詞。外掛管理、內建外掛清單與探索外掛也會以繁體顯示外掛提供的中文名稱、摘要與說明。外掛專屬畫面仍由各外掛提供翻譯。

更新詞庫時，先取得對應版本的 [上游原始碼](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.1)，再執行 `npm run update-locale -- <上游原始碼目錄>`。產生器使用 OpenCC 轉換字詞，再套用 `plugin/locale-overrides.json` 的人工校訂。

上游程式碼及衍生詞庫沿用 [MIT 授權](LICENSE)。Junhao Harness 是獨立的在地化版本。

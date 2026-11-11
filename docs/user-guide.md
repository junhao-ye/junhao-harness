# Junhao Harness 使用說明書

Junhao Harness 是採用台灣繁體中文的 DeepSeek Harness Web 版。啟動服務後，你可以在瀏覽器選擇工作區、使用模型處理專案，並管理外掛。

## 安裝與啟動

準備 Git、Node.js 24.9 以上版本，以及可連線到 GitHub 和 npm 的網路。 [下載 Git](https://git-scm.com/downloads/) · [下載 Node.js](https://nodejs.org/en/download)

在終端機執行以下命令。

```sh
git clone https://github.com/junhao-ye/junhao-harness.git
cd junhao-harness
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm start
```

Windows PowerShell 若因執行原則擋住 `npm.ps1`，可把 `npm` 換成 `npm.cmd`。預設服務位址是 `127.0.0.1:3080`，啟動時會開啟瀏覽器。若分頁沒有開啟，請從終端機複製完整的啟動連結。連結含登入權杖，請僅提供給獲授權的使用者。

服務會在終端機中執行。要停止服務，在該終端機按 `Ctrl+C`。下次要啟動時，回到 `junhao-harness` 目錄執行 `npm start`。

## 第一次使用

1. 在歡迎畫面按「繼續」。接著登入 DeepSeek 帳號或選擇「新增 API 金鑰」。也可以稍後從「設定 → 模型」完成設定。
2. 回到首頁，按「選擇工作區」，新增並選取你要處理的專案資料夾。遠端部署時，選擇的是主機上的資料夾。
3. 按「新對話」，在輸入區選擇模型，送出第一個任務。

可從只讀的任務開始，例如「請整理這個專案的目錄結構，並指出主要啟動檔案」。後續若請 Agent 修改檔案或執行指令，介面會依目前的權限模式要求核准。 [上游 Web 操作指南](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart)

## 模型、語言與外掛

- 在「設定 → 模型」可儲存 DeepSeek API 金鑰，也可按「新增模型供應商」選擇第三方供應商。使用自訂端點時，填入供應商 ID、基礎網址、API 協定、憑證和至少一個模型。儲存後回到對話的模型選單選取。 [上游模型設定指南](https://deepseek-harness.github.io/deepseek-harness/en/guide/providers)
- 介面預設使用繁體中文。到「設定 → 一般 → 語言」可以切換語言，重新載入頁面後也會讀回已儲存的偏好。
- 從側邊欄的「外掛」啟用或設定外掛。安裝第三方外掛時，主機需要能執行 `pnpm`，可在終端機執行 `pnpm --version` 確認。「新增外掛」支援 npm 套件名稱、Git 儲存庫網址或本機資料夾路徑。到「設定 → 內建外掛」可搜尋內建元件並查看執行狀態。 [pnpm 安裝說明](https://pnpm.io/installation)
- 在「外掛」啟用「自訂外掛索引」後，開啟「探索外掛」並新增索引來源。安裝前請在確認畫面核對套件、版本和來源。 [上游外掛索引指南](https://deepseek-harness.github.io/deepseek-harness/en/guide/plugin-market)

Junhao Harness 會將外掛提供的中文名稱、摘要及 Markdown 說明轉成台灣繁體。圖片內文字、外掛專屬畫面與僅提供英文的內容由外掛提供者維護。

## 設定儲存與備份

資料預設儲存在專案目錄下的 `.junhao/home`。關閉瀏覽器或重啟服務後，使用同一個資料目錄即可讀回已儲存的偏好。指定 `JUNHAO_HOME` 環境變數時，服務會使用你指定的目錄。

| 資料 | 資料目錄內的位置 |
| --- | --- |
| Web 設定檔的自訂項目，例如模型設定 | `profiles/web/cordis.patch.yml` |
| 在介面儲存的 API 金鑰 | `.credentials.yaml` |
| 對話紀錄 | `sessions/` |

備份時，先停止服務，再將整個資料目錄複製到私人位置，因為備份含有憑證。還原時，把備份放回原本的資料目錄，或在啟動前以 `JUNHAO_HOME` 指向還原後的目錄。 [上游憑證儲存說明](https://deepseek-harness.github.io/deepseek-harness/en/guide/providers#configure-deepseek)

## 遠端主機部署

### 使用 SSH 連接埠轉送

從自己的電腦執行以下命令，把 `user@your-server` 換成主機帳號與位址。

```sh
ssh -L 3080:127.0.0.1:3080 user@your-server
```

登入後，在遠端主機完成安裝步驟。之後在專案目錄啟動服務。

```sh
npm start -- --no-open
```

保持 SSH 連線，把遠端終端機印出的完整啟動連結貼到自己電腦的瀏覽器。設定、工作區和對話資料都由遠端主機上的服務管理。 [上游 SSH 啟動說明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/README.md#run-from-npm)

### 使用 HTTPS 網域

在主機上將 HTTPS 反向代理指向 `127.0.0.1:3080`，保留瀏覽器送出的 `Host`，並轉送 WebSocket 升級請求。以下以 `harness.example.com` 為例，請換成實際網域。

```sh
npm start -- --no-open --public-url https://harness.example.com/ --trusted-host harness.example.com
```

依上游指南設定代理的 HTTPS 憑證與 Cookie 屬性，再以啟動連結登入。連線到同一個服務的使用者會共用該服務的資料目錄。需要各自的設定和憑證時，請分別啟動服務，並為每個服務指定各自的 `JUNHAO_HOME` 和連接埠。 [上游反向代理部署指南](https://deepseek-harness.github.io/deepseek-harness/en/guide/public-deployments)

## 更新版本

停止服務並備份資料目錄，接著在原本的專案目錄執行以下命令。重新啟動時使用原來的 `JUNHAO_HOME` 和啟動參數。

```sh
git pull --ff-only
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm start
```

## 常見問題

| 情況 | 處理方式 |
| --- | --- |
| 安裝時提示 Node.js 版本不符 | 執行 `node --version` 確認版本，升級到 24.9 以上後重新安裝。 |
| `3080` 已被占用 | 執行 `npm start -- --port 3081`，並開啟這次啟動印出的連結。若使用 SSH 或反向代理，也要調整轉送的連接埠。 |
| 瀏覽器顯示未登入或回傳 `401` | 開啟目前服務啟動時印出的完整連結，包含登入權杖。 |
| 無法送出訊息 | 先確認已選擇工作區和模型，再檢查該模型的憑證與端點設定。 |
| 找不到先前的設定或對話 | 確認這次啟動使用的資料目錄與先前相同，並檢查 `JUNHAO_HOME` 的值。 |

返回 [專案 README](../README.md)。

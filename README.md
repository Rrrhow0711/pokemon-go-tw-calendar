# Pokémon GO 台灣繁體中文活動行事曆

這是一個免費、無廣告、沒有資料庫的公開訂閱行事曆產生器。使用者在 iPhone 訂閱一次後，GitHub Actions 每 6 小時重新取得活動、套用台灣繁體中文名稱並發布 RFC 5545 ICS；活動新增、改期或從來源移除時，下一版訂閱內容也會同步變更。

> 本專案非 Pokémon GO 官方服務，與 Niantic、The Pokémon Company 無隸屬關係。資料來自 Pokémon GO 公開公告、[Leek Duck](https://leekduck.com/events/) 與 [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck)。請遵守來源的免費、公開、非付費牆、非廣告營利使用規範。

## 運作方式

主要來源是 ScrapedDuck 的公開 [`events.json`](https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json)：

```text
Pokémon GO 官方公告
  → Leek Duck 整理
  → ScrapedDuck 結構化 JSON
  → 本專案分層中文化與台北時區處理
  → public/pokemon-go-zh-TW.ics
  → GitHub Pages
```

外部 JSON 會逐筆經 Zod 驗證、限制長度、移除 HTML 與控制字元；格式錯誤的單筆活動會警告並跳過。網路請求具有 timeout、retry、指數退避、明確 User-Agent、HTTPS 與重新導向網域 allowlist。若來源是 0 筆或相對上一版異常下降至預設 50% 以下，建置會中止，不會覆蓋或部署空白日曆。

### 中文化優先順序

1. **人工覆寫**：`data/manual-overrides.zh-TW.json`，以 `eventID` 索引，可設定 `title`、`officialUrl`、`description`、`disabled` 與 `notes`。
2. **Pokémon GO 繁體中文官網**：嘗試 `https://pokemongo.com/zh-Hant/news/{eventID}`，只允許重新導向至 `pokemongo.com` 或 `pokemongolive.com`。會排除「活動詳情」、「可遇見的寶可夢」等章節名稱並檢查年份與路徑關聯。成功結果 7 天重查，404 或低信心結果 24 小時後重試。
3. **固定活動規則**：團體戰時刻、聚焦時刻、五星團體戰、超級團體戰、極巨星期一、極巨對戰日、社群日、經典社群日、GO Pass 月份與 GO 對戰聯盟等，不呼叫 AI。
4. **寶可夢官方名稱表**：`data/pokemon-names.zh-TW.json` 記錄英文名、台灣繁中名與來源，也支援阿羅拉、伽勒爾、洗翠、帕底亞、超級進化、原始回歸、極巨化與超極巨化型態。
5. **GitHub Models 備援**：只有前四層無法處理的標題才批次送出。預設 `openai/gpt-4.1-mini`，可用 `GITHUB_MODEL` 更換。輸入與輸出都視為不可信資料，模型只能回傳受限 JSON，輸出再經 Zod、字數及 HTML 字元檢查。
6. **安全備援**：沒有 token、Models 限流或服務失敗時，使用「中文活動分類｜英文原名」，整體建置仍會成功；待確認數顯示於 `status.json`。

GitHub Actions 直接使用該次工作內建且短效的 `GITHUB_TOKEN` 與 `models: read` 權限，不需要 OpenAI、Google、DeepL 或其他額外 API Key。模型翻譯會寫入內容雜湊快取，原文或活動類型改變才會重新翻譯。

## 時間與 ICS

目標時區固定為 `Asia/Taipei`，不依賴 runner 系統時區：

- 沒有 `Z` 或 offset 的 ISO 時間直接視為台灣牆上時間，不會先當 UTC 再多加 8 小時。
- 有 `Z` 或 `+/-HH:mm` 的時間視為固定時間點，再轉成台北時間。
- 只有日期的活動輸出 `VALUE=DATE`，`DTEND` 使用結束日下一天的排他日期。

ICS 包含 `VTIMEZONE`、固定 `eventID@pokemon-go-tw-calendar` UID、CRLF、文字跳脫與 RFC 5545 的 75 octets UTF-8 安全折行。相同活動改名或改時間不會改變 UID，也不會在 Apple 行事曆新增第二筆。

## 本機安裝與執行

需要 Node.js 22 與 npm：

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:ics
```

常用指令：

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 用 fixtures 建置並在 `http://127.0.0.1:4173/` 預覽 |
| `npm run build` | 完全離線，以 fixtures 產生網站與 ICS |
| `npm run update` | 讀取即時 ScrapedDuck 與公開官方頁面並更新快取 |
| `npm test` | 執行不依賴網路的 Vitest 測試 |
| `npm run test:live` | 手動執行即時來源 smoke test |
| `npm run typecheck` | TypeScript strict 檢查 |
| `npm run lint` | ESLint 檢查 |
| `npm run validate:ics` | 用可靠 ICS parser 重解析產物，並檢查 UID、CRLF、折行 |

本機沒有 `GITHUB_TOKEN` 時，官網與固定規則仍可用；GitHub Models 會自動跳過並改用安全備援，不會讓更新失敗。若要本機以 PAT 測試 GitHub Models，token 只應放在未提交的 `.env` 或目前 shell；不要寫進設定檔或日誌。

## 建立 GitHub 公開儲存庫

1. 在 GitHub 建立 **Public** repository，不要勾選額外建立 README。
2. 在本機執行（將網址換成你的 repository）：

   ```bash
   git add .
   git commit -m "feat: initial Pokémon GO calendar"
   git branch -M main
   git remote add origin https://github.com/你的帳號/你的儲存庫.git
   git push -u origin main
   ```

3. 到 repository 的 **Settings → Pages**。
4. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。不要選擇從 branch 的 `/docs` 發布。
5. 到 **Settings → Actions → General → Workflow permissions**，確認 Actions 可以讀寫 repository；workflow 本身已明確宣告 `contents: write`、`pages: write`、`id-token: write` 與 `models: read`。
6. 到 **Settings → Models** 啟用 GitHub Models。個人帳號 repository 可直接啟用；組織 repository 可能還需要組織或企業擁有者允許 Models 及所選模型。

不需要建立任何 Actions secret。`update-calendar.yml` 會使用 `${{ github.token }}`，而且不會輸出 token 或 Authorization header。

### 第一次更新與手動執行

到 **Actions → Update calendar → Run workflow**，選擇 `main` 後執行。正常 log 會列出：

- 來源收到與有效活動筆數
- 官方繁中、固定規則、GitHub Models 與備援筆數
- 實際產生的 VEVENT 與警告數

排程 cron 為 UTC 的 `17 0,6,12,18 * * *`，也就是台灣時間每天 **02:17、08:17、14:17、20:17**（UTC+8），每 6 小時一次。刻意避開整點可降低 GitHub Actions 排程壅塞。

更新完成後，workflow 只在產物或快取變更時提交，commit 訊息包含 `[skip ci]`，再部署 `public` 至 Pages。沒有變更不是錯誤。來源完全故障或筆數異常時，工作會明確失敗並保留上一版 Pages 內容；GitHub Models 失敗則仍會部署含安全備援標題的可用日曆。

## 訂閱網址

啟用 Pages 後：

- 網站：`https://{username}.github.io/{repo}/`
- HTTPS ICS：`https://{username}.github.io/{repo}/pokemon-go-zh-TW.ics`
- Apple 訂閱：`webcal://{username}.github.io/{repo}/pokemon-go-zh-TW.ics`

實際網址會由 Actions 的 `GITHUB_REPOSITORY` 自動推導，不會在程式內硬編碼未知帳號。若使用自訂網域，可設定 repository variable `SITE_BASE_URL`；本機預設為 `http://localhost:4173/`。

### iPhone 加入

1. 用 Safari 開啟 Pages 網站。
2. 點「加入 Apple 行事曆」。
3. 確認後按「訂閱」。

也可到「設定 → App → 行事曆 → 行事曆帳號 → 加入帳號 → 其他 → 加入已訂閱的行事曆」貼上 HTTPS 網址。

Apple 對訂閱行事曆有自己的快取與更新排程；網站已更新不代表手機會立刻重抓。請勿下載 ICS 後用「加入全部」代替訂閱，否則後續更新不會同步。

### iPhone 移除

到「設定 → App → 行事曆 → 行事曆帳號 → 已訂閱的行事曆」，點選「Pokémon GO 台灣活動」，再選「刪除帳號」。

## 修正翻譯

編輯 `data/manual-overrides.zh-TW.json`：

```json
{
  "來源中的-eventID": {
    "title": "正式台灣繁中活動名",
    "officialUrl": "https://pokemongo.com/zh-Hant/news/...",
    "description": "可選的簡短補充",
    "disabled": false,
    "notes": "維護者註記，不會出現在 ICS"
  }
}
```

人工覆寫永遠優先。`disabled: true` 可暫時排除一筆活動。提交後可手動執行 Update calendar。

若要更換模型，建議在 **Settings → Secrets and variables → Actions → Variables** 新增 `GITHUB_MODEL`，例如 `openai/gpt-4.1-mini`。模型必須存在於目前 [GitHub Models 目錄](https://github.com/marketplace?type=models)，且 repository/organization policy 已允許。無法使用時會自動備援。

## 狀態與故障排除

`https://{username}.github.io/{repo}/status.json` 提供最後成功時間、來源與產出筆數、各翻譯層筆數、待確認數、警告、來源及行事曆網址。

- **Pages 404**：確認 Settings → Pages → Source 是 GitHub Actions，且 `deploy-pages` 步驟成功。
- **workflow 無法 push**：確認 Actions workflow permissions 可寫入 repository，分支保護也允許 bot 更新；需要時改成由 PR 更新快取。
- **Models 403/404**：到 Settings → Models 啟用功能，確認 `models: read` 與模型 policy。行事曆仍會用安全備援建置。
- **手機尚未更新**：先檢查 `status.json` 與 HTTPS ICS 是否已更新，再等待 Apple 快取；必要時移除後重新訂閱。
- **來源異常下降**：這是防止空白覆蓋的保護。先查看 ScrapedDuck 是否暫時異常，不要任意把 `MIN_SOURCE_RATIO` 調成 0。
- **單筆活動不見**：查看 Actions log 與 `warnings`，通常是來源欄位、時間或網址未通過驗證。
- **官網標題選錯**：用人工覆寫立即修正；官方擷取刻意採保守信心門檻，寧可交給下一層也不誤套其他活動。

## 專案結構

```text
src/
  fetch-events.ts        # ScrapedDuck 驗證、健康檢查
  official-zh.ts         # 官網標題擷取與 TTL 快取
  title-rules.ts         # 固定活動翻譯
  pokemon-names.ts       # 官方名稱查詢與型態處理
  github-models.ts       # 批次模型請求與輸出驗證
  translate.ts           # 中文化優先順序
  time.ts                # Asia/Taipei 時間語意
  ics.ts                 # RFC 5545 產生器
  build-page.ts          # 安全的原生靜態訂閱頁
  index.ts               # 完整更新流程與原子寫入
data/                    # 人工覆寫、名稱表與快取
public/                  # GitHub Pages 產物
tests/fixtures/          # 離線來源、官網與模型回應
.github/workflows/       # CI 與每 6 小時更新/部署
```

程式碼採 MIT License。網站與行事曆只引用短標題、結構化時間與來源連結，不重製 Pokémon GO 官網或 Leek Duck 的整篇文章；各品牌、角色與內容權利屬原權利人。

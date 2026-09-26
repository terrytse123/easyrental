# 香港租租 EasyRentalHK

香港業主租務台帳：物業、租約、收租、維修、租約／釐印文件；繁中為主，英文可用。

**線上：** [https://easyrentalhk.vercel.app](https://easyrentalhk.vercel.app)

## 資料存在哪裡

雲端台帳寫入 **Postgres（Supabase）**，經伺服器 `DATABASE_URL` 連線——**不是**只存在瀏覽器。多裝置同時改同一帳本時，若伺服器已有較新版本，儲存會衝突，需**重新載入**後再改。

Supabase 的 anon Data API 已鎖；應用只走伺服器端資料庫連線。

`/guide` 的 JSON 匯出／匯入是**次要備份**，不是主儲存。

## 功能（現況）

- 物業、租客、租約（含應收／已收按金、收款日）
- 收租紀錄（期數、已付金額、到期日、付款方式如 FPS／銀行／PayMe 等）
- 維修工單
- 租約／釐印／按金相關文件上傳
- 工作台（desk）、收入概覽
- 雙語介面（繁中／英）
- **續約電郵提醒**：租約結束約 90 日內寄給業主（cron `/api/renewal`）。**尚未**實作逾期租金電郵或釐印 30 日警告

記帳工具，非法律意見。

## 登入

電郵註冊 + OTP 驗證／重設密碼；可選 MFA（TOTP）。登入後以 session cookie 維持工作階段。

## Android APK

倉庫僅保留最新：[`/EasyRentalHK-122.apk`](https://easyrentalhk.vercel.app/EasyRentalHK-122.apk)。舊版已自 `public/` 移除；日後建議發佈到 [GitHub Releases](https://github.com/terrytse123/easyrental/releases)。

## 生產環境變數（名稱 only，勿提交真實密鑰）

| 變數 | 用途 |
|------|------|
| `DATABASE_URL` | Postgres／Supabase session pooler URI（必填） |
| `BETTER_AUTH_SECRET` | Better Auth 簽署密鑰（部署必填） |
| `CRON_SECRET` | 保護 `/api/renewal` cron |
| `RESEND_API_KEY` | 電郵（驗證／重設／續約）；或改用 SMTP |
| `MAIL_FROM` | 寄件顯示名稱（可選） |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_PORT` | 未設 Resend 時的 SMTP 備援 |

詳見 `.env.example`。協作者／agent 部署清單見 [`AGENTS.project.md`](./AGENTS.project.md)（產品真相以此為準；平台巨檔 `AGENTS.md` 留給 Grok App Builder）。

## English (short)

Cloud landlord ledger on Postgres/Supabase via `DATABASE_URL`. Multi-device stale saves require reload. Features: properties, tenancies (deposit owed vs received), rent collection, repairs, lease/stamp files, bilingual UI, desk. Auth: email + OTP, optional MFA, session cookie. JSON backup on `/guide` is secondary. Live: https://easyrentalhk.vercel.app. Renewal email only (~90 days before lease end)—no overdue-rent or stamp-duty email alerts yet.

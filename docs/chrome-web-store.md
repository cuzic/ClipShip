# Chrome Web Store 公開用ドキュメント

## ストア情報

### 拡張機能名

```
PasteHost
```

### 短い説明 (132文字以内)

```
One-click deploy clipboard to Netlify, Vercel, Cloudflare Pages, or Gist. Supports HTML, Markdown, syntax highlighting, and Mermaid.
```

### 詳細説明

```
PasteHost - Instant Clipboard Deployment

Turn your clipboard into a live webpage in seconds! PasteHost is a developer-friendly Chrome extension that deploys your clipboard content with just one click.

🚀 FEATURES

• One-Click Deploy - Set your default provider in Options, then deploy with a single click
• Deploy History - View past deployments, edit titles, and copy URLs
• Smart Content Detection - Automatically detects HTML, Markdown, or plain text
• Beautiful Markdown Rendering - Full Markdown support with GitHub-style formatting
• Syntax Highlighting - 20+ programming languages with highlight.js
• Math Equations - LaTeX math with KaTeX ($...$, $$...$$)
• Task Lists - GitHub-style checkboxes (- [ ], - [x])
• Footnotes - Academic-style footnotes ([^1])
• Emoji - Shortcode conversion (:smile: → 😄)
• Strikethrough - ~~deleted text~~ support
• Mermaid Diagrams - Flowcharts, sequence diagrams, ER diagrams, and more
• Four Hosting Options:
  - Netlify - Permanent hosting with custom domains
  - Vercel - Fast Edge network deployment
  - Cloudflare Pages - Global CDN hosting
  - GitHub Gist - Quick sharing via GistHack
• Instant Sharing - URL automatically copied to clipboard and opened in new tab

📝 SUPPORTED CONTENT

HTML:
- Complete HTML documents
- HTML fragments (div, table, form, etc.)

Markdown:
- Headings, lists, tables, blockquotes
- Code blocks with syntax highlighting
- Math equations with KaTeX
- Task lists with checkboxes
- Footnotes for references
- Emoji shortcodes (:smile:)
- Strikethrough (~~text~~)
- Links and images
- Mermaid diagrams

Plain Text:
- Displayed with monospace formatting

🔧 SYNTAX HIGHLIGHTING LANGUAGES

JavaScript, TypeScript, Python, Java, SQL, Bash, JSON, YAML, XML, CSS, Go, Rust, Ruby, PHP, C, C++, C#, Kotlin, Swift, Dockerfile, and more

📊 MERMAID DIAGRAMS

- Flowchart / Graph
- Sequence Diagram
- Class Diagram
- State Diagram
- ER Diagram
- Gantt Chart
- Pie Chart
- Git Graph
- Mind Map
- Timeline

🔒 PRIVACY & SECURITY

- Your API tokens are stored securely in Chrome's sync storage
- No data is collected or sent to third parties
- HTML in Markdown is sanitized to prevent XSS attacks
- Open source: https://github.com/user/pastehost

⚙️ SETUP

1. Click the extension icon and go to Options
2. Select your default deploy provider (Netlify, Vercel, Cloudflare Pages, or GitHub Gist)
3. Enter the required API token for your chosen provider:
   - Netlify: Personal Access Token
   - Vercel: Personal Access Token
   - Cloudflare Pages: API Token + Account ID
   - GitHub Gist: Personal Access Token with gist scope
4. Copy any HTML/Markdown content to clipboard
5. Click the Deploy button - your page is live! URL is copied and opened automatically

Perfect for:
- Sharing code snippets with colleagues
- Quick prototyping and demos
- Documentation previews
- Diagram sharing
- Bug reports with formatted content
```

### カテゴリ

```
Developer Tools
```

### 言語

```
English (United States)
```

---

## 権限の正当化 (Permission Justifications)

Chrome Web Store のレビュー時に必要な権限の説明です。

### clipboardRead

```
This extension reads clipboard content to deploy it to Netlify or GitHub Gist. The user copies HTML, Markdown, or text content to their clipboard, then clicks the deploy button. The clipboard content is read only when the user explicitly triggers the deploy action.
```

### storage

```
This extension uses Chrome's sync storage to securely store user's API tokens (Netlify, Vercel, Cloudflare, and GitHub Personal Access Tokens) and the default deploy provider setting. These tokens are required to authenticate with hosting provider APIs for deployment. The tokens are stored locally and synced across user's Chrome browsers.
```

### tabs

```
This extension creates a new tab to open the deployed URL after successful deployment. When the user deploys content, the extension automatically opens the resulting URL in a new tab for immediate preview.
```

### Host Permissions: https://api.netlify.com/*

```
This extension calls Netlify's API to create and manage deployments. It needs to:
1. Create/find the PasteHost site on user's Netlify account
2. Create deployments using the File Digest API
3. Upload files to the deployment
4. Poll deployment status until ready
```

### Host Permissions: https://api.github.com/*

```
This extension calls GitHub's Gist API to create public gists. It needs to create gists with the user's clipboard content for sharing via GistHack URLs.
```

### Host Permissions: https://api.vercel.com/*

```
This extension calls Vercel's API to create deployments. It needs to:
1. Create/find the PasteHost project on user's Vercel account
2. Create deployments with inline file upload
3. Get deployment URL for sharing
```

### Host Permissions: https://api.cloudflare.com/*

```
This extension calls Cloudflare's Pages API to create deployments. It needs to:
1. Create/find the PasteHost project on user's Cloudflare account
2. Upload files using the Direct Upload API with manifest
3. Get deployment URL for sharing
```

---

## 画像アセット

すべての画像は `scripts/generate_assets.py` で生成済みです。

### アイコン (public/ に配置済み)

| サイズ | ファイル名 | 用途 |
|--------|-----------|------|
| 16x16 | `public/icon16.png` | ツールバー |
| 32x32 | `public/icon32.png` | Windows |
| 48x48 | `public/icon48.png` | 拡張機能ページ |
| 128x128 | `public/icon128.png` | Chrome Web Store |

### スクリーンショット (assets/)

| ファイル | 内容 |
|----------|------|
| `assets/screenshot_popup_1280x800.png` | ポップアップ UI（デプロイボタン表示） |
| `assets/screenshot_result_1280x800.png` | デプロイ成功後の画面 |
| `assets/screenshot_options_1280x800.png` | オプションページ（トークン設定画面） |

### プロモーション画像 (assets/)

| ファイル | サイズ | 用途 |
|----------|--------|------|
| `assets/promo_small_440x280.png` | 440x280 | 小タイル (必須) |
| `assets/promo_large_920x680.png` | 920x680 | 大タイル (推奨) |

### 画像の再生成

```bash
# 全画像を再生成
python3 scripts/generate_assets.py

# 特定の画像のみ再生成
python3 scripts/generate_assets.py -t icon
python3 scripts/generate_assets.py -t promo_small
python3 scripts/generate_assets.py -t screenshot_popup

# 利用可能なモデル一覧
python3 scripts/generate_assets.py -l

# モデルを指定して生成
python3 scripts/generate_assets.py -m gemini-2.5-flash
```

---

## 審査対策チェックリスト

- [x] manifest.json の permissions が最小限か確認
- [x] 権限の正当化を準備 (このドキュメント参照)
- [ ] プライバシーポリシー URL を用意 (`docs/privacy-policy.md` を公開)
- [x] スクリーンショットを用意 (`assets/screenshot_*.png`)
- [x] アイコン（16, 32, 48, 128px）を用意 (`public/icon*.png`)
- [x] 小プロモーション画像（440x280）を用意 (`assets/promo_small_440x280.png`)
- [x] 大プロモーション画像（920x680）を用意 (`assets/promo_large_920x680.png`)
- [x] 説明文に主要機能を明記 (このドキュメント参照)
- [ ] 連絡先メールアドレスを設定

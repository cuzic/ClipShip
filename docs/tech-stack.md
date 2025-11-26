# ClipShip 技術スタック仕様書

## 概要

クリップボードのHTMLコードをNetlifyまたはGitHub Gistに即座にデプロイするChrome拡張機能。

## 前提ツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| mise | latest | ランタイム管理 |
| Bun | latest | パッケージマネージャ / ランタイム / バンドラー |

## 技術スタック

### コア

| カテゴリ | ツール | 理由 |
|---------|--------|------|
| 言語 | TypeScript | 型安全性、API型定義 |
| バンドラー | Bun (built-in) | 設定不要、高速 |
| ZIPライブラリ | fflate | jszip より軽量（約10KB）・高速 |
| リンター/フォーマッター | Biome | ESLint + Prettier 相当を1ツールで |

### ユーティリティ

| ライブラリ | 用途 |
|-----------|------|
| zod | APIレスポンスのバリデーション・型推論 |
| ky | fetchラッパー（リトライ・タイムアウト・エラーハンドリング） |
| nanoid | 一意ID生成（ファイル名等） |

### テスト

| ツール | 用途 |
|--------|------|
| Bun test | ユニットテスト（Bun組み込み、設定不要） |
| Playwright | E2Eテスト（Chrome拡張のテスト対応） |
| sinon-chrome | Chrome API モック（ユニットテスト用） |

### 開発ツール

| ツール | 用途 |
|--------|------|
| lefthook | Git hooks（pre-commit等） |
| @types/chrome | Chrome Extension API 型定義 |
| knip | 未使用コード・依存関係の検出 |

### Chrome拡張 開発・検証

| ツール | 用途 |
|--------|------|
| crx | .crx ファイル生成（パッケージング） |
| zip-a-folder | dist → .zip 生成（Web Store提出用） |
| web-ext | 拡張機能のリント・検証 |

### CI/CD

| ツール | 用途 |
|--------|------|
| GitHub Actions | lint / test / build 自動化 |
| chrome-webstore-upload-cli | Chrome Web Store 自動公開 |

## ディレクトリ構成

```
clipship/
├── .mise.toml
├── bun.lock
├── package.json
├── tsconfig.json
├── biome.json
├── lefthook.yml
├── playwright.config.ts
├── src/
│   ├── popup.ts
│   ├── options.ts
│   ├── lib/
│   │   ├── netlify.ts      # Netlify API
│   │   ├── gist.ts         # GitHub Gist API
│   │   ├── html.ts         # HTML生成
│   │   └── storage.ts      # Chrome Storage ヘルパー
│   ├── schemas/
│   │   ├── netlify.ts      # Netlify APIレスポンス zod スキーマ
│   │   └── gist.ts         # GitHub APIレスポンス zod スキーマ
│   └── types/
│       └── index.ts
├── public/
│   ├── manifest.json
│   ├── popup.html
│   └── options.html
├── tests/
│   ├── unit/
│   │   └── *.test.ts       # ユニットテスト
│   └── e2e/
│       └── *.spec.ts       # E2Eテスト
└── dist/                   # ビルド出力
```

## 設定ファイル

### .mise.toml

```toml
[tools]
bun = "latest"

[tasks.dev]
run = "bun run dev"

[tasks.build]
run = "bun run build"

[tasks.lint]
run = "bun run lint"

[tasks.test]
run = "bun run test"

[tasks.test-e2e]
run = "bun run test:e2e"

[tasks.package]
run = "bun run package"

[tasks.publish]
run = "bun run publish:chrome"
```

### package.json

```json
{
  "name": "clipship",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun build src/*.ts --outdir dist --watch",
    "build": "bun build src/*.ts --outdir dist --minify",
    "lint": "biome check .",
    "lint:ext": "web-ext lint --source-dir dist",
    "format": "biome format --write .",
    "test": "bun test",
    "test:e2e": "playwright test",
    "package": "bun run build && bun run scripts/package.ts",
    "publish:chrome": "chrome-webstore-upload upload --source dist.zip",
    "knip": "knip"
  },
  "devDependencies": {
    "@anthropic-ai/claude-code": "^0.2.0",
    "@anthropic-ai/sdk": "^0.52.0",
    "@anthropic-ai/tools": "^0.52.0",
    "@biomejs/biome": "^1.9.0",
    "@anthropic-ai/sdk": "^0.52.0",
    "@anthropic-ai/tools": "^0.52.0",
    "@playwright/test": "^1.48.0",
    "@types/chrome": "^0.0.270",
    "chrome-webstore-upload-cli": "^3.3.0",
    "crx": "^5.0.1",
    "knip": "^5.33.0",
    "lefthook": "^1.7.0",
    "sinon-chrome": "^3.0.1",
    "typescript": "^5.6.0",
    "web-ext": "^8.3.0",
    "zip-a-folder": "^3.1.0"
  },
  "dependencies": {
    "fflate": "^0.8.0",
    "ky": "^1.7.0",
    "nanoid": "^5.0.0",
    "zod": "^3.23.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["chrome", "bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

### lefthook.yml

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: bun run lint
    format:
      run: bun run format
    knip:
      run: bun run knip

pre-push:
  commands:
    test:
      run: bun run test
```

### playwright.config.ts

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  use: {
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
```

## npm scripts 一覧

| コマンド | 説明 |
|----------|------|
| `bun run dev` | 開発モード（ウォッチビルド） |
| `bun run build` | 本番ビルド（minify） |
| `bun run lint` | Biome による静的解析 |
| `bun run lint:ext` | web-ext による拡張機能リント |
| `bun run format` | コードフォーマット |
| `bun run test` | ユニットテスト実行 |
| `bun run test:e2e` | E2Eテスト実行 |
| `bun run package` | .zip / .crx 生成 |
| `bun run publish:chrome` | Chrome Web Store 公開 |
| `bun run knip` | 未使用コード検出 |

## UI方針

- popup.html / options.html は **vanilla HTML + CSS**
- ロジックは **TypeScript** で記述
- フレームワーク（React/Vue等）は不使用（過剰、バンドルサイズ増加を避ける）

## API通信

### Netlify API

- エンドポイント: `POST https://api.netlify.com/api/v1/sites`
- 認証: Bearer Token
- ボディ: ZIP (application/zip)
- レスポンス: zod でバリデーション

### GitHub Gist API

- エンドポイント: `POST https://api.github.com/gists`
- 認証: Token
- ボディ: JSON
- レスポンス: zod でバリデーション
- URL変換: `gist.githubusercontent.com` → `gist.githack.com`

## 開発ワークフロー

### 1. 初期セットアップ

```bash
mise install
bun install
lefthook install
```

### 2. 開発

```bash
bun run dev
# Chrome で chrome://extensions を開き、dist フォルダを読み込む
```

### 3. テスト

```bash
bun run test        # ユニットテスト
bun run test:e2e    # E2Eテスト
```

### 4. リリース

```bash
bun run build
bun run lint:ext    # 拡張機能の検証
bun run package     # ZIP生成
bun run publish:chrome  # Web Store公開
```

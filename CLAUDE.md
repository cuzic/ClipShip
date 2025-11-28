# Claude Code 用プロジェクト設定

## 開発環境

このプロジェクトでは **bun** を使用します。

### 禁止事項

- `node` コマンドの直接使用は禁止
- `npm` コマンドの使用は禁止
- `npx` コマンドの使用は禁止

### 代わりに使用するコマンド

| 禁止 | 代替 |
|------|------|
| `npm install` | `bun install` |
| `npm run <script>` | `bun run <script>` |
| `npm add <pkg>` | `bun add <pkg>` |
| `npx <cmd>` | `bunx <cmd>` |
| `node script.js` | `bun script.js` |

### mise タスク

プロジェクトのタスクは mise 経由で実行可能:

```bash
mise run build     # ビルド
mise run dev       # 開発サーバー
mise run lint      # lint チェック
mise run test      # テスト実行
```

## コーディング規約

- neverthrow の `ResultAsync` パターンを使用
- biome でフォーマット・lint
- TypeScript strict mode

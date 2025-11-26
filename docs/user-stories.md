# ClipShip ユーザーストーリー

## 概要

ClipShip は、クリップボードのHTMLコードを即座にWebにデプロイし、公開URLを取得するChrome拡張機能である。

---

## ペルソナ

### 主要ユーザー: Webデベロッパー / デザイナー

- HTMLモックやプロトタイプを頻繁に作成する
- 作成したHTMLを素早くクライアントやチームメンバーに共有したい
- 複雑なデプロイ手順を踏みたくない

---

## Epic 1: 初期セットアップ

### US-1.1: 拡張機能のインストール

```
As a ユーザー
I want to Chrome Web Store から ClipShip をインストールする
So that クリップボードからのデプロイ機能を使えるようになる
```

**受け入れ条件:**
- [ ] Chrome Web Store で「ClipShip」を検索できる
- [ ] ワンクリックでインストールできる
- [ ] インストール後、ツールバーにアイコンが表示される

---

### US-1.2: Netlify トークンの設定

```
As a ユーザー
I want to Netlify Personal Access Token を設定する
So that Netlify へのデプロイ機能を使えるようになる
```

**受け入れ条件:**
- [ ] 拡張機能アイコンを右クリック → オプションでオプション画面が開く
- [ ] Netlify Token 入力欄がある
- [ ] トークンを入力して保存できる
- [ ] 保存後、再度開くとトークンが入力済みになっている（マスク表示）

---

### US-1.3: GitHub トークンの設定

```
As a ユーザー
I want to GitHub Personal Access Token を設定する
So that GitHub Gist へのデプロイ機能を使えるようになる
```

**受け入れ条件:**
- [ ] オプション画面に GitHub Token 入力欄がある
- [ ] 必要なスコープ（gist）の説明が表示される
- [ ] トークンを入力して保存できる
- [ ] 保存後、再度開くとトークンが入力済みになっている（マスク表示）

---

## Epic 2: Netlify デプロイ

### US-2.1: クリップボードからNetlifyへデプロイ

```
As a ユーザー
I want to クリップボードのHTMLをNetlifyにデプロイする
So that 安定したURLでHTMLを公開できる
```

**受け入れ条件:**
- [ ] HTMLコードをクリップボードにコピーする
- [ ] 拡張機能のポップアップを開く
- [ ] 「Netlify」ボタンをクリックする
- [ ] 「Uploading...」などの進捗表示がある
- [ ] デプロイ成功後、`https://xxx.netlify.app` 形式のURLが表示される
- [ ] URLが自動的にクリップボードにコピーされる

---

### US-2.2: Netlifyデプロイのエラーハンドリング

```
As a ユーザー
I want to デプロイ失敗時に原因がわかる
So that 問題を解決して再試行できる
```

**受け入れ条件:**
- [ ] トークン未設定時: 「Netlify Token not set in Options.」と表示
- [ ] クリップボード空の時: 「Clipboard is empty.」と表示
- [ ] API エラー時: エラーメッセージが表示される
- [ ] エラーメッセージは赤色で目立つように表示

---

## Epic 3: GitHub Gist デプロイ

### US-3.1: クリップボードからGistへデプロイ

```
As a ユーザー
I want to クリップボードのHTMLをGitHub Gistにデプロイする
So that 手軽にHTMLを共有できる
```

**受け入れ条件:**
- [ ] HTMLコードをクリップボードにコピーする
- [ ] 拡張機能のポップアップを開く
- [ ] 「GistHack」ボタンをクリックする
- [ ] 「Creating Gist...」などの進捗表示がある
- [ ] デプロイ成功後、`https://gist.githack.com/...` 形式のURLが表示される
- [ ] URLが自動的にクリップボードにコピーされる
- [ ] URLをブラウザで開くとHTMLがレンダリングされる

---

### US-3.2: Gistデプロイのエラーハンドリング

```
As a ユーザー
I want to Gistデプロイ失敗時に原因がわかる
So that 問題を解決して再試行できる
```

**受け入れ条件:**
- [ ] トークン未設定時: 「GitHub Token not set in Options.」と表示
- [ ] クリップボード空の時: 「Clipboard is empty.」と表示
- [ ] 認証エラー時: 「Authentication failed. Check your token.」と表示
- [ ] 権限エラー時: 「Permission denied. Check gist scope.」と表示

---

## Epic 4: UI/UX

### US-4.1: ポップアップの視覚的フィードバック

```
As a ユーザー
I want to デプロイの状態が視覚的にわかる
So that 処理中なのか完了したのかを把握できる
```

**受け入れ条件:**
- [ ] 処理中はボタンが無効化される
- [ ] 処理中は進捗メッセージが表示される
- [ ] 成功時は緑色で「Success!」と表示
- [ ] 失敗時は赤色でエラーメッセージが表示
- [ ] URLはクリック可能なリンクとして表示

---

### US-4.2: URLのコピー確認

```
As a ユーザー
I want to URLがコピーされたことを確認できる
So that 安心して貼り付けできる
```

**受け入れ条件:**
- [ ] URLコピー後「Copied to clipboard!」と表示
- [ ] 表示は数秒後に消えるか、次の操作まで残る

---

## Epic 5: 開発者向け

### US-5.1: ローカルでの開発

```
As a 開発者
I want to ローカルで拡張機能を開発・テストする
So that 変更を素早く確認できる
```

**受け入れ条件:**
- [ ] `mise install && bun install` でセットアップ完了
- [ ] `bun run dev` でウォッチビルドが開始
- [ ] Chrome で `chrome://extensions` → 「パッケージ化されていない拡張機能を読み込む」で dist フォルダを読み込める
- [ ] ソースコード変更後、拡張機能を再読み込みすると変更が反映される

---

### US-5.2: テストの実行

```
As a 開発者
I want to 自動テストを実行する
So that リグレッションを防げる
```

**受け入れ条件:**
- [ ] `bun run test` でユニットテストが実行される
- [ ] `bun run test:e2e` でE2Eテストが実行される
- [ ] テスト結果がわかりやすく表示される

---

### US-5.3: リリースパッケージの作成

```
As a 開発者
I want to Chrome Web Store 提出用のパッケージを作成する
So that 拡張機能を公開できる
```

**受け入れ条件:**
- [ ] `bun run package` で dist.zip が生成される
- [ ] ZIP ファイルに必要なファイルがすべて含まれる
- [ ] `web-ext lint` でエラーが出ない

---

### US-5.4: CI/CD による自動化

```
As a 開発者
I want to GitHub にプッシュすると自動でテスト・ビルドが実行される
So that 品質を維持できる
```

**受け入れ条件:**
- [ ] プルリクエスト作成時に lint / test / build が実行される
- [ ] main ブランチへのマージ時にパッケージが生成される
- [ ] テスト失敗時はマージがブロックされる

---

## 優先度マトリクス

| 優先度 | ユーザーストーリー |
|--------|-------------------|
| P0 (Must) | US-1.2, US-1.3, US-2.1, US-3.1 |
| P1 (Should) | US-2.2, US-3.2, US-4.1, US-4.2 |
| P2 (Could) | US-1.1, US-5.1, US-5.2, US-5.3 |
| P3 (Won't for MVP) | US-5.4 |

---

## 非機能要件

### パフォーマンス

- デプロイ処理は5秒以内に完了すること（ネットワーク状況による）
- ポップアップの表示は即座に行われること

### セキュリティ

- トークンは `chrome.storage.sync` に保存し、平文でログに出力しない
- HTTPS 通信のみを使用する

### 互換性

- Chrome 最新版をサポート
- Manifest V3 に準拠

### サイズ

- 拡張機能の合計サイズは500KB以下を目標とする

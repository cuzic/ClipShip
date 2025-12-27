# OAuth セットアップガイド

PasteHost の OAuth 認証を使用するためのセットアップ手順です。
GitHub Gist と Netlify で OAuth 認証が利用可能です。

## 前提条件

- mise がインストールされていること
- GitHub アカウント
- Netlify アカウント

## 1. Netlify サイトの作成（共通）

OAuth バックエンドとして使用する Netlify サイトを作成します。

```bash
# mise で netlify-cli をインストール（自動）
mise install

# Netlify にログイン
netlify login

# 新規サイト作成
netlify sites:create --name pastehost-oauth
```

## 2. GitHub OAuth App の作成

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセス
2. 「OAuth Apps」→「New OAuth App」をクリック
3. 以下の情報を入力:
   - **Application name**: `PasteHost`
   - **Homepage URL**: `https://github.com/your-username/PasteHost`
   - **Authorization callback URL**: `https://pastehost-oauth.netlify.app/api/github-callback`
4. 「Register application」をクリック
5. **Client ID** をメモ
6. 「Generate a new client secret」をクリックして **Client Secret** をメモ

## 3. Netlify OAuth App の作成

1. [Netlify OAuth Applications](https://app.netlify.com/user/applications) にアクセス
2. 「OAuth」タブ →「New OAuth App」をクリック
3. 以下の情報を入力:
   - **Application name**: `PasteHost`
   - **Redirect URI**: `https://pastehost-oauth.netlify.app/api/netlify-oauth-callback`
4. 「Save」をクリック
5. **Client ID** と **Secret** をメモ

## 4. 環境変数の設定

```bash
# GitHub OAuth の認証情報を設定
netlify env:set GITHUB_CLIENT_ID <your-github-client-id>
netlify env:set GITHUB_CLIENT_SECRET <your-github-client-secret>

# Netlify OAuth の認証情報を設定
netlify env:set NETLIFY_OAUTH_CLIENT_ID <your-netlify-client-id>
netlify env:set NETLIFY_OAUTH_CLIENT_SECRET <your-netlify-client-secret>

# CSRF対策用の署名シークレットを生成・設定
# ランダムな秘密鍵を生成
openssl rand -base64 32
# 生成された値を設定
netlify env:set STATE_SECRET <generated-secret>
```

## 5. Netlify Functions のデプロイ

```bash
# プレビューデプロイ（テスト用）
mise run netlify-deploy-preview

# 本番デプロイ
mise run netlify-deploy
```

## 6. Chrome 拡張機能の URL 更新

`src/lib/github-oauth.ts` と `src/lib/netlify-oauth.ts` の `OAUTH_BASE_URL` を実際のサイト URL に更新:

```typescript
const OAUTH_BASE_URL = "https://pastehost-oauth.netlify.app";
```

## 7. 動作確認

1. Chrome 拡張機能をリビルド: `mise run build`
2. Chrome で拡張機能をリロード
3. Options ページで「Sign in with GitHub」または「Sign in with Netlify」をクリック
4. 認可画面で許可
5. 認証完了後、ユーザー名が表示されることを確認

## ローカル開発

Netlify Functions をローカルで実行:

```bash
mise run netlify-dev
```

ローカル実行時は各 OAuth ファイルの URL を変更:

```typescript
const OAUTH_BASE_URL = "http://localhost:8888";
```

## トラブルシューティング

### 「OAuth credentials not configured」エラー

環境変数が設定されていません:

```bash
netlify env:list  # 設定確認

# GitHub の場合
netlify env:set GITHUB_CLIENT_ID <value>
netlify env:set GITHUB_CLIENT_SECRET <value>

# Netlify の場合
netlify env:set NETLIFY_OAUTH_CLIENT_ID <value>
netlify env:set NETLIFY_OAUTH_CLIENT_SECRET <value>
```

### 「STATE_SECRET not configured」エラー

CSRF対策用の署名シークレットが設定されていません:

```bash
# ランダムな秘密鍵を生成
openssl rand -base64 32
# 生成された値を設定
netlify env:set STATE_SECRET <generated-secret>
```

### 「Invalid or expired state parameter」エラー

OAuth フローの state パラメータが無効または期限切れです。
以下の原因が考えられます:
- 認証開始から10分以上経過した
- 別のタブ/セッションで開始した認証フロー
- STATE_SECRET が auth と callback で異なる（デプロイ中の更新など）

対処: 再度「Sign in」をクリックして認証をやり直してください。

### 「redirect_uri mismatch」エラー

OAuth App の callback URL と Netlify Functions の URL が一致していません。
GitHub Developer Settings または Netlify OAuth Applications で callback URL を確認してください。

### Chrome 拡張で OAuth フローが開始しない

`manifest.json` に `identity` 権限と `host_permissions` が設定されているか確認:

```json
{
  "permissions": ["identity", ...],
  "host_permissions": [
    "https://pastehost-oauth.netlify.app/*"
  ]
}
```

## 必要な環境変数一覧

| 環境変数 | 説明 |
|---------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App の Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App の Client Secret |
| `NETLIFY_OAUTH_CLIENT_ID` | Netlify OAuth App の Client ID |
| `NETLIFY_OAUTH_CLIENT_SECRET` | Netlify OAuth App の Secret |
| `STATE_SECRET` | CSRF対策用署名シークレット（共通） |

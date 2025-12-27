# Chrome 拡張機能での OAuth 実装ガイド

Chrome 拡張機能で OAuth を実装する際のベストプラクティスとノウハウをまとめたドキュメントです。

## 目次

1. [基本概念](#基本概念)
2. [2つのアプローチ](#2つのアプローチ)
3. [launchWebAuthFlow の使い方](#launchwebauthflow-の使い方)
4. [バックエンドを使ったトークン交換](#バックエンドを使ったトークン交換)
5. [拡張機能 ID の固定](#拡張機能-id-の固定)
6. [よくある問題と解決策](#よくある問題と解決策)
7. [セキュリティベストプラクティス](#セキュリティベストプラクティス)

---

## 基本概念

### なぜ Chrome 拡張機能で OAuth が特殊なのか

Chrome 拡張機能は `chrome-extension://` プロトコルで動作するため、通常の OAuth フロー（リダイレクト、Cookie 設定）が使えません。そのため、Chrome Identity API を使用する必要があります。

### 必要な権限

```json
{
  "permissions": ["identity", "storage"]
}
```

### リダイレクト URL のパターン

Chrome は特殊なリダイレクト URL パターンを使用します：

```
https://<extension-id>.chromiumapp.org/*
```

この URL は実際には存在しませんが、Chrome がインターセプトして拡張機能にコールバックを返します。

---

## 2つのアプローチ

### 1. `chrome.identity.getAuthToken()` - Google 専用

Google アカウント認証に最適化されたメソッド。トークンの取得・キャッシュ・更新を自動で処理します。

```javascript
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }
  console.log('Token:', token);
});
```

**注意**: Brave など他の Chromium ベースブラウザでは動作しない場合があります。

### 2. `chrome.identity.launchWebAuthFlow()` - 汎用

GitHub、Netlify、Auth0 など、あらゆる OAuth プロバイダーで使用可能。

```javascript
const redirectUrl = chrome.identity.getRedirectURL('callback');
const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=gist`;

chrome.identity.launchWebAuthFlow(
  { url: authUrl, interactive: true },
  (responseUrl) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    // responseUrl からトークンを抽出
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    // または hash からトークンを取得
    const hash = url.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
  }
);
```

---

## launchWebAuthFlow の使い方

### 基本的なフロー

1. `chrome.identity.getRedirectURL()` でリダイレクト URL を取得
2. OAuth プロバイダーの認証 URL を構築
3. `launchWebAuthFlow()` でポップアップを開く
4. ユーザーが認証を完了
5. プロバイダーが `chromiumapp.org` URL にリダイレクト
6. Chrome がこれをインターセプトし、ポップアップを閉じる
7. コールバック関数に最終 URL が渡される

### 重要なポイント

#### リダイレクト URL の取得

```javascript
// パス付きで取得（推奨）
const redirectUrl = chrome.identity.getRedirectURL('callback');
// 結果: https://<extension-id>.chromiumapp.org/callback

// パスなしで取得
const redirectUrl = chrome.identity.getRedirectURL();
// 結果: https://<extension-id>.chromiumapp.org/
// 注意: 末尾のスラッシュが問題になる場合あり
```

#### OAuth プロバイダーへの登録

OAuth アプリケーションの Callback URL として、以下の形式で登録が必要：

```
https://<extension-id>.chromiumapp.org/callback
```

### フローの終了検知

`launchWebAuthFlow` は以下の条件でフローを終了します：

1. ポップアップ内の URL が `https://<extension-id>.chromiumapp.org/*` パターンにマッチした時
2. ユーザーがポップアップを閉じた時

**重要**: Chrome は `redirect_uri` パラメータで指定した URL ではなく、`chromiumapp.org` パターンのみを検知します。

---

## バックエンドを使ったトークン交換

### なぜバックエンドが必要なのか

1. **Client Secret の保護**: OAuth の `client_secret` は拡張機能のコードに含めてはいけない
2. **Authorization Code Flow**: 多くのプロバイダーは認可コードとトークンの交換にサーバーサイドを要求

### アーキテクチャパターン

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Chrome 拡張    │      │  バックエンド   │      │  OAuth Provider │
│                 │      │  (Netlify等)    │      │  (GitHub等)     │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │  1. 認証URL取得        │                        │
         │───────────────────────>│                        │
         │                        │                        │
         │  2. 認証URLを返却      │                        │
         │<───────────────────────│                        │
         │                        │                        │
         │  3. launchWebAuthFlow でユーザー認証            │
         │─────────────────────────────────────────────────>
         │                        │                        │
         │  4. 認可コードでリダイレクト                    │
         │<─────────────────────────────────────────────────
         │                        │                        │
         │  5. 認可コードをバックエンドへ                  │
         │───────────────────────>│                        │
         │                        │  6. トークン交換       │
         │                        │───────────────────────>│
         │                        │                        │
         │                        │  7. アクセストークン   │
         │                        │<───────────────────────│
         │                        │                        │
         │  8. トークンを返却     │                        │
         │<───────────────────────│                        │
         │                        │                        │
```

### 実装例（現在のプロジェクトのパターン）

#### クライアント側（拡張機能）

```javascript
async function startOAuth() {
  // 1. 拡張機能のリダイレクト URL を取得
  const extensionRedirectUrl = chrome.identity.getRedirectURL('callback');

  // 2. バックエンドから認証 URL を取得（拡張機能の redirect URL を渡す）
  const response = await fetch(
    `${BACKEND_URL}/api/oauth-auth?extension_redirect=${encodeURIComponent(extensionRedirectUrl)}`
  );
  const { authUrl } = await response.json();

  // 3. OAuth フローを開始
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        // 4. URL フラグメントからトークンを抽出
        const url = new URL(responseUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        resolve(accessToken);
      }
    );
  });
}
```

#### サーバー側（Netlify Functions）

```javascript
// /api/oauth-auth - 認証 URL 生成
export default async (req) => {
  const url = new URL(req.url);
  const extensionRedirect = url.searchParams.get('extension_redirect');

  // コールバック URL に拡張機能のリダイレクト先を含める
  const callbackUrl = new URL(`${url.origin}/api/oauth-callback`);
  callbackUrl.searchParams.set('extension_redirect', extensionRedirect);

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('scope', 'gist');

  return Response.json({ authUrl: authUrl.toString() });
};

// /api/oauth-callback - トークン交換とリダイレクト
export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const extensionRedirect = url.searchParams.get('extension_redirect');

  // トークン交換
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = await tokenResponse.json();

  // 拡張機能の URL にトークンを含めてリダイレクト
  const redirectUrl = new URL(extensionRedirect);
  redirectUrl.hash = `access_token=${encodeURIComponent(access_token)}`;

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
};
```

---

## 拡張機能 ID の固定

### なぜ ID を固定するのか

- OAuth の Callback URL に拡張機能 ID が含まれる
- 開発中に ID が変わると OAuth 設定を毎回変更する必要がある
- 公開後も一貫した ID を維持できる

### manifest.json に `key` を追加

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "key": "MIIBIjANBgkqhki..."
}
```

### key の取得方法

#### 方法1: Chrome Developer Dashboard から

1. 拡張機能を .zip でパッケージ化
2. Chrome Developer Dashboard にアップロード（公開しない）
3. Package タブ → View public key
4. `-----BEGIN PUBLIC KEY-----` と `-----END PUBLIC KEY-----` の間のテキストをコピー
5. 改行を削除して1行にする

#### 方法2: インストール済み拡張機能から

1. `chrome://version` で Profile Path を確認
2. `<PROFILE_PATH>/Extensions/<EXT_ID>/<version>/manifest.json` を開く
3. `key` プロパティをコピー

### 注意事項

- Chrome Web Store にアップロードする際は `key` を削除
- ビルドプロセスで自動的に削除するのがベスト

---

## よくある問題と解決策

### 問題1: "Authorization page is not loaded"

**原因**: ポップアップが開けない、または URL が不正

**解決策**:
- `interactive: true` を設定しているか確認
- URL が正しいか確認
- ネットワーク接続を確認

### 問題2: ポップアップが閉じない

**原因**: リダイレクト URL が `chromiumapp.org` パターンにマッチしない

**解決策**:
- OAuth プロバイダーの Callback URL 設定を確認
- バックエンドが正しい URL にリダイレクトしているか確認
- 拡張機能の ID が一致しているか確認

### 問題3: トークンが取得できない

**原因**: URL フラグメントまたはクエリパラメータの解析エラー

**解決策**:
```javascript
// フラグメントから取得
const hash = url.hash.substring(1);
const params = new URLSearchParams(hash);
const token = params.get('access_token');

// クエリパラメータから取得
const code = url.searchParams.get('code');
```

### 問題4: getAuthToken が他のブラウザで動作しない

**原因**: `getAuthToken` は Chrome でのみ完全にサポート

**解決策**: `launchWebAuthFlow` を使用

---

## redirect_uri の制約と state パラメータの活用

### 問題: redirect_uri にクエリパラメータを含められない

多くの OAuth プロバイダー（GitHub、Netlify など）は、登録された `redirect_uri` と**完全一致**を要求します。

```
# 登録された URI
https://example.com/api/callback

# ❌ これはエラーになる（クエリパラメータ付き）
https://example.com/api/callback?extension_redirect=https://xxx.chromiumapp.org

# ✅ これは成功（完全一致）
https://example.com/api/callback
```

### 解決策: state パラメータに追加データを含める

`state` パラメータは CSRF 対策だけでなく、任意のデータを渡すのにも使えます：

```javascript
// state の構造（Base64エンコード + 署名）
interface StateData {
  timestamp: number;
  randomId: string;
  extensionRedirect?: string;  // 追加データ
}

// 生成
const data = {
  timestamp: Date.now(),
  randomId: crypto.randomUUID(),
  extensionRedirect: "https://xxx.chromiumapp.org/callback"
};
const payload = btoa(JSON.stringify(data));
const signature = await hmacSign(payload, secret);
const state = `${payload}.${signature}`;

// 検証時にデータを取り出す
const [payload, signature] = state.split(".");
const data = JSON.parse(atob(payload));
const extensionRedirect = data.extensionRedirect;
```

### アーキテクチャ（改善版）

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Chrome 拡張    │      │  バックエンド   │      │  OAuth Provider │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │  1. auth?extension_redirect=xxx                 │
         │───────────────────────>│                        │
         │                        │                        │
         │  2. authUrl (state に extensionRedirect 含む)   │
         │<───────────────────────│                        │
         │                        │                        │
         │  3. launchWebAuthFlow(authUrl)                  │
         │─────────────────────────────────────────────────>
         │                        │                        │
         │  4. callback?code=xxx&state=yyy                 │
         │                        │<───────────────────────│
         │                        │                        │
         │                        │  5. state から extensionRedirect を取得
         │                        │  6. トークン交換       │
         │                        │───────────────────────>│
         │                        │                        │
         │                        │  7. アクセストークン   │
         │                        │<───────────────────────│
         │                        │                        │
         │  8. 302 → extensionRedirect#access_token=xxx    │
         │<───────────────────────│                        │
         │                        │                        │
         │  9. Chrome がインターセプト、ポップアップを閉じる
         │                        │                        │
```

---

## セキュリティベストプラクティス

### 1. Client Secret をクライアントに含めない

```javascript
// ❌ 悪い例
const CLIENT_SECRET = 'abc123secret';

// ✅ 良い例
// バックエンドでトークン交換を行う
```

### 2. State パラメータで CSRF 対策

```javascript
// 認証開始時
const state = generateRandomString();
sessionStorage.setItem('oauth_state', state);
authUrl.searchParams.set('state', state);

// コールバック時
const returnedState = url.searchParams.get('state');
const savedState = sessionStorage.getItem('oauth_state');
if (returnedState !== savedState) {
  throw new Error('State mismatch - possible CSRF attack');
}
```

### 3. トークンの安全な保存

```javascript
// chrome.storage.local を使用（より安全）
await chrome.storage.local.set({ accessToken: token });

// 取得
const { accessToken } = await chrome.storage.local.get('accessToken');
```

### 4. トークンのスコープを最小限に

```javascript
// ❌ 悪い例
const scopes = ['repo', 'user', 'admin:org'];

// ✅ 良い例
const scopes = ['gist']; // 必要最小限
```

### 5. HTTPS のみ使用

バックエンドは必ず HTTPS で提供する。

---

## 参考リンク

- [Chrome Identity API 公式ドキュメント](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [MDN - identity.launchWebAuthFlow](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow)
- [Chrome Extension OAuth チュートリアル](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
- [manifest.json key フィールド](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- [Chrome Extension OAuth with Google (xiegerts.com)](https://www.xiegerts.com/post/chrome-extension-oauth-web-auth-flow-firebase-google/)
- [GitHub OAuth in Chrome Extensions (DEV Community)](https://dev.to/artem_turlenko/simplifying-chrome-extension-development-with-github-oauth-55i6)
- [Chrome Extensions OAuth (plavos.com)](https://plavos.com/blog/chrome-extensions-oauth/)
- [Chrome Extension OAuth Token Exchange (xiegerts.com)](https://www.xiegerts.com/post/chrome-extension-google-oauth-access-token/)

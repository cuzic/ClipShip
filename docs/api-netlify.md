# Netlify API 仕様書

## 概要

ClipShip では、クリップボードのHTMLコードをNetlifyに即座にデプロイするために Netlify API を使用する。

## 認証

### Personal Access Token (PAT)

1. Netlify ダッシュボード → User settings → Applications → Personal access tokens
2. トークンを生成
3. リクエストヘッダーに含める:

```
Authorization: Bearer <YOUR_PERSONAL_ACCESS_TOKEN>
```

## エンドポイント

### 新規サイト作成 + ZIPデプロイ（推奨）

ClipShip では、1回のリクエストでサイト作成とデプロイを同時に行う。

```
POST https://api.netlify.com/api/v1/sites
```

#### リクエスト

**Headers:**
```
Authorization: Bearer <TOKEN>
Content-Type: application/zip
```

**Body:**
- ZIPファイルのバイナリデータ

#### cURL例

```bash
curl -X POST \
  -H "Authorization: Bearer my-api-access-token" \
  -H "Content-Type: application/zip" \
  --data-binary "@website.zip" \
  https://api.netlify.com/api/v1/sites
```

#### レスポンス

**Status:** `201 Created`

```json
{
  "id": "site-id-xxx",
  "state": "current",
  "name": "random-name-12345",
  "url": "http://random-name-12345.netlify.app",
  "ssl_url": "https://random-name-12345.netlify.app",
  "admin_url": "https://app.netlify.com/sites/random-name-12345",
  "deploy_url": "https://deploy-id--random-name-12345.netlify.app",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "published_deploy": {
    "id": "deploy-id",
    "state": "ready",
    "url": "https://random-name-12345.netlify.app"
  }
}
```

**ClipShip で使用するフィールド:**
- `url` または `ssl_url`: 公開URL（ユーザーに表示・コピー）

### 既存サイトへのデプロイ

```
POST https://api.netlify.com/api/v1/sites/{site_id}/deploys
```

#### リクエスト

**Headers:**
```
Authorization: Bearer <TOKEN>
Content-Type: application/zip
```

**Body:**
- ZIPファイルのバイナリデータ

#### cURL例

```bash
curl -X POST \
  -H "Authorization: Bearer my-api-access-token" \
  -H "Content-Type: application/zip" \
  --data-binary "@website.zip" \
  https://api.netlify.com/api/v1/sites/xxx-xxxx-xxx-xxxx/deploys
```

### ドラフトデプロイ

本番に影響を与えずにプレビューしたい場合:

```
POST https://api.netlify.com/api/v1/sites/{site_id}/deploys?draft=true
```

## ZIPファイルの構造

```
website.zip
└── index.html
```

ClipShip では `index.html` のみを含むZIPを生成する。

## デプロイ状態

ZIPデプロイ後、サイトは以下の状態を遷移する:

1. `uploading` - アップロード中
2. `processing` - 処理中
3. `ready` - 公開完了

`state` が `ready` になった時点でサイトが公開される。

## エラーレスポンス

```json
{
  "code": 401,
  "message": "Access denied"
}
```

| コード | 説明 |
|--------|------|
| 401 | 認証エラー（トークン無効） |
| 403 | 権限不足 |
| 422 | バリデーションエラー |
| 500 | サーバーエラー |

## 制限事項

- ZIPファイル内のファイル数: 最大25,000個
- 大きなファイルは処理に時間がかかる場合がある

## TypeScript 型定義（zod スキーマ）

```typescript
import { z } from "zod";

export const NetlifyDeployResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
  name: z.string(),
  url: z.string().url(),
  ssl_url: z.string().url(),
  admin_url: z.string().url(),
  deploy_url: z.string().url().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  published_deploy: z.object({
    id: z.string(),
    state: z.string(),
    url: z.string().url(),
  }).optional(),
});

export type NetlifyDeployResponse = z.infer<typeof NetlifyDeployResponseSchema>;
```

## 参考リンク

- [Netlify API Documentation](https://docs.netlify.com/api/get-started/)
- [Deploy a zip file to a production website](https://developers.netlify.com/guides/deploy-zip-file-to-production-website/)
- [Netlify Open API](https://open-api.netlify.com/)

# GitHub Gist API 仕様書

## 概要

ClipShip では、クリップボードのHTMLコードをGitHub Gistに保存し、GistHack経由でHTMLとしてレンダリングするために GitHub Gist API を使用する。

## 認証

### Personal Access Token (PAT)

1. GitHub → Settings → Developer settings → Personal access tokens
2. トークンを生成（必要なスコープ: `gist`）
3. リクエストヘッダーに含める:

```
Authorization: token <YOUR_PERSONAL_ACCESS_TOKEN>
```

または Bearer 形式:

```
Authorization: Bearer <YOUR_PERSONAL_ACCESS_TOKEN>
```

### 必要なスコープ

| トークンタイプ | 必要な権限 |
|--------------|-----------|
| Classic PAT | `gist` スコープ |
| Fine-grained PAT | Gists: Read and Write |

## エンドポイント

### Gist 作成

```
POST https://api.github.com/gists
```

#### リクエスト

**Headers:**
```
Authorization: token <TOKEN>
Accept: application/vnd.github.v3+json
Content-Type: application/json
```

**Body:**
```json
{
  "description": "Deployed via ClipShip",
  "public": true,
  "files": {
    "index.html": {
      "content": "<!DOCTYPE html>..."
    }
  }
}
```

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| files | object | ✅ | ファイル名をキー、contentを値とするオブジェクト |
| description | string | ❌ | Gistの説明 |
| public | boolean | ❌ | `true`: 公開, `false`: 非公開（デフォルト: false） |

**注意:** GistHack を使用するには `public: true` が推奨される。

#### cURL例

```bash
curl -X POST \
  -H "Authorization: token ghp_xxxxxxxxxxxx" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Deployed via ClipShip",
    "public": true,
    "files": {
      "index.html": {
        "content": "<!DOCTYPE html><html><body>Hello</body></html>"
      }
    }
  }' \
  https://api.github.com/gists
```

#### レスポンス

**Status:** `201 Created`

```json
{
  "id": "aa5a315d61ae9438b18d",
  "url": "https://api.github.com/gists/aa5a315d61ae9438b18d",
  "html_url": "https://gist.github.com/username/aa5a315d61ae9438b18d",
  "files": {
    "index.html": {
      "filename": "index.html",
      "type": "text/html",
      "language": "HTML",
      "raw_url": "https://gist.githubusercontent.com/username/aa5a315d61ae9438b18d/raw/abc123def456/index.html",
      "size": 52,
      "truncated": false,
      "content": "<!DOCTYPE html><html><body>Hello</body></html>"
    }
  },
  "public": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "description": "Deployed via ClipShip",
  "owner": {
    "login": "username",
    "id": 12345
  }
}
```

**ClipShip で使用するフィールド:**
- `files["index.html"].raw_url`: GistHack URLへの変換元

## raw_url の構造

```
https://gist.githubusercontent.com/{user}/{gist_id}/raw/{commit_hash}/{filename}
```

例:
```
https://gist.githubusercontent.com/octocat/aa5a315d/raw/abc123/index.html
```

## GistHack URL 変換

GitHub Gist の raw_url は `Content-Type: text/plain` で返されるため、HTMLとしてレンダリングされない。
GistHack を使用して正しい Content-Type で配信する。

### 変換ロジック

```
gist.githubusercontent.com → gist.githack.com
```

**変換前:**
```
https://gist.githubusercontent.com/user/id/raw/hash/index.html
```

**変換後:**
```
https://gist.githack.com/user/id/raw/hash/index.html
```

### TypeScript 実装

```typescript
function convertToGistHackUrl(rawUrl: string): string {
  return rawUrl.replace(
    "gist.githubusercontent.com",
    "gist.githack.com"
  );
}
```

## エラーレスポンス

```json
{
  "message": "Validation Failed",
  "errors": [
    {
      "resource": "Gist",
      "code": "missing_field",
      "field": "files"
    }
  ],
  "documentation_url": "https://docs.github.com/rest/gists/gists#create-a-gist"
}
```

| ステータス | 説明 |
|-----------|------|
| 401 | 認証エラー（トークン無効） |
| 403 | 権限不足（gist スコープがない） |
| 422 | バリデーションエラー（files が空など） |
| 404 | リソースが見つからない |

## 注意事項

- ファイル名に `gistfile` + 数字サフィックス（例: `gistfile1.txt`）を使用しない
  - Gist 内部の自動命名スキーマと競合する
- 大きなファイルは `truncated: true` になる可能性がある

## TypeScript 型定義（zod スキーマ）

```typescript
import { z } from "zod";

const GistFileSchema = z.object({
  filename: z.string(),
  type: z.string(),
  language: z.string().nullable(),
  raw_url: z.string().url(),
  size: z.number(),
  truncated: z.boolean(),
  content: z.string().optional(),
});

const GistOwnerSchema = z.object({
  login: z.string(),
  id: z.number(),
});

export const GistResponseSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  html_url: z.string().url(),
  files: z.record(z.string(), GistFileSchema),
  public: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  description: z.string().nullable(),
  owner: GistOwnerSchema.optional(),
});

export type GistResponse = z.infer<typeof GistResponseSchema>;
export type GistFile = z.infer<typeof GistFileSchema>;
```

## 参考リンク

- [GitHub Gist REST API](https://docs.github.com/en/rest/gists/gists)
- [Create a gist](https://docs.github.com/en/rest/gists/gists#create-a-gist)
- [GistHack](https://raw.githack.com/) - Gist を正しい Content-Type で配信

# Surge.sh API Notes

## 結論: REST API なし

Surge.sh は **REST API を提供していません**。デプロイは CLI (`surge` コマンド) 経由でのみ可能です。

## 調査結果

### 公式情報
- 公式サイト: https://surge.sh/
- ヘルプページ: https://surge.sh/help/
- npm パッケージ: https://www.npmjs.com/package/surge

### デプロイ方法
Surge.sh でのデプロイは以下の方法のみ:

1. **CLI 直接実行**
   ```bash
   surge ./dist --domain your-app.surge.sh
   ```

2. **CI/CD での自動デプロイ**
   ```bash
   surge --project ./dist --domain your-app.surge.sh --token $SURGE_TOKEN
   ```

3. **npm スクリプト経由**
   ```json
   {
     "scripts": {
       "deploy": "surge ./dist"
     }
   }
   ```

### Node.js からのプログラム実行
`surge` パッケージを Node.js から呼び出すことは技術的に可能ですが、
内部で CLI と同じフローを実行するため、ブラウザ拡張機能からは利用不可能。

```javascript
// これは Node.js 環境でのみ動作
var surge = require('surge')({ default: 'publish' });
surge(['--project', './dist', '--domain', 'example.surge.sh']);
```

## PasteHost への適用

ブラウザ拡張機能から Surge.sh にデプロイするには:
- REST API が必要だが、存在しない
- CLI は Node.js 環境が必要
- **結論: PasteHost では Surge.sh をサポートできない**

## 代替サービス
- Netlify (REST API あり) ✓
- Vercel (REST API あり) ✓
- Cloudflare Pages (REST API あり) ✓
- GitHub Gist (REST API あり) ✓

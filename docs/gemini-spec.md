承知しました。**Netlify（正規ホスティング）** と **GitHub Gist + GistHack（手軽な単一ファイル共有）** の両方を選べる「デュアルデプロイ拡張」として仕様書を修正します。

これにより、用途に応じて「しっかりしたサイト（Netlify）」と「使い捨てのモック（Gist）」を使い分けることが可能になります。

-----

# ブラウザ拡張機能仕様書（改訂版）

## 1\. 概要

クリップボードのテキスト（HTMLコード等）を取得し、ユーザーの選択に応じて **Netlify** または **GitHub Gist** に即座にデプロイし、公開URLを取得するChrome拡張機能。

## 2\. 機能要件

### A. 共通機能

  * **オプション設定:**
      * Netlify Personal Access Token の保存
      * GitHub Personal Access Token の保存
  * **クリップボード取得:** 現在のクリップボード内のテキストを取得し、HTMLテンプレート（`index.html`）に埋め込む。

### B. Netlify デプロイモード（Webサイト向け）

1.  メモリ上で `index.html` を含むZIPファイルを生成。
2.  Netlify API (`POST /sites`) にZIPを送信。
3.  戻り値の `ssl_url` (例: `https://xxx.netlify.app`) を表示・コピー。

### C. Gist + GistHack デプロイモード（モック/メモ向け）

1.  GitHub API (`POST /gists`) で `index.html` を含むGistを作成。
2.  戻り値の `raw_url` を取得。
3.  **URL変換ロジック:**
      * From: `https://gist.githubusercontent.com/user/id/raw/hash/index.html`
      * To:   `https://gist.githack.com/user/id/raw/hash/index.html`
4.  変換後のURLを表示・コピー。

-----

## 3\. 実装設計

### 📂 プロジェクト構成（変更なし）

```text
my-deploy-extension/
├── manifest.json
├── popup.html
├── popup.js      <-- ロジック追加
├── options.html  <-- GitHubトークン入力欄追加
├── options.js
└── lib/
    └── jszip.min.js
```

### 1\. manifest.json

GitHub APIへのアクセス権限を追加します。

```json
{
  "manifest_version": 3,
  "name": "Instant Dual Deployer",
  "version": "2.0",
  "permissions": [
    "clipboardRead", 
    "storage"
  ],
  "host_permissions": [
    "https://api.netlify.com/*",
    "https://api.github.com/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": false
  }
}
```

### 2\. popup.html

ボタンを2つに分けます。

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { width: 320px; padding: 15px; font-family: sans-serif; display: flex; flex-direction: column; gap: 10px; }
        .btn-group { display: flex; gap: 10px; }
        button { flex: 1; padding: 12px; border: none; cursor: pointer; border-radius: 4px; font-weight: bold; color: white; }
        
        #btn-netlify { background: #00AD9F; } /* Netlify Color */
        #btn-netlify:hover { background: #008f83; }
        
        #btn-gist { background: #333; } /* GitHub Color */
        #btn-gist:hover { background: #222; }

        #status { margin-top: 10px; word-break: break-all; font-size: 12px; line-height: 1.4; }
        .success { color: green; }
        .error { color: red; }
    </style>
    <script src="lib/jszip.min.js"></script>
    <script src="popup.js"></script>
</head>
<body>
    <h3>Deploy from Clipboard</h3>
    <div class="btn-group">
        <button id="btn-netlify">Netlify</button>
        <button id="btn-gist">GistHack</button>
    </div>
    <div id="status"></div>
</body>
</html>
```

### 3\. popup.js

Netlify用のロジックと、Gist用のロジックを分岐させます。

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    
    // 共通: HTML生成
    const createHtml = (text) => `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Instant Page</title>
</head>
<body>
${text}
</body>
</html>`;

    // 共通: 結果表示処理
    const showResult = async (url) => {
        statusDiv.innerHTML = `<span class="success">Success!</span><br><a href="${url}" target="_blank">${url}</a>`;
        await navigator.clipboard.writeText(url);
        statusDiv.innerHTML += "<br><br>Copied to clipboard! ✅";
    };

    // 共通: エラー処理
    const showError = (msg) => {
        console.error(msg);
        statusDiv.innerHTML = `<span class="error">Error: ${msg}</span>`;
    };

    // --- A. Netlify Deploy Logic ---
    document.getElementById('btn-netlify').addEventListener('click', async () => {
        statusDiv.textContent = "Packing & Uploading to Netlify...";
        
        try {
            const token = await getStorageData('netlifyToken');
            if (!token) throw new Error("Netlify Token not set in Options.");

            const text = await navigator.clipboard.readText();
            if (!text) throw new Error("Clipboard is empty.");

            const zip = new JSZip();
            zip.file("index.html", createHtml(text));
            const zipBlob = await zip.generateAsync({ type: "blob" });

            const response = await fetch('https://api.netlify.com/api/v1/sites', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/zip'
                },
                body: zipBlob
            });

            if (!response.ok) throw new Error("Netlify API Error");
            
            const data = await response.json();
            await showResult(data.url); // data.ssl_url でも可

        } catch (e) { showError(e.message); }
    });

    // --- B. Gist + GistHack Logic ---
    document.getElementById('btn-gist').addEventListener('click', async () => {
        statusDiv.textContent = "Creating Gist...";

        try {
            const token = await getStorageData('githubToken');
            if (!token) throw new Error("GitHub Token not set in Options.");

            const text = await navigator.clipboard.readText();
            if (!text) throw new Error("Clipboard is empty.");

            // Gist作成
            const payload = {
                description: "Deployed via Instant Deployer Extension",
                public: true, // GistHackを使うためpublic推奨
                files: {
                    "index.html": {
                        "content": createHtml(text)
                    }
                }
            };

            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("GitHub API Error");

            const data = await response.json();
            const rawUrl = data.files['index.html'].raw_url;

            // URL変換: gist.githubusercontent.com -> gist.githack.com
            // rawUrl例: https://gist.githubusercontent.com/USER/ID/raw/HASH/index.html
            const githackUrl = rawUrl.replace('gist.githubusercontent.com', 'gist.githack.com');
            
            await showResult(githackUrl);

        } catch (e) { showError(e.message); }
    });
});

// ストレージ取得ヘルパー
function getStorageData(key) {
    return new Promise(resolve => chrome.storage.sync.get([key], res => resolve(res[key])));
}
```

### 4\. オプション画面 (options.html)

2つのトークンを保存できるようにします。

```html
<!DOCTYPE html>
<html>
<body>
    <h2>Deployer Settings</h2>
    
    <label>Netlify Personal Access Token:</label><br>
    <input type="password" id="netlifyToken" style="width: 300px;"><br><br>
    
    <label>GitHub Personal Access Token (Scope: gist):</label><br>
    <input type="password" id="githubToken" style="width: 300px;"><br><br>
    
    <button id="save">Save</button>
    <span id="msg"></span>

    <script>
        // 保存処理
        document.getElementById('save').addEventListener('click', () => {
            const netlifyToken = document.getElementById('netlifyToken').value;
            const githubToken = document.getElementById('githubToken').value;
            chrome.storage.sync.set({ netlifyToken, githubToken }, () => {
                document.getElementById('msg').textContent = 'Saved!';
                setTimeout(() => document.getElementById('msg').textContent = '', 2000);
            });
        });
        
        // 読み込み処理
        chrome.storage.sync.get(['netlifyToken', 'githubToken'], (items) => {
            if(items.netlifyToken) document.getElementById('netlifyToken').value = items.netlifyToken;
            if(items.githubToken) document.getElementById('githubToken').value = items.githubToken;
        });
    </script>
</body>
</html>
```

-----

## 補足：GistHackの仕組みについて

GistのRaw URLは `Content-Type: text/plain` で返されるため、そのままではブラウザでHTMLとしてレンダリングされません。
`gist.githack.com` は、そのRaw URLの中身をプロキシし、正しい `Content-Type: text/html` を付与して配信してくれるサービスです。

  * **URL置換ロジック:** 単純にドメインを置換するだけで機能します。
      * 元: `https://gist.githubusercontent.com/...`
      * 新: `https://gist.githack.com/...`

これで、\*\*「安定版デプロイ(Netlify)」**と**「簡易版デプロイ(GistHack)」\*\*の両方に対応した強力なツールになります。

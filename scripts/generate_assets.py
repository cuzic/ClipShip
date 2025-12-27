#!/usr/bin/env python3
"""
PasteHost Chrome Web Store 用画像アセット生成スクリプト
Gemini Image Generation API を使用して画像を生成
"""

import os
import sys
import json
import base64
import argparse
import requests
from pathlib import Path

# .env ファイルを読み込み
try:
    from dotenv import load_dotenv
    # スクリプトの親ディレクトリ（プロジェクトルート）の .env を読み込み
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)
except ImportError:
    pass  # python-dotenv がなければ環境変数のみ使用

# 環境変数から API キーを取得
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    print("エラー: GEMINI_API_KEY 環境変数が設定されていません")
    print("  .env ファイルに設定するか、環境変数として export してください")
    sys.exit(1)

# 出力ディレクトリ
OUTPUT_DIR = Path(__file__).parent.parent / "assets"

# 利用可能なモデル
AVAILABLE_MODELS = {
    "gemini-3-pro": "gemini-3-pro-image-preview",
    "gemini-2.5-flash": "gemini-2.5-flash-preview-05-20",
    "imagen-3": "imagen-3.0-generate-002",
}
DEFAULT_MODEL = "gemini-3-pro"

# 画像生成のプロンプト定義
IMAGE_PROMPTS = {
    "icon": {
        "title": "PasteHost アイコン (128x128)",
        "prompt": """Create a modern app icon for "PasteHost" - a clipboard deployment tool.

DESIGN:
- Square icon with rounded corners (like iOS/Android app icons)
- Size: 128x128 pixels
- Background: Gradient from deep blue #1976D2 to purple #7B1FA2

MAIN ELEMENTS:
- Center: A stylized clipboard icon (white outline, slightly tilted)
- On the clipboard: A rocket ship launching upward 🚀
- The rocket has a small flame trail (orange #FF9800 to yellow #FFEB3B gradient)
- Small cloud/deploy icons around the rocket

STYLE:
- Modern, flat design with subtle shadows
- Clean lines, minimalist
- Professional but friendly
- The clipboard represents "copy" and the rocket represents "deploy/ship"

COLOR PALETTE:
- Primary: #1976D2 (blue)
- Secondary: #7B1FA2 (purple)
- Accent: #FF9800 (orange), #FFEB3B (yellow)
- Icons: White #FFFFFF

NO TEXT - icon only.""",
        "filename": "icon128.png"
    },
    "promo_small": {
        "title": "Small Promo Tile (440x280)",
        "prompt": """Create a promotional banner for "PasteHost" Chrome extension.

SIZE: 440x280 pixels (landscape)

BACKGROUND:
- Gradient from dark blue #0D47A1 on left to purple #4A148C on right
- Subtle grid pattern overlay (tech feel)

LEFT SIDE (40%):
- Large "PasteHost" text in white, bold modern font
- Below: "Clipboard → Web" in smaller text
- Small rocket emoji 🚀

RIGHT SIDE (60%):
- Illustration showing the workflow:
  1. Clipboard icon (white) with code/markdown inside
  2. Arrow pointing right
  3. Browser window showing a beautiful webpage
  4. Netlify and GitHub logos (small, subtle)

BOTTOM:
- Small icons representing features:
  - Markdown icon (M↓)
  - Code brackets { }
  - Diagram/flowchart icon
  - Lightning bolt (fast)

STYLE:
- Modern, tech-focused design
- Clean and professional
- High contrast for readability
- Chrome Web Store promotional tile aesthetic""",
        "filename": "promo_small_440x280.png"
    },
    "promo_large": {
        "title": "Large Promo Tile (920x680)",
        "prompt": """Create a large promotional banner for "PasteHost" Chrome extension.

SIZE: 920x680 pixels (landscape)

BACKGROUND:
- Dark gradient: #0D47A1 (blue) to #311B92 (deep purple)
- Subtle geometric patterns (hexagons, dots)

HEADER (top 30%):
- "PasteHost" logo/text - large, white, modern sans-serif font
- Tagline: "Deploy Clipboard to Web Instantly" in light blue #64B5F6
- Small rocket icon next to logo

CENTER (main area, 50%):
- Three-step workflow illustration:

  STEP 1 (left):
  - Clipboard icon with "Ctrl+C" badge
  - Sample content showing Markdown/HTML code
  - Label: "Copy"

  STEP 2 (center):
  - PasteHost extension popup mockup
  - Two buttons: "Netlify" and "Gist"
  - Label: "Click"

  STEP 3 (right):
  - Browser showing rendered webpage
  - Beautiful formatted content with code highlighting
  - URL bar showing netlify.app domain
  - Label: "Live!"

- Curved arrows connecting the steps

BOTTOM (20%):
- Feature icons in a row:
  - "HTML" with checkmark
  - "Markdown" with checkmark
  - "Syntax Highlighting" with code icon
  - "Mermaid Diagrams" with flowchart icon
  - "Instant Deploy" with lightning icon

FOOTER:
- Netlify logo (small)
- GitHub logo (small)
- "Free & Open Source" badge

STYLE:
- Professional SaaS/developer tool aesthetic
- Clean, modern, high-tech feel
- Easy to understand workflow
- Appealing to developers""",
        "filename": "promo_large_920x680.png"
    },
    "screenshot_popup": {
        "title": "Screenshot - Popup UI (1280x800)",
        "prompt": """Create a screenshot mockup for PasteHost Chrome extension popup.

SIZE: 1280x800 pixels

BACKGROUND:
- A code editor (VS Code style) showing Markdown content
- Dark theme editor with syntax highlighting
- The Markdown contains:
  ```markdown
  # Hello World

  This is a **demo** of PasteHost.

  ```javascript
  console.log('Hello!');
  ```
  ```

POPUP OVERLAY (center-right):
- Chrome extension popup window (300px wide)
- White background with shadow
- Header: "PasteHost" with small rocket icon
- Two large buttons:
  1. "Deploy to Netlify" - Blue button #1976D2
  2. "Deploy to Gist" - Green button #388E3C
- Status area showing: "Ready to deploy"
- Small settings gear icon in corner

ANNOTATION ARROWS:
- Arrow from clipboard icon to popup: "1. Copy content"
- Arrow from Netlify button: "2. Click to deploy"
- Arrow pointing to imaginary browser: "3. Get shareable URL"

BOTTOM BANNER:
- Light overlay with text: "One-click deployment for HTML, Markdown & more"

STYLE:
- Realistic Chrome browser mockup
- Professional screenshot for Chrome Web Store
- Clear, easy to understand workflow""",
        "filename": "screenshot_popup_1280x800.png"
    },
    "screenshot_result": {
        "title": "Screenshot - Deploy Result (1280x800)",
        "prompt": """Create a screenshot showing PasteHost deployment result.

SIZE: 1280x800 pixels

MAIN CONTENT:
- Browser window showing a deployed webpage
- URL bar: "https://pastehost-abc123.netlify.app/xyz789/index.html"
- Green lock icon (HTTPS)

WEBPAGE CONTENT (rendered Markdown):
- Clean, beautiful rendered page with:
  - Large heading "# Project Documentation"
  - Formatted paragraphs
  - Code block with syntax highlighting (JavaScript)
  - A Mermaid flowchart diagram showing:
    ```
    graph TD
      A[Start] --> B{Decision}
      B -->|Yes| C[Action 1]
      B -->|No| D[Action 2]
    ```
  - Bullet list
  - Table with data

POPUP OVERLAY (bottom-right):
- PasteHost popup showing success state:
  - Green checkmark ✓
  - "Success!" text
  - URL link (clickable)
  - "Copied to clipboard!" message

ANNOTATION:
- Callout bubble: "Instant live preview!"
- Arrow pointing to Mermaid diagram: "Mermaid diagrams supported"
- Arrow pointing to code: "Syntax highlighting"

STYLE:
- Realistic browser mockup
- Shows the power of the extension
- Professional and polished""",
        "filename": "screenshot_result_1280x800.png"
    },
    "screenshot_options": {
        "title": "Screenshot - Options Page (1280x800)",
        "prompt": """Create a screenshot of PasteHost options/settings page.

SIZE: 1280x800 pixels

BROWSER WINDOW:
- Chrome browser with extension options page
- URL: "chrome-extension://xxx/options.html"

OPTIONS PAGE CONTENT:
- Clean white background
- Header: "PasteHost Settings" with gear icon

FORM SECTIONS:

Section 1 - Netlify:
- Netlify logo (teal color)
- Label: "Netlify Personal Access Token"
- Password input field (dots showing hidden token)
- Help text: "Get token from app.netlify.com → User Settings → Applications"
- Link: "Get your token →"

Section 2 - GitHub:
- GitHub logo (black)
- Label: "GitHub Personal Access Token"
- Password input field
- Help text: "Requires 'gist' scope"
- Link: "Create token →"

BOTTOM:
- "Save" button (blue #1976D2)
- "Saved!" success message with checkmark

SIDEBAR INFO:
- "About PasteHost" section
- Version: 1.0.0
- Links: Documentation, Report Issue, Privacy Policy

STYLE:
- Clean settings page design
- Clear form layout
- Professional Chrome extension options aesthetic
- Easy to understand where to get tokens""",
        "filename": "screenshot_options_1280x800.png"
    }
}


def generate_image_with_gemini(prompt: str, title: str, model_id: str) -> bytes:
    """Gemini API を使用して画像を生成"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseModalities": ["image", "text"],
            "responseMimeType": "text/plain"
        }
    }

    print(f"🎨 {title} を生成中... (モデル: {model_id})")
    response = requests.post(
        url,
        headers=headers,
        json=payload,
        timeout=180
    )

    if response.status_code != 200:
        print(f"エラー: Gemini API リクエスト失敗 (ステータス: {response.status_code})")
        print(f"レスポンス: {response.text}")
        return None

    result = response.json()

    # レスポンスから画像データを取得
    try:
        candidates = result.get('candidates', [])
        if not candidates:
            print(f"エラー: 画像が生成されませんでした")
            print(f"レスポンス: {json.dumps(result, indent=2, ensure_ascii=False)}")
            return None

        parts = candidates[0].get('content', {}).get('parts', [])

        # inline_data を探す
        image_data = None
        for part in parts:
            if 'inlineData' in part:
                image_data = part['inlineData'].get('data')
                break

        if not image_data:
            print(f"エラー: 画像データが見つかりません")
            print(f"レスポンス: {json.dumps(result, indent=2, ensure_ascii=False)}")
            return None

        # Base64 デコード
        return base64.b64decode(image_data)

    except Exception as e:
        print(f"エラー: レスポンスの解析に失敗しました: {e}")
        print(f"レスポンス: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return None


def save_image(image_data: bytes, filename: str):
    """画像を保存"""
    OUTPUT_DIR.mkdir(exist_ok=True)
    filepath = OUTPUT_DIR / filename

    with open(filepath, 'wb') as f:
        f.write(image_data)

    print(f"💾 保存完了: {filepath}")
    return filepath


def create_icon_sizes(base_icon_path: Path):
    """128x128 アイコンから他のサイズを生成"""
    try:
        from PIL import Image

        img = Image.open(base_icon_path)

        sizes = [16, 32, 48]
        for size in sizes:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = OUTPUT_DIR / f"icon{size}.png"
            resized.save(output_path)
            print(f"📐 リサイズ完了: {output_path}")

    except ImportError:
        print("⚠️  Pillow がインストールされていません。アイコンのリサイズをスキップします。")
        print("   pip install Pillow でインストールしてください。")


def parse_args():
    """コマンドライン引数をパース"""
    parser = argparse.ArgumentParser(
        description="PasteHost Chrome Web Store 用画像アセット生成"
    )
    parser.add_argument(
        "-m", "--model",
        choices=list(AVAILABLE_MODELS.keys()),
        default=DEFAULT_MODEL,
        help=f"使用するモデル (デフォルト: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        "-l", "--list-models",
        action="store_true",
        help="利用可能なモデル一覧を表示"
    )
    parser.add_argument(
        "-t", "--target",
        choices=list(IMAGE_PROMPTS.keys()) + ["all"],
        default="all",
        help="生成する画像 (デフォルト: all)"
    )
    return parser.parse_args()


def main():
    """メイン処理"""
    args = parse_args()

    # モデル一覧表示
    if args.list_models:
        print("利用可能なモデル:")
        for short_name, model_id in AVAILABLE_MODELS.items():
            default_mark = " (デフォルト)" if short_name == DEFAULT_MODEL else ""
            print(f"  {short_name}: {model_id}{default_mark}")
        sys.exit(0)

    model_id = AVAILABLE_MODELS[args.model]

    print("=" * 60)
    print("PasteHost 画像アセット生成スクリプト")
    print(f"モデル: {model_id}")
    print("=" * 60)
    print()

    # 生成対象を決定
    if args.target == "all":
        targets = IMAGE_PROMPTS
    else:
        targets = {args.target: IMAGE_PROMPTS[args.target]}

    results = {}
    icon_path = None

    for image_id, config in targets.items():
        print(f"\n{'='*60}")
        print(f"{image_id}: {config['title']}")
        print(f"{'='*60}\n")

        # 画像生成
        image_data = generate_image_with_gemini(config['prompt'], config['title'], model_id)

        if not image_data:
            print(f"❌ {image_id} の生成に失敗しました")
            results[image_id] = {"success": False}
            continue

        print(f"✅ 画像生成完了 ({len(image_data)} bytes)")

        # 保存
        filepath = save_image(image_data, config['filename'])

        results[image_id] = {
            "success": True,
            "filename": config['filename'],
            "path": str(filepath)
        }

        # アイコンのパスを保存
        if image_id == "icon":
            icon_path = filepath

    # アイコンのリサイズ
    if icon_path and icon_path.exists():
        print(f"\n{'='*60}")
        print("アイコンのリサイズ (16, 32, 48px)")
        print(f"{'='*60}\n")
        create_icon_sizes(icon_path)

    # 結果サマリー
    print(f"\n{'='*60}")
    print("生成結果サマリー")
    print(f"{'='*60}\n")

    success_count = 0
    for image_id, result in results.items():
        if result['success']:
            print(f"✅ {image_id}: {result.get('filename')}")
            success_count += 1
        else:
            print(f"❌ {image_id}: 失敗")

    print(f"\n成功: {success_count}/{len(IMAGE_PROMPTS)}")
    print(f"\n出力ディレクトリ: {OUTPUT_DIR}")

    # public フォルダへのコピー案内
    print(f"\n{'='*60}")
    print("次のステップ")
    print(f"{'='*60}")
    print("""
生成されたアイコンを public フォルダにコピー:
  cp assets/icon*.png public/

manifest.json にアイコンを追加:
  "icons": {
    "16": "icon16.png",
    "32": "icon32.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
""")


if __name__ == "__main__":
    main()

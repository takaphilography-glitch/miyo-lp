# 美夜 miyo - 撮影会LP

被写体・美夜（miyo）の撮影会ご予約ページ。

## スタック
- **配信**: Vercel（Static）
- **構成**: 単一HTML（`index.html`） / CSS / JS をすべて同梱
- **依存**: なし（Google Fontsのみ外部読み込み）

## 機能
- ヒーロー / プロフィール / 料金 / 衣装リクエスト / 注意事項 / 予約フォーム
- 衣装200着のカテゴリ別リスト（和装60 / コスプレ70 / ドレス30 / カジュアル25 / その他15）
- カテゴリフィルタ + 複数選択 + 自動料金計算（基本料金に1着含む、2着目以降+1,000円）
- 選択状態は `localStorage` に保存（再訪時も維持）
- フォーム送信 → Stripe Payment Linkへ遷移（未設定時は mailto フォールバック）

## ローカルプレビュー
```bash
# Python が入っていれば
python3 -m http.server 5173
# → http://localhost:5173 を開く
```
または `index.html` をブラウザで直接開いてもOK。

## 本番運用前にやること

### 1. Stripe Payment Linkの設定
`index.html` 内の `window.MIYO_CONFIG` を編集：

```js
window.MIYO_CONFIG = {
  stripePaymentLinkUrl: 'https://buy.stripe.com/xxxxxxxxxxxx', // ← 本物のリンク
  contactEmail:         'miyo.booking@example.com'              // ← 受付メール
};
```

`stripePaymentLinkUrl` が空のままだと、フォーム送信時に `contactEmail` 宛のメーラーが起動するフォールバック動作になります。

### 2. 衣装画像の差し替え（任意）
初期状態は文字プレースホルダ。`COSTUMES` 配列の各要素の `image` に画像URL（例: `/images/costume/001.jpg`）を入れると `<img>` で表示されます。

### 3. ヒーロー / プロフィール画像の差し替え（任意）
- `.hero-visual .placeholder` を `<img src="..." alt="美夜">` に置換
- `.about-img .ph` 部分を同様に画像へ置換

### 4. SNSリンク
`og:url` / footer の Instagram リンクが `lagdol_` を指しています。変更が必要なら index.html 内をまとめて置換。

### 5. OGP画像（任意）
`/ogp.png`（推奨 1200x630）をリポジトリ直下に置くとSNSシェア画像になります。

## デプロイ

### Vercel CLI
```bash
npx vercel --prod
```

### Git連携
このリポジトリをVercelプロジェクトに紐付けると、`master` への push で自動デプロイされます。`vercel.json` に静的サイト用の設定（cleanUrls / セキュリティヘッダー）が同梱済み。

## ファイル構成
```
miyo-LP/
├── index.html       # 本体（HTML/CSS/JS同梱・約1,650行）
├── vercel.json      # Vercel設定（cleanUrls + セキュリティヘッダー）
├── .gitignore
└── README.md
```

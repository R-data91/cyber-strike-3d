# CYBER STRIKE 3D (サイバーパンクFPS) - 完成版

ブラウザで動作する超高速・高品位サイバーパンク3Dファーストパーソン・シューター（FPS）。  
Three.js と Web Audio API（ハードリミッター搭載）を駆使し、超高次ウェーブ（100+）でも60FPSを維持する極限の最適化が施されています。

---

## 🎮 操作方法 (Controls)

| キー / 操作 | アクション |
| :--- | :--- |
| **W, A, S, D** | 移動 (前後左右) |
| **マウス移動** | 視点回転 (エイム) |
| **左クリック** | 射撃 (フルオート / バースト / チャージ / 単発) |
| **右クリック (ADS)** | 精密照準 (スナイパー/レールガンADSズーム展開) |
| **Space** | ジャンプ (空中ジャンプ / 低重力滑空) |
| **Shift** | スプリント (高速ダッシュ) |
| **Ctrl / C** | スライディング (地上ダッシュ時) |
| **R** | リロード (手動弾薬装填) |
| **1 〜 6** | 兵装切替 (AK-47 / Shotgun / Railgun / SMG / Launcher / Beam) |
| **G** | 手榴弾投擲 (範囲爆破) |
| **Q** | アドレナリン・バレットタイム (時間減速) |
| **F3** | リアルタイム性能テレメトリモニタ ON/OFF |
| **Esc / P** | ポーズメニュー |

---

## 🚀 ゲームの特徴 & 主なシステム

1. **全6種の多彩なサイバー兵装**
   - `[1] AK-47 タクティカルライフル` : 高連射・高汎用
   - `[2] ヘビーサイバーショットガン` : 近接制圧・重厚打撃
   - `[3] 電磁レールガン` : ADSスコープ・急所超火力
   - `[4] プラズマサブマシンガン` : 超高速レート・機動掃討
   - `[5] 重グレネードランチャー` : 範囲爆砕・大打撃
   - `[6] 収束光線レーザーカノン` : 継続照射・照射時間比例増幅

2. **2丁流・3丁流への進化 (Wield System)**
   - 予備弾薬が **3,000発** を超えると `2丁モード (⚔️ DUAL)` へ進化（発射数倍増）
   - **6,000発** を超えると `3丁モード (🔱 TRI)` へ究極進化（3条同時火線）
   - HUDの弾薬ゲージピップは 青 → 黄 → 橙 → 赤 → 紫 → 虹 へとループ

3. **4大レイドボス & 第100波突破「EXステージ (AETHER ASCENSION)」**
   - 5波ごとに4大レイドボス（蜘蛛要塞、反重力浮遊要塞、殲滅巨神、終焉神官）がランダム襲来
   - 第100波をクリアすると、宇宙へ昇る超軌道昇降機「エーテル・アセンション」へ突入
   - 飛行ドローン・天界ヴァルキリー・多段変形レイドボス「OMEGA-SERAPH」との低重力空中決戦

4. **Web Audio API ハードリミッター音響**
   - `DynamicsCompressorNode` によるマスターリミッターと効果音スロットルを搭載
   - 多数の敵を一括撃破した際や、ウェーブ終了時のアイテム一括回収時でも絶対に音割れ・爆音クリッピングが発生しません。

5. **極限の描画 & DOM最適化**
   - Canvas製弾薬HUD、3D戦術アイテムジオメトリキャッシュ、敵補充スタッガーキューイングを実装
   - 100ステージ以上の長大セッションでもメモリリークなく、60FPSの快適動作を維持。

---

## 🛠️ 開発・実行方法

### 必要な環境
- Node.js (v18以上推奨)
- npm

### 起動手順
```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動 (localhost:5173 または 5175 で自動起動)
npm run dev

# プロダクションビルド
npm run build

# ビルド成果物のプレビュー
npm run preview
```

※ `dist/` フォルダにはビルド済みの静的ファイルが含まれているため、任意のWebサーバーや静的ホスティング（GitHub Pages, Vercel, Netlify等）にそのままデプロイしてプレイ可能です。

---

## 🌐 GitHub Pages へのコマンドライン公開手順 (CLI Deployment)

本リポジトリには `.github/workflows/deploy.yml`（自動ビルド＆デプロイ用 GitHub Actions ワークフロー）および `vite.config.js`（相対パス `base: './'`）が同梱されています。

### パターンA: GitHub CLI (`gh`) を使用する場合（ブラウザ不要・完全コマンド完結）

```bash
# 1. ターミナルで本ディレクトリ（解凍したフォルダ）に移動
cd browser-fps-game

# 2. GitHub CLI でログイン (未ログインの場合)
gh auth login

# 3. Git 初期化 & コミット
git init
git branch -M main
git add .
git commit -m "feat: Initial Cyber Strike 3D deploy"

# 4. GitHub リポジトリの作成とプッシュを1コマンドで実行
gh repo create cyber-strike-3d --public --source=. --remote=origin --push

# 5. GitHub Pages のソースを GitHub Actions に設定
gh api --method POST "repos/{owner}/cyber-strike-3d/pages" -f build_type=workflow
```
> ※ 数十秒後に GitHub Actions が完了し、`https://<ユーザー名>.github.io/cyber-strike-3d/` で全世界に即座に公開されます。

### パターンB: 通常の Git コマンドを使用する場合

```bash
# 1. ターミナルで本ディレクトリに移動
cd browser-fps-game

# 2. Git 初期化 & コミット
git init
git branch -M main
git add .
git commit -m "feat: Cyber Strike 3D deployment"

# 3. GitHub (https://github.com/new) で作成した空リポジトリをリモートに追加
# （※ <username> と <repo-name> をご自身のリポジトリに置き換えてください）
git remote add origin https://github.com/<username>/<repo-name>.git

# 4. main ブランチへプッシュ (GitHub Actions が自動トリガーされます)
git push -u origin main
```
> **最後の一歩（初回のみ）:**
> GitHub のリポジトリ画面で **「Settings」→「Pages」→「Build and deployment」** の **Source** を **「GitHub Actions」** に選択すれば、同梱の `.github/workflows/deploy.yml` により完全自動でビルド＆公開されます。


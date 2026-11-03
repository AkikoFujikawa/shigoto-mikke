# しごとみっけ

**文理選択の前に、自分を知る。** 高校1年生が「好きなこと」と5問の質問から自分の強みのタネを知り、知らなかった職業と、その職業につながる学問に出会う Web アプリです。

- 公開 URL：https://shigoto-mikke.vercel.app
- お試し用の学校コード：`UEDA123`（ニックネームは何でも OK）
- ※ 無料プランで動かしているため、しばらく使われていないと、最初の表示に1分ほどかかります

> ブートキャンプの最終課題として、5人のチームで開発しました（2026年9〜10月）。このリポジトリは、チームのリポジトリを自分のアカウントに移し、自分のアカウントで本番公開し直したものです。

---

## 背景

高校1年生は、まだ自分の強みも職業もよく知らないまま、文系・理系を選んでいます。

- 文理選択で悩みがあった生徒：**42.5%**、選んだあとに後悔した生徒：**約2割**
- 文系を選んだ理由で最も多いのは「**理系科目が苦手だったから**」
- 文理選択の情報源で最も多いのは「**担任の先生（52.1%）**」

（出典：山田進太郎D&I財団 × Studyplusトレンド研究所（2023年））

選ぶ材料が「苦手」に偏っていて、自分の「強み」から考えられていないのでは、と考えました。
そこで、**消去法の文理選択を、強みの発見に変える** ことを目指しました。

## 主な機能

### 生徒（学校コードとニックネームで始める。アカウント登録なし）
1. **好きなことを選ぶ**：12個から1〜3個
2. **自分らしさチェック**：2択の質問を5問
3. **強みのタネ**：5つの強みから3つを示し、AI がやさしい言葉で説明する
4. **職業スワイプ**：強みと好きなことにつながる職業に、気軽に出会う
5. **職業詳細**：仕事の内容、「なぜあなたにつながる？」、関連する学問と文系・理系・複合のつながり

### 学校の先生（管理画面）
- メールアドレスとパスワードでログイン（Firebase Authentication）
- 生徒に配る学校コードの確認・コピー
- 無料体験の残り日数と契約状態の表示、有料プラン（年額）の申し込み（Stripe Checkout）

## 工夫した点

- **AI に「向いている」と決めさせない**：強みは回答の集計で決め、職業はタグの一致で機械的に選ぶ。AI の役割は、決まった強みをわかりやすく伝えることだけにした
- **AI の出力を信用しすぎない**：AI に送るのは選択肢の ID だけ（個人情報や自由記述は送らない）。返ってきた文は形・長さ・禁止語を検証し、使えないときは定型文に切り替える
- **AI を呼ぶ回数を減らす**：同じ強みの組み合わせなら、保存しておいた説明文を再利用する（Redis）
- **職業を文系・理系で決めつけない**：文理のラベルは職業ではなく学問の側にだけ付け、職業と学問のつながりとして見せる
- **未成年のデータは最小限**：生徒は本名もメールアドレスも登録せずに使える

---

## 技術スタック

| 分類 | 使ったもの |
|---|---|
| フロントエンド | Next.js（React）・TypeScript・Tailwind CSS |
| バックエンド | Express・TypeScript・express-validator・Prisma |
| データ | PostgreSQL（Neon）・Redis（Upstash） |
| 認証 | Firebase Authentication（管理者）／学校コード＋ニックネームのセッショントークン（生徒） |
| AI | OpenRouter 経由の `openai/gpt-oss-120b`（Structured Outputs） |
| 決済 | Stripe Checkout・Webhook（テストモード） |
| インフラ | Docker・Render（API）・Vercel（フロント） |
| テスト・品質 | Vitest・Supertest・ESLint・Prettier・GitHub Actions |
| ログ | pino（開発と本番で出力を切り替え） |

## 構成

```
ブラウザ（生徒・先生）
  │
  ├─ フロント：Vercel（Next.js）
  │     └─ Firebase Authentication（先生のログイン）
  │
  └─ API：Render（Docker・Express）
        ├─ PostgreSQL：Neon
        ├─ Redis：Upstash（マスタと AI の説明文のキャッシュ・回数制限）
        ├─ Firebase Admin SDK（先生のトークンを検証）
        ├─ OpenRouter（強みの説明文）
        └─ Stripe（申し込み → Webhook で契約を更新）
```

本番公開の手順は [`docs/plan/デプロイ手順.md`](./docs/plan/デプロイ手順.md) にまとめています。

---

## チーム開発

- 期間：2026年9月21日〜10月18日（4週間）、発表：10月29日
- 発表資料：[STAGE 発表スライド（PDF）](./docs/presentation/stage-2026-10-29.pdf)
- 進め方：Issue → ブランチ → PR → レビュー → マージ（[GitHub 運用ルール](./.github/github-rules-shigotomikke.md)）

| メンバー | 担当 |
|---|---|
| まり（リーダー） | 設計（決済・AI）、管理者ログイン、管理画面、職業の画面 |
| あきこ | 決済（Stripe）、マッチング、キャッシュ、ログ、CI |
| ななこ | 生徒画面の実装、共通デザイン部品、画面遷移の修正、本番デプロイ |
| ひろみ | 職業画像の制作、生徒画面、デザイン |
| みづき | 環境構築、診断 API、AI 連携、出力チェック、本番デプロイ |

## 私（あきこ）の担当

バックエンドの「決済・基盤」を担当しました。作った PR は16件、ほかのメンバーの PR のレビューは38件です。
（リンクは、このリポジトリに残っているマージコミットです）

| 分類 | 内容 | コミット |
|---|---|---|
| 基盤 | frontend・backend の CI（GitHub Actions）を追加 | [89dabf2](https://github.com/AkikoFujikawa/shigoto-mikke/commit/89dabf232bb844e5a3046770c7ed1e9ea3c39565) |
| 基盤 | 職業・分野・学問領域のマスタデータを seed で投入 | [2684e08](https://github.com/AkikoFujikawa/shigoto-mikke/commit/2684e08ffdcf40ba8c5ebbf559f27010dd759d14) |
| 基盤 | 生徒セッション開始 API と、生徒トークンの検証 | [9743291](https://github.com/AkikoFujikawa/shigoto-mikke/commit/97432917a738bb761b7ecda8eba61e822a37ba31) |
| マッチング | 強みのタネと職業候補を決めるマッチングロジック | [15b4856](https://github.com/AkikoFujikawa/shigoto-mikke/commit/15b4856b06c7bdf72b5faa254ce56c00c2ed0fa4) |
| マッチング | 職業詳細 API | [6f15adc](https://github.com/AkikoFujikawa/shigoto-mikke/commit/6f15adc04666b4f2a32b88911457f57776b91e23) |
| 決済 | 学校の契約状態をサーバー側で判定する API | [bc375e3](https://github.com/AkikoFujikawa/shigoto-mikke/commit/bc375e34a51d26d5f1fe5d81fbf16ef759ac4a2e) |
| 決済 | Stripe Checkout の作成と、決済完了の Webhook（バックエンド） | [44687ab](https://github.com/AkikoFujikawa/shigoto-mikke/commit/44687ab200cb671133993e4af91d25af91dc8bfc) |
| 決済 | 管理画面の申し込みボタンから Checkout へ遷移（フロント） | [01d4c95](https://github.com/AkikoFujikawa/shigoto-mikke/commit/01d4c95947f7d50386eb7ab2c4cb0bf5cac75586) |
| キャッシュ | AI の強みの説明を保存し、同じ組み合わせなら再利用 | [497d3bf](https://github.com/AkikoFujikawa/shigoto-mikke/commit/497d3bff7506b497edadc7a37e6fb74e2c6d4c29) |
| キャッシュ | Redis が止まっているときに API の応答が遅くなる問題を修正 | [cb8b2d7](https://github.com/AkikoFujikawa/shigoto-mikke/commit/cb8b2d7343ec73bcaadbd45956d9891ddd6d1f7c) |
| ログ | AI の文を使えなかった理由をログに出し、ログを pino にそろえる | [e619f51](https://github.com/AkikoFujikawa/shigoto-mikke/commit/e619f514792ef5283f34b662065847a9c838888e) |
| 本番 | 本番（Render）の中継の後ろで、生徒の IP を正しく読む | [47261a8](https://github.com/AkikoFujikawa/shigoto-mikke/commit/47261a89eadff617f8ecadde8582903e1e3957c0) |
| 見た目 | アプリのロゴを、スライドと同じロゴ画像にそろえる | [440b4ad](https://github.com/AkikoFujikawa/shigoto-mikke/commit/440b4ad3ad97828811ecc6b1a3c97cd9f54f1c0c) |
| 見た目 | 好きなこと・質問・強みのアイコンを、台の形をそろえてイラストにする | [c68f21c](https://github.com/AkikoFujikawa/shigoto-mikke/commit/c68f21c49f2c7d1e6d1b296d2b84c6633417a1de)・[f6464dd](https://github.com/AkikoFujikawa/shigoto-mikke/commit/f6464dd6e39cf54aac6481c26c03f72a87332a3f) |
| 企画 | 企画検討の段階の企画案の資料に、根拠を追記 | [810c5b9](https://github.com/AkikoFujikawa/shigoto-mikke/commit/810c5b9a82e612027d6066bb8bfa0a26164ffbab) |

チーム開発のあと、自分のアカウントで Neon・Upstash・Firebase・OpenRouter・Stripe・Render・Vercel を用意し、本番を公開し直しました（[デプロイ手順](./docs/plan/デプロイ手順.md)）。

---

## ローカルでの動かし方

前提：Docker Desktop

```bash
# 1. 環境変数を用意する（値は各サービスで発行したものを入れる。Git には含めない）
cp .env.example .env

# 2. frontend / backend / postgres / redis を起動する
docker compose up -d

# 3. マイグレーションと初期データの投入
docker compose exec backend pnpm prisma migrate dev
docker compose exec backend pnpm prisma db seed
```

| サービス | URL・ポート |
|---|---|
| frontend | http://localhost:3000 |
| backend | http://localhost:4000 |
| postgres | 5433（ホスト側） |
| redis | 6379 |

テスト（バックエンド）：`docker compose exec backend pnpm test`

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [要件定義](./docs/plan/要件定義.md) | 目的、ペルソナ、機能・非機能要件 |
| [技術選定](./docs/plan/技術選定.md) | 選定理由・比較・リスクと対応 |
| [画面設計](./docs/plan/画面設計.md) | 画面一覧、遷移、各画面の仕様 |
| [API 設計](./docs/plan/API設計.md) | エンドポイント、エラー、レート制限、認可 |
| [DB 設計](./docs/plan/DB設計.md) | ER 図、テーブル定義、seed のルール |
| [テスト設計書](./docs/plan/テスト設計書.md)・[テストシナリオ](./docs/plan/テストシナリオ.md) | テスト方針と結果、手動テストの手順 |
| [将来の拡張](./docs/plan/将来の拡張.md) | 今回やらなかったことと、拡張しやすくするための設計 |
| [デプロイ手順](./docs/plan/デプロイ手順.md) | 自分のアカウントでの本番公開の手順 |
| [チーム開発中の README](./docs/plan/チーム開発README.md) | 開発中のスコープ・決定事項・スケジュール（当時のまま） |

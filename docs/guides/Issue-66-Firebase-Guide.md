# Issue #66 実装ガイド
## Firebase認証ミドルウェア + 管理者画面

**作成日**: 2026-10-05  
**対象Issue**: #115, #116, #117, #118  
**技術**: Firebase Authentication, Express.js, Next.js, TypeScript

---

## 目次

1. [Issue #115 進め方ガイド](#issue-115-進め方ガイド)
2. [Firebase 完全ガイド](#firebase-完全ガイド)
3. [管理者画面の動き説明](#管理者画面の動き説明)

---

# Issue #115 進め方ガイド

## Firebase検証ミドルウェア実装

初めての方でも進められるように、ステップバイステップで説明します。

### 📋 はじめに：何をするのか

**目的**: Express API でリクエストの Authorization ヘッダーから Firebase ID トークンを取得・検証し、ユーザー情報をリクエストに追加するミドルウェアを作る

**わかりやすく言うと**:
```
管理者がログイン画面でメール・パスワードを入力
  ↓ Firebase が ID トークンを発行
  ↓ フロントが API 呼び出し時にトークンを送る
  ↓ バック（このミドルウェア）がトークンを検証 ← これ！
  ↓ 有効ならユーザー情報を取得して API へ渡す
```

---

## ✅ Step 0: 事前準備（必ず確認）

### 0-1. 環境確認

```bash
cd /Users/apple/Desktop/Section9_teamC

# Firebase環境変数が .env に設定されているか確認
cat .env | grep FIREBASE

# Firebase Admin SDK がインストールされているか確認
cd backend
pnpm list firebase-admin
# → firebase-admin がリストに出ていればOK
```

### 0-2. #43 が完了しているか確認

```bash
# seed 実行（管理者データが DB に投入される）
docker compose exec -T backend pnpm prisma db seed

# 実行後、ターミナルに以下のような出力があるか確認：
# [seed] デモ校投入完了: schools=4
```

### 0-3. 依存するファイルを確認

```bash
# Prisma のスキーマ（school_admins テーブルの構造）
cat backend/prisma/schema.prisma | grep -A 10 "model SchoolAdmin"
```

✅ 上記 3つ確認できたら進みましょう

---

## 🏗️ Step 1: ミドルウェアファイルを作成する

### 1-1. ファイルを作成

```bash
cd /Users/apple/Desktop/Section9_teamC/backend

# ディレクトリを確認
ls -la src/middleware/

# ファイルを作成
touch src/middleware/firebase-auth.ts
```

### 1-2. ファイルの位置を確認

```
backend/
  src/
    middleware/
      firebase-auth.ts  ← ここに作成（新規ファイル）
    routes/
    controllers/
    services/
```

---

## 📝 Step 2: ミドルウェアの構造を理解する

**ミドルウェアとは**:
```
リクエスト → ミドルウェア（検証・加工） → ルートハンドラ（API処理）
```

**このミドルウェアの構造**:
```typescript
import { Request, Response, NextFunction } from 'express'

// 1. Firebase Admin SDK を初期化
// 2. リクエストから Authorization ヘッダーを取得
// 3. トークンを検証
// 4. Firebase UID → DB から school_admins を検索
// 5. req.user に情報をセット
// 6. next() で次のルートハンドラへ渡す

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ここに処理を書く
}
```

---

## 💻 Step 3: 実装の流れ（4つの部分）

### 3-1. Firebase Admin SDK の初期化

**やること**: Firebase 環境変数を読み込んで Admin SDK をセットアップ

```typescript
// firebase-auth.ts の先頭に追加
import admin from 'firebase-admin'

// 環境変数から Firebase 認証情報を読み込む
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
}

admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
})
```

**ポイント**:
- `process.env.FIREBASE_*` は `.env` から自動で読み込まれる
- 同じコード内で複数回 `initializeApp()` を呼ばないこと（エラーになる）

---

### 3-2. Authorization ヘッダーからトークンを抽出

**やること**: リクエストのヘッダーから `Authorization: Bearer <token>` のトークン部分を取り出す

```typescript
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Authorization ヘッダーを取得
  const authHeader = req.headers.authorization
  
  // 2. "Bearer <token>" 形式か確認
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'トークンがありません' }
    })
  }
  
  // 3. "Bearer " を削除して トークン部分だけ抽出
  const idToken = authHeader.substring(7) // "Bearer ".length = 7
  
  // 次へ
}
```

**ポイント**:
- `Authorization: Bearer abc123def456` なら `abc123def456` を抽出
- `Bearer ` がなかったら 401 エラー

---

### 3-3. Firebase でトークンを検証

**やること**: トークンが本物か、期限切れでないか、Firebase で確認

```typescript
try {
  // Firebase でトークンを検証
  const decodedToken = await admin.auth().verifyIdToken(idToken)
  
  // デコードされたトークンから firebaseUid を取得
  const firebaseUid = decodedToken.uid
  
  // 次へ
} catch (error) {
  // トークンが無効・期限切れ・改ざんされている
  return res.status(401).json({
    error: { code: 'UNAUTHORIZED', message: 'トークンが無効です' }
  })
}
```

**ポイント**:
- `verifyIdToken()` が成功 → トークンは有効
- 成功 → `decodedToken.uid` から Firebase UID を取得
- 失敗 → catch ブロックで 401 エラー

---

### 3-4. Firebase UID から DB で管理者を検索

**やること**: 取得した Firebase UID を使って、DB の school_admins テーブルから管理者情報を検索

```typescript
import { prisma } from '../lib/prisma.js' // Prisma クライント

const schoolAdmin = await prisma.schoolAdmin.findUnique({
  where: { firebaseUid },
  include: { school: true }
})

if (!schoolAdmin) {
  // DB に管理者が見つからない（登録されていない）
  return res.status(403).json({
    error: { code: 'FORBIDDEN', message: '権限がありません' }
  })
}

// 見つかった → req.user にセット
req.user = {
  role: 'school_admin',
  id: schoolAdmin.id,
  schoolId: schoolAdmin.schoolId
}

next() // 次のルートハンドラへ
```

**ポイント**:
- Firebase UID が DB に存在 → ユーザー情報を取得
- 存在しない → 403（禁止）エラー
- 成功 → `next()` で次へ進める

---

## 🧪 Step 4: テストの方法

### 4-1. ユニットテストを作成

**ファイル**: `backend/tests/middleware/firebase-auth.test.ts` (新規)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticateAdmin } from '../../src/middleware/firebase-auth'

describe('Firebase Auth Middleware', () => {
  // テストケース 1: 有効なトークンで成功
  it('有効な ID トークンで req.user をセット', async () => {
    // Mock Firebase と Prisma
    // → トークン検証を成功させる
    // → DB から管理者情報を取得する
    
    // ミドルウェアを実行
    // 結果: req.user.role === 'school_admin'
  })
  
  // テストケース 2: トークンなしで 401
  it('Authorization ヘッダーなし → 401', async () => {
    // ミドルウェアを実行（ヘッダーなし）
    // 結果: res.status === 401
  })
  
  // テストケース 3: 無効なトークンで 401
  it('無効なトークン → 401', async () => {
    // Mock Firebase でトークン検証を失敗させる
    // 結果: res.status === 401
  })
  
  // テストケース 4: Firebase UID が DB に存在しない → 403
  it('Firebase UID が DB に存在しない → 403', async () => {
    // Mock Firebase でトークン検証を成功
    // Mock Prisma でユーザー検索を失敗
    // 結果: res.status === 403
  })
})
```

**テスト実行方法**:
```bash
cd backend
pnpm test tests/middleware/firebase-auth.test.ts
```

---

### 4-2. API テストで動作確認

**ファイル**: `backend/tests/routes/admin.test.ts` (新規 or 既存に追加)

```typescript
import request from 'supertest'
import { app } from '../../src/index'

describe('Admin Routes', () => {
  it('GET /v1/me 認証なし → 401', async () => {
    const res = await request(app).get('/v1/me')
    expect(res.status).toBe(401)
  })
  
  it('GET /v1/me 認証あり → 200 + 情報返却', async () => {
    const res = await request(app)
      .get('/v1/me')
      .set('Authorization', `Bearer ${mockIdToken}`)
    
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('school_admin')
  })
})
```

**実行方法**:
```bash
cd backend
pnpm test tests/routes/admin.test.ts
```

---

## 🔗 Step 5: 実装後のチェック

実装が完了したら、以下を確認してください：

### 5-1. ファイルの場所を確認
```bash
ls -la backend/src/middleware/firebase-auth.ts
# → ファイルが存在するか確認
```

### 5-2. インポートのテスト
```bash
cd backend
pnpm tsc --noEmit
# → TypeScript エラーがないか確認（型チェック）
```

### 5-3. テストが通るか
```bash
cd backend
pnpm test tests/middleware/firebase-auth.test.ts
# → 全テストが通るか確認
```

### 5-4. Linter / Formatter を実行
```bash
cd backend
pnpm lint --fix
# → コード整形
```

---

## 📤 Step 6: PR を作成

### 6-1. ブランチを作成

```bash
git checkout -b feature/firebase-middleware-115
```

### 6-2. ファイルをステージ

```bash
git add backend/src/middleware/firebase-auth.ts
git add backend/tests/middleware/firebase-auth.test.ts
git add backend/tests/routes/admin.test.ts  # if created
```

### 6-3. コミット

```bash
git commit -m "feat: Firebase ID トークン検証ミドルウェアを実装（#115）"
```

### 6-4. PR を作成

```bash
gh pr create --title "feat: Firebase ID トークン検証ミドルウェア実装 #115" \
  --body "Firebase Admin SDK でトークンを検証し、school_admins テーブルから管理者情報を取得するミドルウェアを実装しました。"
```

---

## 🎯 完了チェックリスト

実装が完了したら、以下をすべてチェック ✅

- [ ] `backend/src/middleware/firebase-auth.ts` が作成されている
- [ ] Firebase Admin SDK の初期化処理がある
- [ ] Authorization ヘッダーからトークンを抽出している
- [ ] Firebase でトークンを検証している
- [ ] DB から管理者情報を取得している
- [ ] 未認証は 401、DB に存在しないなら 403 を返している
- [ ] ユニットテスト 4ケース以上ある
- [ ] API テストで認証なし・あり の両方をテストしている
- [ ] `pnpm test` がすべて通っている
- [ ] `pnpm lint` でエラーがない
- [ ] PR がレビュー可能な大きさ（400行以内）

---

# Firebase 完全ガイド

## 初心者向けFirebase解説

### 🔥 Firebase とは何か

**Firebase = Google が提供する「サーバーレス」サービス**

```
従来の方法（複雑）:
  ユーザー
    ↓
  我が社のサーバー（認証・ユーザー管理・パスワード暗号化など全部やる）
    ↓
  DB

Firebase を使う（簡単）:
  ユーザー
    ↓
  Firebase（認証・パスワード管理・セキュリティ全部 Google がやる）
    ↓
  我が社のサーバー
    ↓
  DB
```

**わかりやすく言うと**:
> 「メール・パスワードでログインできる機能」を Google がサーバーを提供してくれるので、自分たちでは実装しなくていい

---

### 🎯 このプロジェクトでの Firebase の役割

#### 生徒（学生）

```
従来：学校コード + ニックネーム でログイン
  （パスワード不要、簡単）
```

#### 管理者（先生）

```
Firebase 使う：メール + パスワード でログイン
  ├─ セキュアなので先生用
  ├─ パスワードは Firebase が暗号化
  └─ 複数の先生がいても管理できる
```

---

### 📋 Firebase の 3つの機能（このプロジェクトで使うもの）

#### 1️⃣ **Authentication（認証）**

**何か**: メール・パスワードでログインできる機能

```
フロント（JavaScript）
  ↓
  firebase.auth().signInWithEmailAndPassword(email, password)
  ↓
Firebase サーバー
  ├─ メール存在するか確認
  ├─ パスワード合っているか確認
  └─ OK → UID と ID トークンを発行
  ↓
フロント
  ├─ ID トークン を sessionStorage に保存
  └─ 以降の API 呼び出しに付ける
```

---

#### 2️⃣ **ID トークン（JWT）**

**何か**: ログイン状態を証明する「身分証明書」

```
例：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMxMjNkZWY...

これは実は JSON：
{
  "uid": "abc123def456",        ← Firebase が自動作成した ID
  "email": "demo@example.com",
  "iat": 1628853600,            ← 発行時刻
  "exp": 1628857200,            ← 有効期限（8時間後）
}
```

**このトークンを使って**:
```
フロント → バック
  GET /v1/me
  Authorization: Bearer eyJhbGc...
  
バック
  → Firebase に「このトークン本物？」と確認
  → OK なら UID を抽出
  → DB から管理者情報を取得
```

---

#### 3️⃣ **Admin SDK（バック用）**

**何か**: バック側から Firebase を操作するためのツール

```
バック（Node.js）
  ↓
  admin.auth().verifyIdToken(token)
  ↓
Firebase サーバー
  ├─ トークンが本物か確認
  ├─ 署名をチェック
  ├─ 有効期限をチェック
  └─ OK → UID を返す
```

---

### 🏗️ Firebase セットアップ（必須）

#### Step 1️⃣: Firebase Project を作成

**Google アカウントでログイン**:
```
https://console.firebase.google.com
  ↓
[プロジェクトを作成]
  ↓
プロジェクト名：shigoto-mikke
  ↓
[続行]
```

---

#### Step 2️⃣: Authentication を有効にする

```
Firebase コンソール
  ↓
左メニュー → Build → Authentication
  ↓
[使ってみる]
  ↓
Sign-in method：Email/Password を選択
  ↓
[有効にする]
```

---

#### Step 3️⃣: テスト用の管理者アカウントを作成

```
Firebase コンソール
  ↓
Authentication → Users タブ
  ↓
[ユーザーを追加]
  ↓
Email：demo-trial@example.com
Password：password123
  ↓
[ユーザーを作成]
```

**自動生成される UID をコピー**:
```
例：aBcDeF123456789ghIjKlMnOpQrS

これを backend/prisma/seed.ts に入力
```

---

#### Step 4️⃣: Firebase 認証情報を取得

```
Firebase コンソール
  ↓
左メニュー → Project Settings（歯車アイコン）
  ↓
Service Accounts タブ
  ↓
[新しい秘密鍵を生成]
  ↓
JSON ファイルがダウンロードされる
  ↓
内容をコピーして .env に設定
```

**.env に追加**:
```bash
FIREBASE_PROJECT_ID=shigoto-mikke
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@shigoto-mikke.iam.gserviceaccount.com
FIREBASE_AUTH_DOMAIN=shigoto-mikke.firebaseapp.com
```

---

### 💻 フロント（React）での使い方

#### Step 1️⃣: Firebase SDK をインストール

```bash
cd frontend
pnpm add firebase
```

---

#### Step 2️⃣: Firebase を初期化

**ファイル**: `frontend/src/lib/firebase.ts` (新規)

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
```

---

#### Step 3️⃣: ログイン画面で使う

**ファイル**: `frontend/src/app/admin/login/page.tsx`

```typescript
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function LoginPage() {
  const handleLogin = async (email: string, password: string) => {
    try {
      // Step 1️⃣: Firebase にメール・パスワードを送る
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      )
      
      // Step 2️⃣: ID トークンを取得
      const idToken = await userCredential.user.getIdToken()
      console.log('トークンを取得:', idToken)
      
      // Step 3️⃣: sessionStorage に保存
      sessionStorage.setItem('authToken', idToken)
      
      // Step 4️⃣: 管理画面へ遷移
      router.push('/admin')
      
    } catch (error) {
      // ログイン失敗
      console.error('ログイン失敗:', error.message)
      // 画面にエラーメッセージ表示
    }
  }
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      const email = e.target.email.value
      const password = e.target.password.value
      handleLogin(email, password)
    }}>
      <input name="email" type="email" placeholder="メール" />
      <input name="password" type="password" placeholder="パスワード" />
      <button type="submit">ログイン</button>
    </form>
  )
}
```

---

### 🔙 バック（Express）での使い方

#### Step 1️⃣: Firebase Admin SDK をインストール

```bash
cd backend
pnpm add firebase-admin
```

---

#### Step 2️⃣: Firebase を初期化

**ファイル**: `backend/src/middleware/firebase-auth.ts`

```typescript
import admin from 'firebase-admin'

// Firebase を初期化（1回だけ）
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
})

export const authenticateAdmin = async (req, res, next) => {
  try {
    // Step 1️⃣: Authorization ヘッダーからトークンを抽出
    const idToken = req.headers.authorization?.substring(7)
    
    if (!idToken) {
      return res.status(401).json({ error: 'トークンがありません' })
    }
    
    // Step 2️⃣: Firebase でトークンを検証
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    
    // Step 3️⃣: Firebase UID を取得
    const firebaseUid = decodedToken.uid
    console.log('Firebase UID:', firebaseUid)
    
    // Step 4️⃣: DB から管理者を検索
    const schoolAdmin = await prisma.schoolAdmin.findUnique({
      where: { firebaseUid }
    })
    
    if (!schoolAdmin) {
      return res.status(403).json({ error: '権限がありません' })
    }
    
    // Step 5️⃣: req.user にセット
    req.user = {
      role: 'school_admin',
      id: schoolAdmin.id,
      schoolId: schoolAdmin.schoolId
    }
    
    next()
    
  } catch (error) {
    return res.status(401).json({ error: 'トークンが無効です' })
  }
}
```

---

### 🔐 セキュリティのポイント

#### ✅ やること

```typescript
// OK: Firebase UID から DB で情報取得
const admin = await prisma.schoolAdmin.findUnique({
  where: { firebaseUid: decodedToken.uid }
})

// OK: トークンを毎回検証
const decodedToken = await admin.auth().verifyIdToken(idToken)
```

#### ❌ やらないこと

```typescript
// NG: トークンをそのまま信じて使う
const uid = idToken  // これは絶対ダメ

// NG: Firebase UID を DB に保存しないまま使う
// （DB に紐づけがないと、誰でもログインできてしまう）
```

---

### 📊 Firebase の流れ（全体図）

```
┌─────────────────────────────────────────────────┐
│              フロント（React）                   │
│  ログイン画面でメール・パスワード入力           │
│  signInWithEmailAndPassword(email, pwd)         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           Firebase サーバー（Google）            │
│  ├─ メール存在するか確認                        │
│  ├─ パスワード合っているか確認                  │
│  └─ OK → UID と ID トークンを発行              │
└──────────────────┬──────────────────────────────┘
                   │ ID トークン返却
                   ▼
┌─────────────────────────────────────────────────┐
│              フロント（React）                   │
│  sessionStorage に ID トークン保存               │
└──────────────────┬──────────────────────────────┘
                   │
                   │ API 呼び出し時に付ける
                   │ Authorization: Bearer <token>
                   ▼
┌─────────────────────────────────────────────────┐
│            バック（Express）                    │
│  Authorization ヘッダーからトークン抽出          │
│  admin.auth().verifyIdToken(token)              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           Firebase サーバー（Google）            │
│  トークン検証 → UID を返す                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│            バック（Express）                    │
│  Firebase UID → DB の school_admins テーブル    │
│  管理者情報を取得 → req.user にセット           │
└─────────────────────────────────────────────────┘
```

---

### 🎯 初めての方へのチェックリスト

実装前に確認してください:

- [ ] Firebase Console で プロジェクト作成済み
- [ ] Authentication で Email/Password 有効化済み
- [ ] テスト用管理者アカウント作成済み
- [ ] Firebase UID を seed.ts に入力済み
- [ ] Firebase 認証情報を .env に設定済み
- [ ] フロント `.env.example` に `NEXT_PUBLIC_FIREBASE_*` 追加済み
- [ ] `pnpm add firebase`（フロント）実行済み
- [ ] `pnpm add firebase-admin`（バック）実行済み

---

### ❓ よくある質問

| 質問 | 答え |
|------|------|
| **Firebase UID は何？** | Google が管理者に自動で割り当てた一意のID。我が社の DB に保存して、フロントから送られたトークンと紐づける |
| **ID トークンは何？** | ログイン状態を証明する身分証明書。8時間有効 |
| **毎回トークンを検証する必要？** | Yes。改ざん・期限切れ・削除されたユーザーをチェック |
| **sessionStorage に保存するのなぜ？** | タブを閉じると消えるので、セキュアだから。localStorage は使わない |
| **Firebase には個人情報を送る？** | いいえ。メール・パスワードだけ。ニックネームなど個人情報は送らない |

---

# 管理者画面の動き説明

## UI-A03 管理画面について

初めての方向けに、**管理者の視点** から説明します。

---

## 🎬 管理者画面とは

**目的**: 学校の先生（管理者）が、契約状態を確認したり、生徒に提供するための決済をする画面

**場所**: `frontend/src/app/admin/page.tsx` (UI-A03)

---

## 📺 画面に表示される内容

```
┌─────────────────────────────────────┐
│      しごとみっけ 管理画面          │
├─────────────────────────────────────┤
│                                     │
│  学校情報                           │
│  ├─ 学校名：上田みらい高等学校      │
│  ├─ 学校コード：UEDA123             │
│  └─ 契約状態：無料体験中            │
│     期限まであと 18日               │
│                                     │
│  ┌─────────────────┐               │
│  │ 契約を開始する  │ ← ボタン      │
│  └─────────────────┘               │
│                                     │
│  ┌─────────────┐                   │
│  │ ログアウト  │ ← ボタン          │
│  └─────────────┘                   │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚶 管理者の実際の操作フロー

### パターン A: 正常系（ログイン → 管理画面表示 → ログアウト）

```
Step 1️⃣: ログイン画面にアクセス
┌─────────────────────────┐
│ http://localhost:3000/admin/login
│
│ メール：demo-trial@example.com
│ パスワード：password123
│
│ [ログイン] ボタンをクリック
└─────────────────────────┘
   ↓
   
Step 2️⃣: バックエンド（ミドルウェア）で検証
   Firebase：「OK、UID は abc123def456」
   DB：「この管理者は id=5, schoolId=7」
   ↓ 認証成功
   
Step 3️⃣: 管理画面へリダイレクト
┌─────────────────────────┐
│ http://localhost:3000/admin
│
│ 学校情報が表示される
│ 名前：上田みらい高等学校
│ 状態：無料体験中
│ 期限：18日
└─────────────────────────┘
   ↓
   
Step 4️⃣: [ログアウト] をクリック
   sessionStorage をクリア（トークン削除）
   ↓
   ログイン画面へリダイレクト
```

---

### パターン B: エラー系（未ログインで /admin にアクセス）

```
Step 1️⃣: 未ログイン状態で URL を直入力
┌──────────────────────────────┐
│ http://localhost:3000/admin
│
│ （sessionStorage にトークンがない）
└──────────────────────────────┘
   ↓
   
Step 2️⃣: フロント（認証ガード）が検知
   「あ、ログインしてない」
   ↓
   
Step 3️⃣: 自動的にログイン画面へリダイレクト
┌──────────────────────────────┐
│ http://localhost:3000/admin/login
│
│ メール・パスワード入力欄が表示
└──────────────────────────────┘
```

---

### パターン C: トークン期限切れ（8時間経過後）

```
Step 1️⃣: ログイン済みで管理画面を開いている
┌──────────────────────────────┐
│ http://localhost:3000/admin
│
│ 8時間が経過
│ （sessionStorage のトークン期限切れ）
└──────────────────────────────┘
   ↓
   
Step 2️⃣: 何かボタンをクリック（例：学校情報を再読み込み）
   GET /v1/schools/me
   Authorization: Bearer <期限切れトークン>
   ↓
   
Step 3️⃣: バックエンド
   Firebase：「このトークン期限切れです → 401」
   ↓
   
Step 4️⃣: フロント（エラー処理）
   「401 エラー → 認証されていない」
   ↓
   
Step 5️⃣: ログイン画面へリダイレクト
┌──────────────────────────────┐
│ http://localhost:3000/admin/login
│
│ メール・パスワード入力欄が表示
│ （もう一度ログインしてください）
└──────────────────────────────┘
```

---

## 🛡️ 技術的な流れ

### 画面がロードされるとき（内部処理）

```typescript
// frontend/src/app/admin/page.tsx がロードされる

useEffect(() => {
  // Step 1️⃣: sessionStorage からトークン取得
  const token = sessionStorage.getItem('authToken')
  
  if (!token) {
    // トークンがない → ログイン画面へ
    router.push('/admin/login')
    return
  }
  
  // Step 2️⃣: GET /v1/me でサーバーに検証
  const response = await fetch('/v1/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  if (response.status === 401) {
    // 401: 認証失敗 → ログイン画面へ
    sessionStorage.removeItem('authToken')
    router.push('/admin/login')
    return
  }
  
  if (response.ok) {
    // 200: 認証成功 → 管理者情報を取得
    const userData = await response.json()
    console.log('ログイン中の管理者:', userData)
    // → 画面表示続行
  }
}, [])
```

---

## 📊 画面の 3つの状態

### 状態 1️⃣: 未ログイン状態

```
ユーザー
  ↓ /admin にアクセス
  ↓
フロント（認証ガード）
  → sessionStorage にトークンがない
  → /admin/login へリダイレクト ✅
  
→ 表示：ログイン画面
```

---

### 状態 2️⃣: ログイン済み（有効なトークン）

```
ユーザー
  ↓ /admin にアクセス
  ↓
フロント（認証ガード）
  → sessionStorage にトークンがある
  → GET /v1/me で検証
  
バック
  → Firebase でトークン検証
  → DB から管理者情報取得
  → 200 + 情報返す ✅
  
→ 表示：管理画面（学校情報）
```

---

### 状態 3️⃣: ログイン済み（期限切れトークン）

```
ユーザー
  ↓ /admin にアクセス
  ↓
フロント（認証ガード）
  → sessionStorage にトークンがある
  → GET /v1/me で検証
  
バック
  → Firebase でトークン検証
  → 401（期限切れ）✅
  
フロント
  → 401 エラー検知
  → sessionStorage 削除
  → /admin/login へリダイレクト ✅
  
→ 表示：ログイン画面
```

---

## 🔄 画面の流れ（状態遷移図）

```
           ┌─────────────────┐
           │  ログイン画面   │
           │ /admin/login    │
           └────────┬────────┘
                    │
           [メール・パスワード入力]
           [ログインボタンをクリック]
                    │
                    ▼
        ┌──────────────────────┐
        │ Firebase 認証成功    │
        │ トークン取得         │
        └──────────┬───────────┘
                   │
        sessionStorage に保存
                   │
                   ▼
           ┌─────────────────┐
           │  管理画面       │
           │ /admin          │
           └────────┬────────┘
           ┌────────┴────────┐
           │                 │
        [ログアウト]      [8時間経過]
           │                 │
           ▼                 ▼
        削除 → ログイン画面へ
```

---

## 🎯 管理者が見る画面の内容

### 無料体験中のとき

```
┌────────────────────────────────────┐
│      管理画面                        │
├────────────────────────────────────┤
│                                    │
│  📋 学校情報                        │
│  ├─ 名前：上田みらい高等学校         │
│  ├─ コード：UEDA123                │
│  │                                 │
│  └─ 📅 無料体験中                   │
│     期限まであと 18日               │
│     契約終了日時：2026-10-19 00:00 │
│                                    │
│  💳 決済                            │
│  [契約を開始する] ← Stripe へ       │
│   ↓                                │
│   決済画面へ遷移                    │
│                                    │
│  [ログアウト]                      │
│                                    │
└────────────────────────────────────┘
```

---

### 契約中のとき

```
┌────────────────────────────────────┐
│      管理画面                        │
├────────────────────────────────────┤
│                                    │
│  📋 学校情報                        │
│  ├─ 名前：上田みらい高等学校         │
│  ├─ コード：UEDA123                │
│  │                                 │
│  └─ ✅ 契約中                       │
│     契約終了日時：2027-10-05 00:00│
│                                    │
│  💳 決済                            │
│  （契約中のため表示なし）           │
│                                    │
│  [ログアウト]                      │
│                                    │
└────────────────────────────────────┘
```

---

## 🔧 実装時に呼ぶ API

| API | 何をするか | 呼び出しタイミング |
|-----|----------|----------|
| **GET /v1/me** | ログイン中か確認 | 画面ロード時 |
| **GET /v1/schools/me** | 学校情報を取得 | 画面ロード時 |
| **POST /v1/billing/checkout-session** | Stripe 決済へ遷移 | [契約を開始する] クリック時 |

---

## ✅ チェックリスト（実装完了時）

- [ ] `/admin` にアクセス → ログイン画面へ自動リダイレクト
- [ ] ログイン画面でメール・パスワード入力 → 管理画面へ遷移
- [ ] 管理画面に学校情報が表示される
- [ ] [ログアウト] → ログイン画面へ戻る
- [ ] トークン期限後に API 呼び出し → 401 → ログイン画面へ
- [ ] [契約を開始する] → Stripe へ遷移

---

## まとめ

本ガイドでは、以下を説明しました:

1. **Issue #115**: Firebase検証ミドルウェアの実装方法
2. **Firebase**: 認証の仕組みと初期セットアップ
3. **管理者画面**: ユーザー体験と技術的な流れ

これらの内容を理解することで、Issue #115〜#118 の実装がスムーズに進みます。

質問があれば、お気軽にお聞きください。

---

**作成日**: 2026-10-05  
**版**: 1.0

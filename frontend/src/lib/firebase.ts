import { getApp, getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, initializeAuth, type Auth } from "firebase/auth";

let cachedAuth: Auth | null = null;

// 読み込み時には初期化しない。CI のビルドには NEXT_PUBLIC_FIREBASE_* がないため、
// 使う時点（ログイン操作など）で初期化し、設定漏れはその時に分かるエラーにする。
// ログイン状態はタブごと（sessionStorage）に保持し、タブを閉じると終了する。
export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  // NEXT_PUBLIC_ の値はビルド時に埋め込まれるため、process.env[...] ではなく直接参照する
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Firebase の設定値が未設定です（NEXT_PUBLIC_FIREBASE_*）: ${missing.join(", ")}`,
    );
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  try {
    cachedAuth = initializeAuth(app, { persistence: browserSessionPersistence });
  } catch {
    // 開発時のホットリロードなどで、すでに初期化済みの場合
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

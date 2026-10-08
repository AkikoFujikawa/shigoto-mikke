"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import PageShell from "@/components/PageShell";
import { getFirebaseAuth } from "@/lib/firebase";

// 認証の失敗は、メール・パスワードのどちらが誤りかを特定しない（画面設計 §6）
const AUTH_FAILURE_MESSAGE = "メールアドレスまたはパスワードを確認してください";
const AUTH_FAILURE_CODES = [
  "auth/invalid-credential",
  "auth/invalid-email",
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/user-disabled",
];
const NO_PERMISSION_MESSAGE =
  "このアカウントには管理者権限がありません。運営にお問い合わせください";
const NETWORK_ERROR_MESSAGE = "通信に失敗しました。もう一度お試しください";
const UNAUTHORIZED_MESSAGE = "認証できませんでした。もう一度ログインしてください";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 管理画面のガードから戻されたときは、理由を表示する
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "forbidden") setFormError(NO_PERMISSION_MESSAGE);
    else if (reason === "unauthorized") setFormError(UNAUTHORIZED_MESSAGE);
  }, []);

  useEffect(() => {
    // すでにログインしている場合は管理画面へ（管理者かどうかの確認は、管理画面のガードが行う）
    let cancelled = false;
    (async () => {
      try {
        const auth = getFirebaseAuth();
        await auth.authStateReady();
        if (!cancelled && auth.currentUser) router.replace("/admin");
      } catch {
        // Firebase が未設定などの場合は、ログイン操作のときにエラーを表示する
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError("");
    setPasswordError("");
    setFormError("");

    if (!email.trim()) setEmailError("メールアドレスを入力してください");
    if (!password) setPasswordError("パスワードを入力してください");
    if (!email.trim() || !password) return;

    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

      // ID トークンは約1時間で切れるため保存せず、呼ぶたびに取得する（期限が近ければ SDK が更新する）
      const idToken = await credential.user.getIdToken();
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
      const response = await fetch(`${apiBaseUrl}/v1/me`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        router.push("/admin");
        return;
      }

      // 管理者として確認できなかった場合は、ログイン状態を残さない
      await signOut(auth);
      if (response.status === 403) setFormError(NO_PERMISSION_MESSAGE);
      else if (response.status === 401) setFormError(UNAUTHORIZED_MESSAGE);
      else setFormError(NETWORK_ERROR_MESSAGE);
    } catch (error) {
      if (error instanceof FirebaseError && AUTH_FAILURE_CODES.includes(error.code)) {
        setFormError(AUTH_FAILURE_MESSAGE);
      } else if (error instanceof FirebaseError && error.code === "auth/too-many-requests") {
        setFormError("しばらくしてからもう一度お試しください");
      } else {
        console.error(error);
        setFormError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col gap-md">
        <div className="pt-lg text-center">
          <h1 className="text-3xl font-bold text-brand">しごとみっけ🔎</h1>
          <p className="mt-sm text-sm text-gray-600">高校生の、まだ知らない未来を見つける</p>
        </div>

        <Card>
          <form onSubmit={handleLogin} noValidate className="flex flex-col gap-lg pt-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-navy">学校管理者ログイン</h2>
              <p className="mt-sm text-sm text-gray-600">
                登録したメールアドレスとパスワードでログインしてください。
              </p>
            </div>

            <div>
              <Input
                label="メールアドレス"
                placeholder="例：admin@school.ed.jp"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
              />
              {emailError && <p className="mt-xs text-sm text-red-600">{emailError}</p>}
            </div>

            <div>
              <Input
                label="パスワード"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
              />
              {passwordError && <p className="mt-xs text-sm text-red-600">{passwordError}</p>}
            </div>

            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "ログイン中…" : "ログイン →"}
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}

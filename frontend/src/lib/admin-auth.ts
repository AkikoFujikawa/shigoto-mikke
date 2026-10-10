"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export const ADMIN_LOGIN_PATH = "/admin/login";

// ログイン画面に渡す理由。URL に入れるのは、この短いコードだけ（トークンや個人情報は入れない）
export type LoginRedirectReason = "forbidden" | "unauthorized";

/** ログイン中の管理者の ID トークンを付けて API を呼ぶ。ID トークンは約1時間で切れるため、呼ぶたびに取得する（期限が近ければ SDK が更新する） */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("ログインしていません");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
}

export async function signOutAdmin(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export type AdminGuardStatus = "checking" | "authorized" | "error";

/**
 * 管理画面のガード。ログイン状態の復元を待ち、GET /v1/me で管理者として確認できた場合だけ authorized にする。
 * 未ログインはログイン画面へ。401・403 は、サインアウトしてからログイン画面へ（理由を付ける）。
 * 通信の失敗など確認できなかった場合は error にし、サインアウトはしない（retry で再確認できる）。
 * 画面の見た目のためのガードで、データの保護は API 側（requireAdmin）が行う。
 */
export function useAdminGuard(): { status: AdminGuardStatus; retry: () => void } {
  const router = useRouter();
  const [status, setStatus] = useState<AdminGuardStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    setStatus("checking");

    const leave = async (reason?: LoginRedirectReason) => {
      unsubscribe(); // サインアウトで認証状態の監視が再び動かないようにする
      try {
        await signOutAdmin();
      } catch (error) {
        console.error(error);
      }
      router.replace(reason ? `${ADMIN_LOGIN_PATH}?reason=${reason}` : ADMIN_LOGIN_PATH);
    };

    try {
      unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (!user) {
          router.replace(ADMIN_LOGIN_PATH);
          return;
        }

        try {
          const response = await adminFetch("/v1/me");
          if (cancelled) return;
          if (response.ok) setStatus("authorized");
          else if (response.status === 403) await leave("forbidden");
          else if (response.status === 401) await leave("unauthorized");
          else setStatus("error");
        } catch (error) {
          console.error(error);
          if (!cancelled) setStatus("error");
        }
      });
    } catch (error) {
      console.error(error);
      setStatus("error");
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router, attempt]);

  return { status, retry };
}

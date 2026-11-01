"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ErrorState from "@/components/ErrorState";
import LoadingState from "@/components/LoadingState";
import SchoolCodeCard from "@/components/SchoolCodeCard";
import StatusCard from "@/components/StatusCard";
import Toast, { useToast } from "@/components/Toast";
import {
  ADMIN_LOGIN_PATH,
  signOutAdmin,
  useAdminGuard,
  type LoginRedirectReason,
} from "@/lib/admin-auth";
import { startCheckout } from "@/lib/billing";
import { fetchMySchool, type MySchool } from "@/lib/schools";

type LoadState = { kind: "loading" } | { kind: "ready"; data: MySchool } | { kind: "error" };

// Stripe Checkout から戻ったときの目印（API設計 §3.7 の success_url・cancel_url）
type CheckoutReturn = "success" | "cancel";

// 決済の完了は Webhook で反映されるため、戻った直後は数秒かかることがある。反映されるまで取り直す
const CONFIRM_MAX_TRIES = 5;
const CONFIRM_INTERVAL_MS = 2000;

const CANCEL_NOTICE = "決済が完了していません。";
const PENDING_NOTICE =
  "決済の反映に時間がかかっています。しばらくしてから、画面を更新してください。";
const APPLY_ERROR_NOTICE = "決済画面を開けませんでした。もう一度お試しください。";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function AdminPage() {
  const router = useRouter();
  const { status, retry } = useAdminGuard();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const checkoutReturn = useRef<CheckoutReturn | null>(null);
  const { message, showToast } = useToast();

  // 401・403: 管理者として確認できないため、サインアウトしてログイン画面へ（ガードと同じ扱い）
  const leaveToLogin = useCallback(
    async (reason: LoginRedirectReason) => {
      try {
        await signOutAdmin();
      } catch (error) {
        console.error(error);
      }
      router.replace(`${ADMIN_LOGIN_PATH}?reason=${reason}`);
    },
    [router],
  );

  useEffect(() => {
    // Stripe Checkout から戻ったかどうかを覚えて、URL からは消す（再読み込みで同じ案内をくり返さない）
    const value = new URLSearchParams(window.location.search).get("checkout");
    if (value === "success" || value === "cancel") {
      checkoutReturn.current = value;
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Stripe の画面からブラウザの「戻る」で帰ってきたとき、ボタンが押せないままにならないようにする
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIsApplying(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (status !== "authorized") return;

    let cancelled = false;
    const returned = checkoutReturn.current;
    setIsConfirmingPayment(returned === "success");
    setLoad({ kind: "loading" });
    (async () => {
      let result = await fetchMySchool();
      if (returned === "success") {
        for (
          let tries = 1;
          tries < CONFIRM_MAX_TRIES &&
          !cancelled &&
          result.kind === "ok" &&
          result.data.contract.status !== "active";
          tries++
        ) {
          await wait(CONFIRM_INTERVAL_MS);
          result = await fetchMySchool();
        }
      }
      if (cancelled) return;

      checkoutReturn.current = null;
      setIsConfirmingPayment(false);
      if (result.kind === "ok") {
        setLoad({ kind: "ready", data: result.data });
        if (returned === "success") {
          if (result.data.contract.status === "active") showToast("お申し込みが完了しました");
          else setNotice(PENDING_NOTICE);
        } else if (returned === "cancel") {
          setNotice(CANCEL_NOTICE);
        }
      } else if (result.kind === "error") {
        setLoad({ kind: "error" });
      } else {
        await leaveToLogin(result.kind);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, attempt, leaveToLogin, showToast]);

  // 確認が終わるまで、管理画面の内容は表示しない
  if (status === "checking") {
    return (
      <main className="min-h-screen bg-background">
        <LoadingState message="確認中…" />
      </main>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="管理者の確認ができませんでした"
        message="通信を確認して、もう一度お試しください"
        onRetry={retry}
      />
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutAdmin();
    } catch (error) {
      console.error(error);
    }
    router.replace(ADMIN_LOGIN_PATH);
  };

  // 申込・更新ボタン: Stripe Checkout の URL を取得して、Stripe 側の画面へ移る（画面設計 UI-A03）
  const handleApply = async () => {
    setIsApplying(true);
    setNotice(null);
    const result = await startCheckout();
    if (result.kind === "ok") {
      // 画面が切り替わるまで、ボタンは押せないままにする
      window.location.assign(result.url);
      return;
    }

    setIsApplying(false);
    if (result.kind === "already_subscribed") {
      // 別のタブなどで契約済みになっている。表示が古いので取り直す
      setAttempt((count) => count + 1);
    } else if (result.kind === "error") {
      setNotice(APPLY_ERROR_NOTICE);
    } else {
      await leaveToLogin(result.kind);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onLogout={handleLogout} logoutDisabled={isLoggingOut} />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-md px-md py-lg">
        <h1 className="flex flex-wrap items-baseline gap-sm text-lg font-bold text-navy">
          {load.kind === "ready" && <span>{load.data.school.name}</span>}
          <span className="text-sm font-normal text-gray-600">管理者ページ</span>
        </h1>

        {load.kind === "loading" && (
          <LoadingState message={isConfirmingPayment ? "確認中…" : "読み込み中…"} />
        )}

        {load.kind === "error" && (
          <Card>
            <p className="text-base text-navy">契約情報を取得できませんでした。</p>
            <p className="mt-xs text-sm text-gray-600">通信を確認して、もう一度お試しください。</p>
            <div className="mt-md max-w-xs">
              <Button onClick={() => setAttempt((count) => count + 1)}>もう一度試す</Button>
            </div>
          </Card>
        )}

        {load.kind === "ready" && (
          <>
            <StatusCard
              contract={load.data.contract}
              onApply={handleApply}
              isApplying={isApplying}
              notice={notice}
            />
            <SchoolCodeCard schoolCode={load.data.school.schoolCode} onNotify={showToast} />
          </>
        )}
      </main>

      <Toast message={message} />
    </div>
  );
}

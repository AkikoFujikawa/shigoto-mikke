"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Button from "@/components/Button";
import Card from "@/components/Card";
import ErrorState from "@/components/ErrorState";
import LoadingState from "@/components/LoadingState";
import SchoolCodeCard from "@/components/SchoolCodeCard";
import StatusCard from "@/components/StatusCard";
import Toast, { useToast } from "@/components/Toast";
import { ADMIN_LOGIN_PATH, signOutAdmin, useAdminGuard } from "@/lib/admin-auth";
import { fetchMySchool, type MySchool } from "@/lib/schools";

type LoadState = { kind: "loading" } | { kind: "ready"; data: MySchool } | { kind: "error" };

export default function AdminPage() {
  const router = useRouter();
  const { status, retry } = useAdminGuard();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { message, showToast } = useToast();

  useEffect(() => {
    if (status !== "authorized") return;

    let cancelled = false;
    setLoad({ kind: "loading" });
    (async () => {
      const result = await fetchMySchool();
      if (cancelled) return;

      if (result.kind === "ok") {
        setLoad({ kind: "ready", data: result.data });
      } else if (result.kind === "error") {
        setLoad({ kind: "error" });
      } else {
        // 401・403: 管理者として確認できないため、サインアウトしてログイン画面へ（ガードと同じ扱い）
        try {
          await signOutAdmin();
        } catch (error) {
          console.error(error);
        }
        router.replace(`${ADMIN_LOGIN_PATH}?reason=${result.kind}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, attempt, router]);

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onLogout={handleLogout} logoutDisabled={isLoggingOut} />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-md px-md py-lg">
        <h1 className="flex flex-wrap items-baseline gap-sm text-lg font-bold text-navy">
          {load.kind === "ready" && <span>🏫 {load.data.school.name}</span>}
          <span className="text-sm font-normal text-gray-600">管理者ページ</span>
        </h1>

        {load.kind === "loading" && <LoadingState message="読み込み中…" />}

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
            <StatusCard contract={load.data.contract} />
            <SchoolCodeCard schoolCode={load.data.school.schoolCode} onNotify={showToast} />
          </>
        )}
      </main>

      <Toast message={message} />
    </div>
  );
}

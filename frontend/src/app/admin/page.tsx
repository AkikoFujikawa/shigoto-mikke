"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Card from "@/components/Card";
import ErrorState from "@/components/ErrorState";
import LoadingState from "@/components/LoadingState";
import { ADMIN_LOGIN_PATH, signOutAdmin, useAdminGuard } from "@/lib/admin-auth";

export default function AdminPage() {
  const router = useRouter();
  const { status, retry } = useAdminGuard();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        message="管理者の確認ができませんでした。もう一度お試しください"
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
      <AppHeader title="管理者ページ" onLogout={handleLogout} logoutDisabled={isLoggingOut} />

      <main className="mx-auto w-full max-w-3xl px-md py-lg">
        {/* ご利用状況・生徒用の学校コードのカードは #67 で追加する */}
        <Card>
          <p className="text-center text-gray-600">
            ご利用状況と学校コードは、準備ができ次第ここに表示されます。
          </p>
        </Card>
      </main>
    </div>
  );
}

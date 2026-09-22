"use client";

import { useEffect, useState } from "react";

type HealthState =
  { status: "loading" } | { status: "ok"; body: unknown } | { status: "error"; message: string };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/**
 * backend との疎通確認用の暫定ページ（Issue #20）。
 * 生徒画面（UI-S01 等）の実装ではない。
 */
export default function HealthCheckPage() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/v1/health`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTPステータス: ${res.status}`);
        }
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setHealth({ status: "ok", body });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHealth({
            status: "error",
            message: err instanceof Error ? err.message : "不明なエラー",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold text-brand">しごとみっけ（仮）</h1>
      <p className="text-sm text-gray-500">
        backend（{API_BASE_URL}）との疎通確認ページです。生徒画面はこれから実装します。
      </p>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">GET /v1/health</h2>
        {health.status === "loading" && <p>確認中…</p>}
        {health.status === "ok" && (
          <pre className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {JSON.stringify(health.body, null, 2)}
          </pre>
        )}
        {health.status === "error" && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            接続できませんでした：{health.message}
          </p>
        )}
      </div>
    </main>
  );
}

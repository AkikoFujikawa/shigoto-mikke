"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 2500;

/** 一時メッセージを出す（画面設計 §6。画面下部に 2〜3 秒表示して、自動で消す） */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, showToast };
}

type ToastProps = {
  message: string | null;
};

export default function Toast({ message }: ToastProps) {
  // 読み上げソフトに届くよう、領域は常に置き、中身だけを出し入れする
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-lg flex justify-center px-md"
    >
      {message && (
        <p className="rounded-md bg-navy px-md py-sm text-sm text-white shadow-card">{message}</p>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

type Strength = {
  code: string;
  title: string;
  description: string;
};

const strengthEmojis: Record<string, string> = {
  explore: "🔎",
  ideate: "💡",
  express: "🗣",
  support: "🤝",
  craft: "✂️",
};

export default function StrengthsPage() {
  const [strengths, setStrengths] = useState<Strength[]>([]);
  useEffect(() => {
    const storedStrengths = sessionStorage.getItem("strengths");
    if (storedStrengths) {
      setStrengths(JSON.parse(storedStrengths));
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main
        className="mx-auto min-h-screen max-w-md bg-cover bg-center bg-no-repeat px-5 py-6"
        style={{ backgroundImage: "url('/backgrounds/S01.png')" }}
      >
        <header className="mb-8 flex items-center justify-between">
          <div className="text-xl font-bold text-brand">しごとみっけ🔎</div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("studentToken");
              window.location.href = "/";
            }}
            className="min-h-[44px] px-2 font-semibold text-gray-700"
          >
            おわる
          </button>
        </header>
        <h1 className="text-center text-2xl font-bold text-navy">🌱 自分らしさの結果</h1>
        <div className="relative mx-auto mt-6 flex max-w-[320px] items-end justify-center gap-2">
          <Image
            src="/characters/tanecchi/S05.png"
            alt="たねっち"
            className="w-32 h-auto shrink-0 -translate-y-4"
            width={128}
            height={128}
          />

          <p className="relative mx-auto -mt-2 w-[200px] shrink-0 rounded-2xl border-2 border-brand bg-white px-4 py-4 text-center text-sm leading-7 text-navy">
            好きなことや回答から、あなたの「強みのタネ」を見つけました！
            <span className="absolute left-[-9px] top-2/3 h-4 w-4 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-brand bg-white" />
          </p>
        </div>
        <div className="mt-6 space-y-4">
          {strengths.map((strength) => (
            <div
              key={strength.code}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{strengthEmojis[strength.code] ?? "🌱"}</span>

                <h2 className="text-lg font-bold text-navy">{strength.title}</h2>
              </div>

              <p className="mt-3 text-base leading-7 text-navy">{strength.description}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-6 min-h-[44px] w-full rounded-lg bg-brand px-6 py-3 font-bold text-white hover:opacity-90"
          onClick={() => {
            window.location.href = "/jobs";
          }}
        >
          仕事を見てみる
        </button>
        <button
          type="button"
          className="mt-3 min-h-[44px] w-full px-6 py-3 text-base font-semibold text-navy underline"
          onClick={() => {
            window.location.href = "/interests";
          }}
        >
          もう一度やり直す
        </button>
      </main>
    </div>
  );
}

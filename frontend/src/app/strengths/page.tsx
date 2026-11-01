"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import AppLogo from "@/components/AppLogo";
import LoadingState from "@/components/LoadingState";
import IconBadge from "@/components/IconBadge";
import { strengthIconSrc } from "@/lib/icons";

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

// 自分で気づくためのヒント（固定文。AI は使わない。#142）。
// 強みを言い当てるのではなく、本人が自分で思い出すきっかけにする。
// 評価や断定の言葉（「得意」「向いている」など）と、「友だちに聞いてみよう」のような行動の呼びかけは入れない
type StrengthHint = {
  others: string; // 他の人から見ると
  recall: string; // 思い出してみよう
};

const strengthHints: Record<string, StrengthHint> = {
  explore: {
    others: "まわりの人から、「それ、どうやって調べたの？」と聞かれたことはないかな。",
    recall: "小学校や中学校で、夢中になって調べたことを1つ思い出してみよう。",
  },
  ideate: {
    others: "友だちや家の人に、「それ、おもしろいね」と言われたことはないかな。",
    recall: "前に自分で考えた工夫やアイデアで、うれしかったことを思い出してみよう。",
  },
  express: {
    others: "まわりの人から、「わかりやすい」と言われたことはないかな。",
    recall: "話したり書いたりして、伝わってうれしかったことを思い出してみよう。",
  },
  support: {
    others: "友だちや家の人から、相談されたり「ありがとう」と言われたことはないかな。",
    recall: "誰かの話を聞いたり、手伝ったりしたことを思い出してみよう。",
  },
  craft: {
    others: "まわりの人から、「丁寧だね」と言われたことはないかな。",
    recall: "最後まで仕上げて、達成感があったことを思い出してみよう。",
  },
};

// 開いたヒントの最後に、毎回入れる一言（思い当たる経験がない子への配慮）
const HINT_NOTE = "今は思いつかなくても大丈夫。";

export default function StrengthsPage() {
  const [strengths, setStrengths] = useState<Strength[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const storedStrengths = sessionStorage.getItem("strengths");
    try {
      if (storedStrengths) {
        setStrengths(JSON.parse(storedStrengths));
      }
    } catch (error) {
      console.error("強みデータの読み込みに失敗しました", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return <LoadingState message="結果を読み込み中..." />;
  }

  return (
    <div
      className="min-h-screen bg-background bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/backgrounds/S01.png')" }}
    >
      <main className="mx-auto min-h-screen max-w-md px-5 py-6">
        <header className="mb-8 flex items-center justify-between">
          <AppLogo />
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
        <h1 className="text-center text-2xl font-bold text-navy">自分らしさの結果</h1>
        <div className="relative mx-auto mt-6 flex max-w-[320px] items-end justify-center gap-2">
          <Image
            src="/characters/tanecchi/S05.png"
            alt="たねっち"
            className="w-32 h-auto shrink-0 -translate-y-4"
            width={128}
            height={128}
          />

          <p className="relative mx-auto -mt-2 w-full max-w-[200px] min-w-0 rounded-2xl border-2 border-brand bg-white px-4 py-4 text-center text-sm leading-7 text-navy">
            あなたの今の<span className="whitespace-nowrap">強みのタネを</span>
            <br />
            見つけました。
            <br />
            これから変わっても
            <br />
            大丈夫！
            <span className="absolute left-[-9px] top-2/3 h-4 w-4 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-brand bg-white" />
          </p>
        </div>
        <div className="mt-6 space-y-4">
          {strengths.map((strength) => {
            // 定数に無い強みのコードのときは、ヒントの行を出さない
            const hint: StrengthHint | undefined = strengthHints[strength.code];

            return (
              <div
                key={strength.code}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <IconBadge
                    emoji={strengthEmojis[strength.code] ?? "🌱"}
                    imageSrc={strengthIconSrc(strength.code)}
                  />

                  <h2 className="text-lg font-bold text-navy">{strength.title}</h2>
                </div>

                <p className="mt-3 text-base leading-7 text-navy">{strength.description}</p>

                {hint && (
                  <details className="group mt-3">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-lg border border-brand/30 bg-brand/5 px-4 text-sm font-bold text-brand [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">ヒントを見る</span>
                      <span className="hidden group-open:inline">ヒントを閉じる</span>
                      <span aria-hidden="true" className="text-xs group-open:rotate-180">
                        ▼
                      </span>
                    </summary>
                    <div className="mt-2 rounded-lg border-2 border-brand/40 px-4 py-3">
                      <span className="inline-block rounded-sm bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                        他の人から見ると
                      </span>
                      <p className="mt-1 text-sm leading-7 text-navy">{hint.others}</p>
                      <span className="mt-3 inline-block rounded-sm bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                        思い出してみよう
                      </span>
                      <p className="mt-1 text-sm leading-7 text-navy">{hint.recall}</p>
                      <p className="mt-3 border-t border-brand/20 pt-2 text-xs leading-5 text-gray-500">
                        {HINT_NOTE}
                      </p>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
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

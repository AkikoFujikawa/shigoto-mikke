"use client";

import { useState } from "react";
import Button from "@/components/Button";
import PageShell from "@/components/PageShell";

const interests = [
  { id: "space", emoji: "🌙", label: "宇宙・星" },
  { id: "it", emoji: "💻", label: "PC・IT" },
  { id: "animal", emoji: "🐾", label: "動物" },
  { id: "game", emoji: "🎮", label: "ゲーム" },
  { id: "talk", emoji: "💬", label: "人と話す" },
  { id: "food", emoji: "🍳", label: "食べる・料理" },
  { id: "sports", emoji: "⚽", label: "スポーツ" },
  { id: "art", emoji: "🎨", label: "絵・デザイン" },
  { id: "nature", emoji: "🌱", label: "自然・環境" },
  { id: "health", emoji: "💪", label: "健康・からだ" },
  { id: "research", emoji: "🔬", label: "調べる・研究" },
  { id: "making", emoji: "🔧", label: "ものづくり" },
];

export default function InterestsPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const handleSelect = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((item) => item !== id));
      setMessage("");
      return;
    }

    if (selected.length >= 3) {
      setMessage("3つまで選べます");
      return;
    }

    setSelected([...selected, id]);
    setMessage("");
  };

  return (
    <PageShell>
      <div
        className="relative -mx-md min-h-screen bg-cover bg-center bg-no-repeat px-md pb-28"
        style={{ backgroundImage: "url('/backgrounds/S01.png')" }}
      >
        <div className="absolute inset-0 z-0 bg-white/50" />
        <div className="relative z-10">
          {/* ヘッダー */}
          <header className="mb-2 flex items-center justify-between">
            <div className="text-xl font-bold text-brand">しごとみっけ🔎</div>

            <button type="button" className="min-h-[44px] px-2 font-semibold text-gray-700">
              おわる
            </button>
          </header>

          {/* タイトル */}
          <div className="mb-2 text-center">
            <img
              src="/characters/tanecchi/S03.png"
              alt="たねっち"
              className="absolute right-0 top-12 h-16 w-auto"
            />
            <h1 className="text-xl font-bold leading-relaxed text-gray-900">
              好き・気になるものを
              <br />
              選んでね！✨
            </h1>

            <p className="mt-2 text-base text-gray-600">
              「ちょっと気になる」でもOK！
              <br />
              1〜3個選べます
            </p>
          </div>

          {/* カード */}
          <div className="grid grid-cols-3 gap-2">
            {interests.map((interest) => {
              const isSelected = selected.includes(interest.id);

              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => handleSelect(interest.id)}
                  className={`relative min-h-[88px] rounded-2xl border-2 p-2 transition ${
                    isSelected ? "border-brand bg-[#F1EFFF]" : "border-gray-200 bg-white"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-sm text-white">
                      ✓
                    </span>
                  )}

                  <div className="mb-2 text-3xl">{interest.emoji}</div>

                  <div className="text-base font-semibold text-gray-800">{interest.label}</div>
                </button>
              );
            })}
          </div>

          {/* 選択数 */}
          <div className="mt-5 text-center">
            <p className="text-base font-semibold text-gray-700">選択中 {selected.length} / 3</p>

            {message && <p className="mt-1 text-sm font-semibold text-red-500">{message}</p>}
          </div>

          {/* 次へ */}
          <div className="mt-5">
            <Button disabled={selected.length === 0}>次へ →</Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import AppLogo from "@/components/AppLogo";
import Button from "@/components/Button";
import IconBadge from "@/components/IconBadge";
import PageShell from "@/components/PageShell";
import { interestIconSrc } from "@/lib/icons";

type Interest = {
  id: number;
  code: string;
  label: string;
  emoji: string;
};

export default function InterestsPage() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  useEffect(() => {
    const fetchInterests = async () => {
      try {
        const token = sessionStorage.getItem("studentToken");

        if (!token) {
          setMessage("セッションが切れました。もう一度はじめからお試しください");
          return;
        }

        const response = await fetch(`${API_BASE_URL}/v1/masters/interests`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          sessionStorage.removeItem("studentToken");
          window.location.replace("/");
          return;
        }

        if (!response.ok) {
          setMessage("好きなものを読み込めませんでした");
          return;
        }

        const data = await response.json();
        setInterests(Array.isArray(data.items) ? data.items : []);
      } catch {
        setMessage("通信に失敗しました。もう一度お試しください");
      }
    };

    fetchInterests();
  }, [API_BASE_URL]);

  const handleSelect = (id: number) => {
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
        <div className="absolute inset-0 z-0 bg-white/20" />
        <div className="relative z-10">
          {/* ヘッダー */}
          <header className="mb-2 flex items-center justify-between">
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

          {/* タイトル */}
          <div className="mb-2 text-center">
            <Image
              src="/characters/tanecchi/S03.png"
              alt="たねっち"
              width={64}
              height={64}
              className="absolute right-0 top-12 h-16 w-auto"
            />
            <h1 className="px-16 text-xl font-bold leading-relaxed text-gray-900">
              好き・<span className="whitespace-nowrap">気になるものを</span>
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
          <div className="grid grid-cols-2 gap-3">
            {(Array.isArray(interests) ? interests : []).map((interest) => {
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

                  <div className="mb-2 flex justify-center">
                    <IconBadge emoji={interest.emoji} imageSrc={interestIconSrc(interest.code)} />
                  </div>

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
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                sessionStorage.setItem("selectedInterestIds", JSON.stringify(selected));
                window.location.href = "/questions";
              }}
            >
              次へ →
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

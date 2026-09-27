"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";
import PageShell from "@/components/PageShell";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();

  const [schoolCode, setSchoolCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [schoolCodeError, setSchoolCodeError] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setSchoolCodeError("");
    setNicknameError("");

    if (!schoolCode.trim()) {
      setSchoolCodeError("学校コードを入力してください");
    } else if (!/^[a-zA-Z0-9]{1,20}$/.test(schoolCode.trim())) {
      setSchoolCodeError("学校コードは20文字以内の英数字で入力してください");
    }

    if (!nickname.trim()) {
      setNicknameError("ニックネームを入力してください");
    } else if (nickname.trim().length > 20) {
      setNicknameError("20文字以内で入力してください");
    }
    if (
      !schoolCode.trim() ||
      !/^[a-zA-Z0-9]{1,20}$/.test(schoolCode.trim()) ||
      !nickname.trim() ||
      nickname.trim().length > 20
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

      const response = await fetch(`${apiBaseUrl}/v1/students/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolCode: schoolCode.trim(),
          nickname: nickname.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSchoolCodeError(data.error?.message ?? "エラーが発生しました");
        setIsLoading(false);
        return;
      }
      sessionStorage.setItem("studentToken", data.token);
      router.push("/interests");
    } catch {
      setSchoolCodeError("通信に失敗しました。もう一度お試しください");
      setIsLoading(false);
    }
  };

  return (
    <PageShell>
      <div
        className="min-h-screen bg-bottom bg-no-repeat bg-cover "
        style={{ backgroundImage: "url('/backgrounds/S01.png')" }}
      >
        <div className="flex flex-col gap-mg">
          {/* ロゴ・キャッチコピー */}
          <div className="pt-lg text-center">
            <h1 className="text-3xl font-bold text-brand"> しごとみっけ🔎 </h1>
            <p className="mt-sm text-sm text-gray-600">好きから見つかる、まだ知らない未来。</p>
          </div>

          <div className="relative z-0 mb-16 flex justify-center translate-y-20">
            <Image
              src="/characters/tanecchi/peek_S01.png"
              alt="たねっち"
              width={144}
              height={144}
              className="w-36 h-auto"
            />
          </div>

          {/* 入力カード */}
          <div className="relative z-10 mx-auto w-[88%]">
            <Card>
              <div className="flex flex-col gap-lg pt-4">
                <h2 className="text-center text-xl font-bold text-navy">はじめよう</h2>

                <div>
                  <Input
                    label="学校コード"
                    placeholder="例：ABC123"
                    value={schoolCode}
                    onChange={(event) => setSchoolCode(event.target.value)}
                  />
                  <p className="mt-xs text-sm text-gray-500">
                    学校から案内されたコードを入力してね。
                  </p>
                  {schoolCodeError && (
                    <p className="mt-xs text-sm text-red-600">{schoolCodeError}</p>
                  )}
                </div>

                <div>
                  <Input
                    label="ニックネーム"
                    placeholder="例：みさき"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                  />
                  <p className="mt-xs text-sm text-gray-500">
                    本名じゃなくてOK。ほかの人には見えません。
                  </p>
                  {nicknameError && <p className="mt-xs text-sm text-red-600">{nicknameError}</p>}
                </div>

                <Button onClick={handleStart} disabled={isLoading}>
                  {isLoading ? "はじめています…" : "はじめる"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

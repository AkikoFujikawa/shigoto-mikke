"use client";

import { useEffect, useState } from "react";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Question = {
  id: number;
  text: string;
  options: {
    id: number;
    label: string;
    emoji: string;
  }[];
};

const growthMessages = [
  {
    stage: "",
    message: "どんなことが好きかな？\n一緒に見つけよう！",
  },
  {
    stage: "",
    message: "いいね！\n芽が出てきたよ！",
  },
  {
    stage: "",
    message: "いい感じ！\n少しずつ育ってるよ！",
  },
  {
    stage: "",
    message: "もう少し！\n素敵な芽になってきたよ！",
  },
  {
    stage: "",
    message: "最後の質問！\nあなたらしい芽が育ってるよ✨",
  },
];

export default function QuestionsPage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const [interestIds, setInterestIds] = useState<number[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("selectedInterestIds");

    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          setInterestIds(ids);
        }
      } catch {
        setInterestIds([]);
      }
    }
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("studentToken");
        if (!token) {
          throw new Error("セッションがありません");
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        let response: Response;

        try {
          response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/masters/questions`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!response.ok) {
          throw new Error("質問の取得に失敗しました");
        }

        const data: { items: Question[] } = await response.json();
        setQuestions(data.items);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("通信がタイムアウトしました。もう一度お試しください。");
        } else {
          setError("質問を取得できませんでした");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  if (loading) {
    return <LoadingState message="質問を読み込んでいます..." />;
  }
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          window.location.reload();
        }}
        onBack={() => {
          window.location.href = "/interests";
        }}
      />
    );
  }
  if (diagnosisLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center">
        <Image
          src="/characters/tanecchi/loading.png"
          alt="強みを見つけているたねっち"
          className="w-64 h-auto"
          width={256}
          height={256}
        />

        <h1 className="mt-6 text-xl font-bold text-navy">
          あなたの「自分らしさ」を見つけています…
        </h1>

        <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand" />

        <p className="mt-4 text-base text-navy">もう少しお待ちください…</p>
      </main>
    );
  }

  const diagnosisAnswers = questions.map((question) => ({
    questionId: question.id,
    optionId: answers[question.id],
  }));
  const handleDiagnosis = async () => {
    if (diagnosisLoading) return;

    setDiagnosisLoading(true);
    setDiagnosisError("");

    const loadingStartTime = Date.now();
    let succeeded = false;

    try {
      const token = sessionStorage.getItem("studentToken");

      if (!token) {
        throw new Error("セッションがありません");
      }

      if (interestIds.length === 0 || diagnosisAnswers.length !== 5) {
        throw new Error("診断に必要な回答が不足しています");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      let response: Response;

      try {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/diagnoses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            interestIds,
            answers: diagnosisAnswers,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (response.status === 401) {
        window.location.href = "/";
        return;
      }
      if (!response.ok) {
        throw new Error("診断APIへの送信に失敗しました");
      }

      const data: {
        strengths: {
          code: string;
          title: string;
          description: string;
        }[];
      } = await response.json();

      sessionStorage.setItem("strengths", JSON.stringify(data.strengths));
      sessionStorage.removeItem("jobsPosition"); // 新しい診断では1件目から表示する
      succeeded = true;
    } catch {
      setDiagnosisError("診断に失敗しました。もう一度お試しください。");
    } finally {
      const elapsed = Date.now() - loadingStartTime;
      const remaining = Math.max(0, 5000 - elapsed);

      await new Promise((resolve) => setTimeout(resolve, remaining));

      if (succeeded) {
        router.replace("/strengths");
        return;
      }
      setDiagnosisLoading(false);
    }
  };
  const question = questions[currentQuestion];

  if (diagnosisError) {
    return (
      <ErrorState
        message={diagnosisError}
        onRetry={() => void handleDiagnosis()}
        onBack={() => {
          window.location.href = "/interests";
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <header className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-wider text-brand">しごとみっけ🔎</h1>

          <button
            type="button"
            className="min-h-[44px] px-2 font-semibold text-gray-700"
            onClick={() => {
              sessionStorage.removeItem("studentToken");
              window.location.href = "/";
            }}
          >
            おわる
          </button>
        </header>

        {/* 5問の進捗バー */}
        <div className="mt-5">
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className={`h-4 w-4 rounded-full ${
                  index <= currentQuestion ? "bg-brand" : "bg-brand/20"
                }`}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-sm font-semibold text-navy">
            {currentQuestion + 1} / 5
          </p>
        </div>

        {/* たねっちと成長メッセージ */}
        <div className="mt-8 flex items-center gap-3">
          {/* 左：たねっち */}
          <Image
            src={`/characters/tanecchi/question-${currentQuestion + 1}.png`}
            alt={`成長中のたねっち ${currentQuestion + 1}問目`}
            className="h-28 w-28 shrink-0 object-contain"
            width={112}
            height={112}
          />

          {/* 右：吹き出し */}
          <div className="relative flex-1 rounded-3xl bg-brand/10 px-4 py-5">
            {/* 吹き出しのしっぽ */}
            <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 bg-brand/10" />

            <p className="relative whitespace-pre-line text-center text-sm font-bold leading-6 text-navy">
              {growthMessages[currentQuestion].message}
            </p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-navy text-center">{question?.text}</h2>
        <div className="grid grid-cols-1 gap-4 mt-5">
          {question?.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                answers[question.id] === option.id
                  ? "min-h-[88px] border-2 border-brand bg-brand/10 rounded-2xl p-4 text-center shadow-sm"
                  : "min-h-[88px] border-2 border-gray-200 bg-white rounded-2xl p-4 text-center shadow-sm"
              }
              onClick={() => {
                setAnswers((prev) => ({
                  ...prev,
                  [question.id]: option.id,
                }));
              }}
            >
              <span className="flex flex-row items-center justify-start gap-4 text-base">
                <span className="text-3xl">{option.emoji}</span>
                <span className="flex-1 text-left">{option.label}</span>
                {answers[question.id] === option.id && (
                  <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    ✓
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mt-3 w-full rounded-full bg-brand px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!question || answers[question.id] === undefined || diagnosisLoading}
          onClick={() => {
            if (currentQuestion < questions.length - 1) {
              setCurrentQuestion((prev) => prev + 1);
            } else {
              void handleDiagnosis();
            }
          }}
        >
          {diagnosisLoading
            ? "あなたの自分らしさを見つけています…"
            : currentQuestion === questions.length - 1
              ? "結果を見る →"
              : "次へ"}
        </button>
        <button
          type="button"
          className="mt-5 w-full rounded-full border-2 border-brand bg-white px-6 py-3 font-bold text-brand"
          onClick={() => {
            if (currentQuestion === 0) {
              window.location.href = "/interests";
            } else {
              setCurrentQuestion((prev) => prev - 1);
            }
          }}
        >
          ← 戻る
        </button>
      </div>
    </main>
  );
}

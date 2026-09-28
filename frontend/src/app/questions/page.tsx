"use client";

import { useEffect, useState } from "react";

type Question = {
  id: number;
  text: string;
  options: {
    id: number;
    label: string;
    emoji: string;
  }[];
};

export default function QuestionsPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      setError("");
      try {
        const token = sessionStorage.getItem("studentToken");
        if (!token) {
          throw new Error("セッションがありません");
        }
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/masters/questions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("質問の取得に失敗しました");
        }

        const data: { items: Question[] } = await response.json();
        setQuestions(data.items);
      } catch (err) {
        setError("質問を取得できませんでした");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  if (loading) {
    return <p>読み込み中...</p>;
  }
  if (error) {
    return <p className="text-red-500">{error}</p>;
  }
  const question = questions[currentQuestion];
  return (
    <main>
      <h1>自分らしさチェック</h1>
      <p>質問 {currentQuestion + 1} / 5</p>
      <h2>{question?.text}</h2>
      <div>
        {question?.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setAnswers((prev) => ({
                ...prev,
                [question.id]: option.id,
              }));
            }}
          >
            {option.emoji} {option.label}
          </button>
        ))}
      </div>
    </main>
  );
}

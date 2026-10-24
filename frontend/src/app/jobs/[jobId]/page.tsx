"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ErrorState from "@/components/ErrorState";
import JobImage from "@/components/JobImage";
import LoadingState from "@/components/LoadingState";
import Tag from "@/components/Tag";
import AppLogo from "@/components/AppLogo";

type Academic = {
  name: string;
  category: "liberal_arts" | "science" | "mixed";
};

type JobDetail = {
  id: number;
  name: string;
  interestTags: string[];
  imageUrl: string | null;
  whyConnected: string;
  description: string;
  academics: Academic[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const categoryLabels: Record<Academic["category"], string> = {
  liberal_arts: "文系寄り",
  science: "理系寄り",
  mixed: "複合",
};

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const goBack = () => {
    window.history.back();
  };

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("studentToken");
      if (!token) {
        throw new Error("no session");
      }
      const response = await fetch(`${API_BASE_URL}/v1/jobs/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        sessionStorage.removeItem("studentToken");
        window.location.href = "/";
        return;
      }
      if (!response.ok) {
        throw new Error("fetch failed");
      }
      setJob(await response.json());
    } catch {
      setError("職業の詳細を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  if (loading) {
    return <LoadingState message="職業の詳細を読み込んでいます…" />;
  }
  if (error || !job) {
    return <ErrorState message={error} onRetry={fetchJob} onBack={goBack} />;
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex min-h-[44px] items-center">
          <AppLogo />
        </div>

        <header className="mt-2 space-y-3">
          <JobImage name={job.name} imageUrl={job.imageUrl} />
          <h1 className="text-2xl font-bold text-navy">{job.name}</h1>
          <div className="flex flex-wrap gap-2">
            {job.interestTags.map((tag) => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
          </div>
        </header>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-navy">🌱 なぜあなたにつながる？</h2>
          <p className="mt-3 text-base leading-7 text-navy">{job.whyConnected}</p>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-navy">💼 どんな仕事？</h2>
          <p className="mt-3 text-base leading-7 text-navy">{job.description}</p>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-navy">📚 関連する学問</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {job.academics.map((academic) => (
              <li key={academic.name}>
                <Tag tone="academic">
                  {academic.name}（{categoryLabels[academic.category]}）
                </Tag>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-base leading-7 text-navy">
            こんな学問を学ぶことで、この仕事に近づくことができます！
          </p>
        </section>

        <button
          type="button"
          onClick={goBack}
          className="mt-6 min-h-[48px] w-full rounded-full bg-brand px-6 py-3 font-bold text-white"
        >
          職業一覧に戻る
        </button>
      </div>
    </main>
  );
}

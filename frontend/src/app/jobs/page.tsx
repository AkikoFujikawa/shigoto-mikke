"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ErrorState from "@/components/ErrorState";
import JobImage from "@/components/JobImage";
import LoadingState from "@/components/LoadingState";
import Tag from "@/components/Tag";

type Job = {
  id: number;
  name: string;
  summary: string;
  interestTags: string[];
  imageUrl: string | null;
  emoji: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const POSITION_KEY = "jobsPosition";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("studentToken");
      if (!token) {
        throw new Error("no session");
      }
      const response = await fetch(`${API_BASE_URL}/v1/diagnoses/latest/jobs`, {
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
      const data: { items: Job[] } = await response.json();
      setJobs(data.items);
    } catch {
      setError("職業を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || jobs.length === 0) return;
    const saved = Number(sessionStorage.getItem(POSITION_KEY) ?? 0);
    const index = Number.isInteger(saved) && saved >= 0 && saved < jobs.length ? saved : 0;
    list.scrollTop = index * list.clientHeight;
    setCurrent(index);
  }, [jobs]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list || list.clientHeight === 0) return;
    const index = Math.round(list.scrollTop / list.clientHeight);
    setCurrent(index);
    sessionStorage.setItem(POSITION_KEY, String(index));
  };

  const scrollToNext = () => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: (current + 1) * list.clientHeight, behavior: "smooth" });
  };

  if (loading) {
    return <LoadingState message="あなたにつながる仕事を探しています…🔍" />;
  }
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={fetchJobs}
        onBack={() => {
          window.location.href = "/strengths";
        }}
      />
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-background">
      <h1 className="shrink-0 px-5 pt-6 pb-4 text-center text-lg font-bold text-navy">
        あなたにつながる仕事を<span className="whitespace-nowrap">見つけてみよう✨</span>
      </h1>
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="mx-auto min-h-0 w-full max-w-md flex-1 snap-y snap-mandatory overflow-y-auto"
      >
        {jobs.map((job, index) => (
          <section key={job.id} className="flex h-full snap-start snap-always flex-col px-5 pb-6">
            <div className="my-auto flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-card">
                <JobImage name={job.name} imageUrl={job.imageUrl} emoji={job.emoji} />
                <h2 className="text-xl font-bold text-navy">{job.name}</h2>
                <p className="text-base leading-7 text-navy">{job.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {job.interestTags.map((tag) => (
                    <Tag key={tag}>#{tag}</Tag>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `/jobs/${job.id}`;
                }}
                className="min-h-[48px] w-full rounded-full bg-brand px-6 py-3 font-bold text-white"
              >
                詳しく見る →
              </button>
              {index < jobs.length - 1 && (
                <button
                  type="button"
                  onClick={scrollToNext}
                  className="min-h-[48px] w-full rounded-full border border-brand bg-white px-6 py-3 font-bold text-brand"
                >
                  次の仕事を見る ↓
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

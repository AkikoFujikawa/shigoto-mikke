"use client";

import Card from "@/components/Card";

type SchoolCodeCardProps = {
  schoolCode: string;
  onNotify: (message: string) => void;
};

function CopyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export default function SchoolCodeCard({ schoolCode, onNotify }: SchoolCodeCardProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(schoolCode);
      onNotify("コピーしました");
    } catch {
      onNotify("コピーできませんでした。コードを選んでコピーしてください");
    }
  };

  return (
    <Card>
      <h2 className="text-sm text-gray-600">🎓 生徒用 学校コード</h2>
      <div className="mt-sm flex flex-wrap items-center justify-between gap-md rounded-md border border-brand/20 bg-brand/5 px-md py-sm">
        <p className="select-all text-2xl font-bold tracking-widest text-navy">{schoolCode}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-xs whitespace-nowrap rounded-lg border border-brand bg-white px-md py-sm font-semibold text-brand"
        >
          <CopyIcon />
          コピー
        </button>
      </div>
      <p className="mt-sm text-sm text-gray-600">
        このコードを生徒に共有してください。生徒は最初にこのコードを入力します。
      </p>
    </Card>
  );
}

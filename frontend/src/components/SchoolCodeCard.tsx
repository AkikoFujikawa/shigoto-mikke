"use client";

import Card from "@/components/Card";

type SchoolCodeCardProps = {
  schoolCode: string;
  onNotify: (message: string) => void;
};

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
      <div className="mt-sm flex items-center gap-md">
        <p className="select-all text-2xl font-bold tracking-widest text-navy">{schoolCode}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[44px] rounded-lg border border-brand bg-white px-md py-sm font-semibold text-brand"
        >
          コピー
        </button>
      </div>
      <p className="mt-sm text-sm text-gray-600">
        このコードを生徒に共有してください。生徒は最初にこのコードを入力します。
      </p>
    </Card>
  );
}

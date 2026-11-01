import Image from "next/image";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
};

export default function ErrorState({
  title = "うまく結果を取得できませんでした",
  message = "うまく結果を取得できませんでした",
  onRetry,
  onBack,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div className="mb-2 text-4xl">⚠️</div>
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      <p className="mt-2 max-w-xs text-base leading-7 text-gray-600">{message}</p>
      <Image
        src="/characters/tanecchi/ErrorState.png"
        alt="たねっち"
        className="mt-3 w-28 h-auto"

        width={112}
        height={112}
      />
      <div className="mt-3 flex w-full max-w-xs flex-col gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[48px] w-full rounded-full bg-brand px-6 py-3 font-bold text-white"
          >
            もう一度試す
          </button>
        )}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] w-full rounded-full border border-brand bg-white px-6 py-3 font-bold text-brand"
          >
            ← 前の画面に戻る
          </button>
        )}
      </div>
    </div>
  );
}

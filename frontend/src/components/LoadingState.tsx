import Image from "next/image";

type LoadingStateProps = {
  message?: string;
};

export default function LoadingState({ message = "読み込み中..." }: LoadingStateProps) {
  return (
    <div role="status" className="flex min-h-40 flex-col items-center justify-center gap-3 p-6">
      <Image
        src="/characters/tanecchi/LoadingState.png"
        alt="たねっち"
        className="w-28 h-auto"
        width={112}
        height={112}
      />
      <p className="text-center text-gray-600 font-medium">{message}</p>
      {message === "読み込み中…" && (
        <p className="text-center text-gray-500 text-sm">しばらくお待ちください</p>
      )}
    </div>
  );
}

type AppHeaderProps = {
  title: string;
  onLogout?: () => void;
  logoutDisabled?: boolean;
};

export default function AppHeader({ title, onLogout, logoutDisabled = false }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between bg-white px-md py-sm shadow-card">
      <div className="flex items-baseline gap-sm">
        <span className="text-xl font-bold text-brand">しごとみっけ🔎</span>
        <span className="text-sm text-gray-600">{title}</span>
      </div>

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          disabled={logoutDisabled}
          className="min-h-[44px] rounded-lg border border-brand bg-white px-md py-sm font-semibold text-brand disabled:opacity-50"
        >
          ログアウト
        </button>
      )}
    </header>
  );
}

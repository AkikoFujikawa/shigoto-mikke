type AppHeaderProps = {
  onLogout?: () => void;
  logoutDisabled?: boolean;
};

export default function AppHeader({ onLogout, logoutDisabled = false }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between bg-white px-md py-sm shadow-card">
      <span className="text-xl font-bold text-brand">しごとみっけ🔎</span>

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

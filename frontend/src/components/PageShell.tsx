type PageShellProps = {
  children: React.ReactNode;
};

export default function PageShell({ children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-background px-5 py-lg">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </main>
  );
}

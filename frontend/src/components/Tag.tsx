type TagProps = {
  children: React.ReactNode;
  tone?: "interest" | "academic";
};

const toneClass = {
  interest: "bg-brand/10 text-brand",
  academic: "bg-accent/40 text-navy",
};

export default function Tag({ children, tone = "interest" }: TagProps) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

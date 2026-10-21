type CardProps = {
  children: React.ReactNode;
};

export default function Card({ children }: CardProps) {
  return <div className="rounded-xl bg-white p-5 shadow-card">{children}</div>;
}

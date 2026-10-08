type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
};

export default function Button({
  children,
  onClick,
  disabled = false,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[44px] rounded-lg bg-brand px-md py-sm font-semibold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

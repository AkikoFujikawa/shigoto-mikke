type InputProps = {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  type?: "text" | "password";
};

export default function Input({
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  type = "text",
}: InputProps) {
  return (
    <label className="block w-full">
      {label && <span className="mb-sm block font-semibold text-navy">{label}</span>}

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 bg-white px-md py-sm text-navy outline-none focus:border-brand disabled:opacity-50"
      />
    </label>
  );
}

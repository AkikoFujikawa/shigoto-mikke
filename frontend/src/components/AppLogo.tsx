import Image from "next/image";

type AppLogoProps = {
  /** sm：ヘッダー（高さ28px）／lg：ログイン画面の見出し（高さ40px） */
  size?: "sm" | "lg";
};

const sizeClass = {
  sm: "h-7",
  lg: "h-10",
};

/**
 * アプリのロゴ（スライドと同じロゴ画像。#151）。
 * 高さだけを決めて、横幅は画像の比率（1556×320）のまま。
 * 画像なので、読み上げ用に alt で「しごとみっけ」と読ませる。
 */
export default function AppLogo({ size = "sm" }: AppLogoProps) {
  return (
    <Image
      src="/images/logo.png"
      alt="しごとみっけ"
      width={1556}
      height={320}
      priority={size === "lg"}
      className={`inline-block w-auto align-middle ${sizeClass[size]}`}
    />
  );
}

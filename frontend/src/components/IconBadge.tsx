import Image from "next/image";

type IconBadgeProps = {
  /** 画像がないときに出す絵文字 */
  emoji: string;
  /** アイコンの画像（lib/icons.ts で引く）。null なら絵文字を出す */
  imageSrc?: string | null;
};

/**
 * 好きなこと・質問の選択肢・強みのアイコンを、パステルの丸い台の上に出す（#149）。
 * 端末ごとに見た目が違う絵文字も、同じ台に乗せて、アプリの世界観にそろえる。
 * どの場所でも隣に同じ言葉があるので、読み上げで2回読まれないよう、アイコンは読み上げない。
 */
export default function IconBadge({ emoji, imageSrc }: IconBadgeProps) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10"
      aria-hidden="true"
    >
      {imageSrc ? (
        <Image src={imageSrc} alt="" width={36} height={36} />
      ) : (
        <span className="text-2xl leading-none">{emoji}</span>
      )}
    </span>
  );
}

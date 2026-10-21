// アイコンの画像の一覧（#149）。
// 画像を public/icons/ に置いたら、ここに1行ずつ足す。一覧にないものは、絵文字のまま表示する。
// 画像があるかを読みこみの失敗で判断すると、一瞬欠けた表示になるため、一覧で持つ。
// ファイル名：strength-{強みの code}.webp／interest-{好きなことの code}.webp／option-{選択肢の id}.webp

/** 画像がある強みの code */
const STRENGTH_ICONS = new Set<string>([]);

/** 画像がある好きなことの code */
const INTEREST_ICONS = new Set<string>([]);

/** 画像がある質問の選択肢の id */
const OPTION_ICONS = new Set<number>([]);

export function strengthIconSrc(code: string): string | null {
  return STRENGTH_ICONS.has(code) ? `/icons/strength-${code}.webp` : null;
}

export function interestIconSrc(code: string): string | null {
  return INTEREST_ICONS.has(code) ? `/icons/interest-${code}.webp` : null;
}

export function optionIconSrc(id: number): string | null {
  return OPTION_ICONS.has(id) ? `/icons/option-${id}.webp` : null;
}

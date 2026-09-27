// 「なぜあなたにつながる？」の文。AIは使わず、タグの一致からテンプレートで組み立てる（API設計.md §3.6、#30）
export type WhyTag = {
  id: number;
  label: string;
  sortOrder: number;
};

/** sortOrder の若い順に見て、職業のタグと一致する最初の1つを返す */
function findFirstMatch(tags: WhyTag[], jobTagIds: number[]): WhyTag | undefined {
  const jobIds = new Set(jobTagIds);
  return [...tags]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .find((tag) => jobIds.has(tag.id));
}

export function buildWhyConnected({
  selectedInterests,
  strengthTraits,
  jobInterestIds,
  jobTraitIds,
}: {
  selectedInterests: WhyTag[];
  strengthTraits: WhyTag[];
  jobInterestIds: number[];
  jobTraitIds: number[];
}): string {
  const interest = findFirstMatch(selectedInterests, jobInterestIds);
  const trait = findFirstMatch(strengthTraits, jobTraitIds);

  if (interest && trait) {
    return `あなたが選んだ「${interest.label}」への興味と、「${trait.label}」がこの仕事につながっているかもしれません。`;
  }
  if (interest) {
    return `あなたが選んだ「${interest.label}」への興味が、この仕事につながっているかもしれません。`;
  }
  if (trait) {
    return `「${trait.label}」があなたの強みとして、この仕事につながっているかもしれません。`;
  }
  return "この仕事も、あなたにつながっているかもしれません。";
}

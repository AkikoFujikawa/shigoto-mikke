import { describe, expect, it } from "vitest";
import { buildWhyConnected, type WhyTag } from "../src/lib/whyConnected.js";

// テスト用のタグ（id と sortOrder をわざとずらして、sortOrder で選ぶことを確かめる）
const SPACE: WhyTag = { id: 10, label: "宇宙・星", sortOrder: 10 };
const IT: WhyTag = { id: 12, label: "PC・IT", sortOrder: 12 };
const EXPLORE: WhyTag = { id: 1, label: "探究する力", sortOrder: 1 };

describe("buildWhyConnected", () => {
  it("好きなものと強みの両方が一致したら、両方を入れた文を返す", () => {
    const text = buildWhyConnected({
      selectedInterests: [SPACE],
      strengthTraits: [EXPLORE],
      jobInterestIds: [SPACE.id],
      jobTraitIds: [EXPLORE.id],
    });

    expect(text).toBe(
      "あなたが選んだ「宇宙・星」への興味と、「探究する力」がこの仕事につながっているかもしれません。",
    );
  });

  it("好きなものだけ一致したら、好きなものだけの文を返す", () => {
    const text = buildWhyConnected({
      selectedInterests: [SPACE],
      strengthTraits: [EXPLORE],
      jobInterestIds: [SPACE.id],
      jobTraitIds: [],
    });

    expect(text).toBe(
      "あなたが選んだ「宇宙・星」への興味が、この仕事につながっているかもしれません。",
    );
  });

  it("強みだけ一致したら、強みだけの文を返す", () => {
    const text = buildWhyConnected({
      selectedInterests: [SPACE],
      strengthTraits: [EXPLORE],
      jobInterestIds: [],
      jobTraitIds: [EXPLORE.id],
    });

    expect(text).toBe(
      "「探究する力」があなたの強みとして、この仕事につながっているかもしれません。",
    );
  });

  it("どちらも一致しない場合、共通の文を返す", () => {
    const text = buildWhyConnected({
      selectedInterests: [SPACE],
      strengthTraits: [EXPLORE],
      jobInterestIds: [],
      jobTraitIds: [],
    });

    expect(text).toBe("この仕事も、あなたにつながっているかもしれません。");
  });

  it("好きなものが複数一致したら、sortOrder の若い方を使う", () => {
    const text = buildWhyConnected({
      selectedInterests: [IT, SPACE],
      strengthTraits: [EXPLORE],
      jobInterestIds: [IT.id, SPACE.id],
      jobTraitIds: [],
    });

    expect(text).toBe(
      "あなたが選んだ「宇宙・星」への興味が、この仕事につながっているかもしれません。",
    );
  });
});

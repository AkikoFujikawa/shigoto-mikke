import { describe, expect, it } from "vitest";
import { resolveContractStatus } from "../src/lib/contractStatus.js";

const NOW = new Date("2026-10-01T00:00:00.000Z");
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const fromNow = (ms: number) => new Date(NOW.getTime() + ms);

describe("resolveContractStatus", () => {
  describe("DB の status が trial のとき", () => {
    it("期限の1秒前は trial（無料体験中）で、残り日数は 1", () => {
      const trialEndsAt = fromNow(SECOND);

      expect(
        resolveContractStatus({ status: "trial", trialEndsAt, activeEndsAt: null }, NOW),
      ).toEqual({
        status: "trial",
        trialEndsAt,
        daysLeft: 1,
      });
    });

    it("ちょうど期限の瞬間は trial_expired（無料体験終了）で、残り日数は返さない", () => {
      const trialEndsAt = fromNow(0);

      expect(
        resolveContractStatus({ status: "trial", trialEndsAt, activeEndsAt: null }, NOW),
      ).toEqual({
        status: "trial_expired",
        trialEndsAt,
      });
    });

    it("期限を過ぎていれば trial_expired", () => {
      const trialEndsAt = fromNow(-5 * DAY);

      expect(
        resolveContractStatus({ status: "trial", trialEndsAt, activeEndsAt: null }, NOW),
      ).toEqual({
        status: "trial_expired",
        trialEndsAt,
      });
    });

    it.each([
      ["ちょうど18日", 18 * DAY, 18],
      ["17日と1秒（端数は切り上げ）", 17 * DAY + SECOND, 18],
      ["ちょうど17日", 17 * DAY, 17],
      ["半日（1日未満でも 1）", DAY / 2, 1],
    ])("残りが%sのとき、daysLeft は切り上げた日数になる", (_name, msLeft, expected) => {
      const result = resolveContractStatus(
        { status: "trial", trialEndsAt: fromNow(msLeft), activeEndsAt: null },
        NOW,
      );

      expect(result).toMatchObject({ status: "trial", daysLeft: expected });
    });
  });

  describe("DB の status が active のとき", () => {
    const trialEndsAt = fromNow(-60 * DAY);

    it("期限の1秒前は active（契約中）で、activeEndsAt だけを返す", () => {
      const activeEndsAt = fromNow(SECOND);

      expect(resolveContractStatus({ status: "active", trialEndsAt, activeEndsAt }, NOW)).toEqual({
        status: "active",
        activeEndsAt,
      });
    });

    it("ちょうど期限の瞬間は contract_expired（契約期限切れ）", () => {
      const activeEndsAt = fromNow(0);

      expect(resolveContractStatus({ status: "active", trialEndsAt, activeEndsAt }, NOW)).toEqual({
        status: "contract_expired",
        activeEndsAt,
      });
    });

    it("期限を過ぎていれば contract_expired", () => {
      const activeEndsAt = fromNow(-35 * DAY);

      expect(resolveContractStatus({ status: "active", trialEndsAt, activeEndsAt }, NOW)).toEqual({
        status: "contract_expired",
        activeEndsAt,
      });
    });

    it("active なのに activeEndsAt が無いのはデータの不整合なので、エラーにする", () => {
      expect(() =>
        resolveContractStatus({ status: "active", trialEndsAt, activeEndsAt: null }, NOW),
      ).toThrow("active_ends_at");
    });
  });
});

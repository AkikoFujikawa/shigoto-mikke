// 契約状態の判定（API設計.md §3.7、DB設計.md §3.1、#127）。
// DB には trial / active の2値だけが入っているので、期限と現在時刻から、管理画面に出す4つの状態を決める。
// 管理画面の表示専用で、契約期限が切れても生徒側の API・画面は制限しない（FR-A05 は実施しない）
export type ContractForStatus = {
  status: "trial" | "active";
  trialEndsAt: Date;
  activeEndsAt: Date | null;
};

export type ContractView =
  | { status: "trial"; trialEndsAt: Date; daysLeft: number }
  | { status: "trial_expired"; trialEndsAt: Date }
  | { status: "active" | "contract_expired"; activeEndsAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 期限ちょうどの瞬間は「切れた」側にする（現在時刻 < 期限 のあいだだけ有効） */
export function resolveContractStatus(contract: ContractForStatus, now: Date): ContractView {
  if (contract.status === "trial") {
    const msLeft = contract.trialEndsAt.getTime() - now.getTime();
    if (msLeft <= 0) {
      return { status: "trial_expired", trialEndsAt: contract.trialEndsAt };
    }
    // 残り日数は切り上げ。残り1日未満でも 1 になり、「あと0日」なのに使える表示にならない
    return {
      status: "trial",
      trialEndsAt: contract.trialEndsAt,
      daysLeft: Math.ceil(msLeft / DAY_MS),
    };
  }

  // active にするときは必ず active_ends_at を入れる（DB設計 §3.1）。無いのはデータの不整合
  if (!contract.activeEndsAt) {
    throw new Error("契約が active なのに active_ends_at がありません");
  }
  return {
    status: now.getTime() < contract.activeEndsAt.getTime() ? "active" : "contract_expired",
    activeEndsAt: contract.activeEndsAt,
  };
}

import { adminFetch } from "@/lib/admin-auth";

// GET /v1/schools/me の応答（API設計 §3.7）。日時は ISO 8601（UTC）の文字列
export type ContractView =
  | { status: "trial"; trialEndsAt: string; daysLeft: number }
  | { status: "trial_expired"; trialEndsAt: string }
  | { status: "active" | "contract_expired"; activeEndsAt: string };

export type MySchool = {
  school: { id: number; name: string; schoolCode: string };
  contract: ContractView;
};

export type FetchMySchoolResult =
  { kind: "ok"; data: MySchool } | { kind: "unauthorized" | "forbidden" } | { kind: "error" };

export async function fetchMySchool(): Promise<FetchMySchoolResult> {
  try {
    const response = await adminFetch("/v1/schools/me");
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 403) return { kind: "forbidden" };
    if (!response.ok) return { kind: "error" };
    return { kind: "ok", data: (await response.json()) as MySchool };
  } catch (error) {
    console.error(error);
    return { kind: "error" };
  }
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 日本時間の「2026年10月4日」の形にする */
export function formatJapaneseDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

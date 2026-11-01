/**
 * backend/prisma/seed.ts
 *
 * DB設計.md §6 の投入ルールに従った seed スクリプト。
 * - 冪等（何度実行しても同じ結果。すべて upsert）
 * - 不正な値があれば失敗させる（§6.4）
 *
 * 投入内容：
 *   1. interests（12件）／traits（5件）／questions（5件）＋question_options（10件）
 *      → DB設計.md §6.2・§6.3 の確定値をそのままハードコード
 *   2. job_groups／academic_fields／jobs（＋ job_interests／job_traits／job_academic_fields）
 *      → prisma/seed-data/*.json から読み込み（xlsx 未確定のため、現在は空配列）
 *   3. デモ用の学校／学校管理者／契約（4パターン：無料体験中・無料体験終了・契約中・契約期限切れ）
 *      → 管理者の自己登録は廃止（#11）。UI-A03 の表示確認・デモ用に、このseedで用意する
 *      → 学校名はすべて「上田みらい高等学校」（ワイヤーフレームと同じ）。学校コードで区別する（#79）
 *      → school_admins.firebase_uid は、環境変数 SEED_FIREBASE_UID_TRIAL／_EXPIRED／_ACTIVE／_RENEW で渡す。
 *         指定がなければプレースホルダーになり、その学校の管理画面にはログインできない（#79）
 *      → ⚠️ 本番で2回目以降に流すときは SEED_DEMO_SCHOOLS=false にする。
 *         デモ校を流し直すと、支払い後の契約が元の状態に戻るため（#79）
 *
 * 実行方法：
 *   docker compose exec backend pnpm prisma db seed
 *   デモ校をスキップ：docker compose exec -e SEED_DEMO_SCHOOLS=false backend pnpm prisma db seed
 *   （ローカルで直接動かす場合は `pnpm prisma db seed`。DATABASE_URL の向き先に注意）
 */

import { PrismaClient, AcademicCategory } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redis } from "../src/lib/redis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();

// ─────────────────────────────
// 1. 確定マスタ（DB設計.md §6.2）
// ─────────────────────────────

// emoji は画面設計のワイヤーフレーム（UI-S03）に合わせて確定（#89）。
const INTERESTS = [
  { code: "talk", label: "人と話す", emoji: "💬", sortOrder: 1 },
  { code: "game", label: "ゲーム", emoji: "🎮", sortOrder: 2 },
  { code: "health", label: "健康・からだ", emoji: "💪", sortOrder: 3 },
  { code: "nature", label: "自然・環境", emoji: "🌱", sortOrder: 4 },
  { code: "research", label: "調べる・研究", emoji: "🔬", sortOrder: 5 },
  { code: "art", label: "絵・デザイン", emoji: "🎨", sortOrder: 6 },
  { code: "making", label: "ものづくり", emoji: "🔧", sortOrder: 7 },
  { code: "animal", label: "動物", emoji: "🐾", sortOrder: 8 },
  { code: "food", label: "食べる・料理", emoji: "🍳", sortOrder: 9 },
  { code: "space", label: "宇宙・星", emoji: "🌙", sortOrder: 10 },
  { code: "sports", label: "スポーツ", emoji: "⚽", sortOrder: 11 },
  { code: "it", label: "PC・IT", emoji: "💻", sortOrder: 12 },
] as const;

// description は生徒向けの「〜がありそう」形式（1文・200文字以内・全生徒で同じ文言）。
// AI へ渡す文脈と、AI が使えないときの固定文を兼ねる（案A。#86）。
// 探究・発想・人を支えるは API設計.md のレスポンス例と同じ文言。
const TRAITS = [
  {
    code: "explore",
    label: "探究する力",
    description: "気になったことを「もっと知りたい！」と、深く調べられるところがありそう。",
    sortOrder: 1,
  },
  {
    code: "ideate",
    label: "発想する力",
    description: "新しいアイデアや方法を考えることを楽しめるかも。",
    sortOrder: 2,
  },
  {
    code: "express",
    label: "表現する力",
    description: "自分の考えや感じたことを、わかりやすく伝えられるところがありそう。",
    sortOrder: 3,
  },
  {
    code: "support",
    label: "人を支える力",
    description: "相手の話を聞きながら、周りを支えることができそう。",
    sortOrder: 4,
  },
  {
    code: "craft",
    label: "こだわる力",
    description: "細かいところまで、丁寧にやり切ろうとするところがありそう。",
    sortOrder: 5,
  },
] as const;

const QUESTIONS = [
  { id: 1, text: "気になることを見つけたら？", sortOrder: 1 },
  { id: 2, text: "みんなで何かをするとき、自然とやっているのは？", sortOrder: 2 },
  { id: 3, text: "何かを作るとき、楽しいのは？", sortOrder: 3 },
  { id: 4, text: "友だちから相談されたら？", sortOrder: 4 },
  { id: 5, text: "課題や問題に出会ったら？", sortOrder: 5 },
] as const;

// DB設計.md §6.3。各特性がちょうど2回ずつ登場する構成を崩さないこと。
// emoji は #89 で確定（Q1・Q5はワイヤーフレーム、Q2〜Q4はチーム決定。Q5のBは✅）。
const QUESTION_OPTIONS = [
  {
    id: 11,
    questionId: 1,
    label: "まず調べて詳しく知りたい",
    emoji: "🔎",
    traitCode: "explore",
    sortOrder: 1,
  },
  {
    id: 12,
    questionId: 1,
    label: "まず自分なりのアイデアを考えてみたい",
    emoji: "✨",
    traitCode: "ideate",
    sortOrder: 2,
  },
  {
    id: 21,
    questionId: 2,
    label: "自分の考えをみんなに伝えることが多い",
    emoji: "🗣️",
    traitCode: "express",
    sortOrder: 1,
  },
  {
    id: 22,
    questionId: 2,
    label: "困っている人に声をかけたり手伝ったりする",
    emoji: "🤝",
    traitCode: "support",
    sortOrder: 2,
  },
  {
    id: 31,
    questionId: 3,
    label: "新しいものや方法を考える",
    emoji: "🚀",
    traitCode: "ideate",
    sortOrder: 1,
  },
  {
    id: 32,
    questionId: 3,
    label: "細かいところまで丁寧に仕上げる",
    emoji: "✂️",
    traitCode: "craft",
    sortOrder: 2,
  },
  {
    id: 41,
    questionId: 4,
    label: "自分の考えをわかりやすく伝える",
    emoji: "📣",
    traitCode: "express",
    sortOrder: 1,
  },
  {
    id: 42,
    questionId: 4,
    label: "まず相手の話をじっくり聞く",
    emoji: "👂",
    traitCode: "support",
    sortOrder: 2,
  },
  {
    id: 51,
    questionId: 5,
    label: "原因や仕組みをじっくり考える",
    emoji: "⚙️",
    traitCode: "explore",
    sortOrder: 1,
  },
  {
    id: 52,
    questionId: 5,
    label: "細かいところまで確認しながら取り組む",
    emoji: "✅",
    traitCode: "craft",
    sortOrder: 2,
  },
] as const;

// ─────────────────────────────
// 2. 未確定マスタ（prisma/seed-data/*.json から読み込み）
// ─────────────────────────────

type JobGroupData = { id: number; name: string; sortOrder: number };

type AcademicFieldData = {
  name: string;
  category: "liberal_arts" | "science" | "mixed";
  representativeTopics?: string | null;
  sortOrder: number;
};

type JobData = {
  id: number;
  jobGroupId: number;
  name: string;
  summary?: string;
  description: string;
  imageUrl?: string | null;
  emoji?: string | null;
  isPublished?: boolean;
  interestCodes: string[];
  traitCodes: string[];
  academicFieldNames: string[];
};

const SEED_DATA_DIR = path.join(__dirname, "seed-data");

// ─────────────────────────────
// デモ用の学校・学校管理者・契約（#11：管理者の自己登録は廃止し、seedで用意する）
// ─────────────────────────────

/**
 * seed のトランザクションの時間切れ（#79）。Prisma の既定は5秒だが、本番の Neon（シンガポール）は
 * 1回の問い合わせに時間がかかり、職業の投入で5秒を超えて P2028 になったため、長めにする。
 */
const SEED_TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 };

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

type DemoSchool = {
  schoolCode: string;
  name: string;
  adminEmail: string;
  // ⚠️ プレースホルダー。Firebaseコンソールで実アカウントを作成し、発行されたUIDに書き換える
  firebaseUid: string;
  contract: {
    status: "trial" | "active";
    trialEndsAt: Date;
    activeEndsAt: Date | null;
    stripeCustomerId: string | null;
    stripePaymentIntentId: string | null;
    activatedAt: Date | null;
  };
};

const DEMO_SCHOOLS: DemoSchool[] = [
  {
    schoolCode: "UEDA123",
    name: "上田みらい高等学校",
    adminEmail: "demo-trial@example.com",
    firebaseUid: firebaseUidFor("SEED_FIREBASE_UID_TRIAL", "REPLACE_WITH_FIREBASE_UID_TRIAL"),
    contract: {
      status: "trial",
      trialEndsAt: daysFromNow(18),
      activeEndsAt: null,
      stripeCustomerId: null,
      stripePaymentIntentId: null,
      activatedAt: null,
    },
  },
  {
    schoolCode: "DEMOEXPIRED",
    name: "上田みらい高等学校",
    adminEmail: "demo-expired@example.com",
    firebaseUid: firebaseUidFor("SEED_FIREBASE_UID_EXPIRED", "REPLACE_WITH_FIREBASE_UID_EXPIRED"),
    contract: {
      status: "trial",
      trialEndsAt: daysFromNow(-5),
      activeEndsAt: null,
      stripeCustomerId: null,
      stripePaymentIntentId: null,
      activatedAt: null,
    },
  },
  {
    schoolCode: "DEMOACTIVE",
    name: "上田みらい高等学校",
    adminEmail: "demo-active@example.com",
    firebaseUid: firebaseUidFor("SEED_FIREBASE_UID_ACTIVE", "REPLACE_WITH_FIREBASE_UID_ACTIVE"),
    contract: {
      status: "active",
      trialEndsAt: daysFromNow(-60),
      activeEndsAt: daysFromNow(335), // activatedAt（30日前）＋1年
      stripeCustomerId: "cus_demo_active_dummy",
      stripePaymentIntentId: "pi_demo_active_dummy",
      activatedAt: daysFromNow(-30),
    },
  },
  {
    schoolCode: "DEMORENEW",
    name: "上田みらい高等学校",
    adminEmail: "demo-renew@example.com",
    firebaseUid: firebaseUidFor("SEED_FIREBASE_UID_RENEW", "REPLACE_WITH_FIREBASE_UID_RENEW"),
    contract: {
      status: "active",
      trialEndsAt: daysFromNow(-430),
      activeEndsAt: daysFromNow(-35), // activatedAt（400日前）＋1年
      stripeCustomerId: "cus_demo_renew_dummy",
      stripePaymentIntentId: "pi_demo_renew_dummy",
      activatedAt: daysFromNow(-400),
    },
  },
];

/**
 * デモ校の管理者の Firebase UID（#79）。
 * 本番では環境変数で本物の UID を渡す（最初から本物の UID で作れば、あとで管理者が重複しない）。
 * 指定がなければプレースホルダー（手元の開発用。ログインはできない）。
 */
function firebaseUidFor(envName: string, placeholder: string): string {
  return process.env[envName] || placeholder;
}

function readJson<T>(fileName: string): T {
  const filePath = path.join(SEED_DATA_DIR, fileName);
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

// ─────────────────────────────
// 検証（DB設計.md §6.4：不正な値があれば失敗させる）
// ─────────────────────────────

function assertValidInterestCodes(codes: string[], context: string) {
  const validCodes = new Set(INTERESTS.map((i) => i.code));
  const invalid = codes.filter((c) => !validCodes.has(c as (typeof INTERESTS)[number]["code"]));
  if (invalid.length > 0) {
    throw new Error(`[seed] ${context}: 未定義の好きなものタグ: ${invalid.join(", ")}`);
  }
}

function assertValidTraitCodes(codes: string[], context: string) {
  const validCodes = new Set(TRAITS.map((t) => t.code));
  const invalid = codes.filter((c) => !validCodes.has(c as (typeof TRAITS)[number]["code"]));
  if (invalid.length > 0) {
    throw new Error(`[seed] ${context}: 未定義の特性タグ: ${invalid.join(", ")}`);
  }
}

async function main() {
  console.log("[seed] 開始");

  // ---- 1. 確定マスタ ----
  await prisma.$transaction(async (tx) => {
    for (const interest of INTERESTS) {
      await tx.interest.upsert({
        where: { code: interest.code },
        create: interest,
        update: interest,
      });
    }

    for (const trait of TRAITS) {
      await tx.trait.upsert({
        where: { code: trait.code },
        create: trait,
        update: trait,
      });
    }

    for (const question of QUESTIONS) {
      await tx.question.upsert({
        where: { id: question.id },
        create: question,
        update: question,
      });
    }

    const traitByCode = new Map(TRAITS.map((t) => [t.code, t]));
    for (const option of QUESTION_OPTIONS) {
      const trait = traitByCode.get(option.traitCode);
      if (!trait) {
        throw new Error(
          `[seed] question_options id=${option.id}: 未定義の特性タグ: ${option.traitCode}`,
        );
      }
      const traitRow = await tx.trait.findUniqueOrThrow({ where: { code: trait.code } });
      await tx.questionOption.upsert({
        where: { id: option.id },
        create: {
          id: option.id,
          questionId: option.questionId,
          label: option.label,
          emoji: option.emoji,
          traitId: traitRow.id,
          sortOrder: option.sortOrder,
        },
        update: {
          questionId: option.questionId,
          label: option.label,
          emoji: option.emoji,
          traitId: traitRow.id,
          sortOrder: option.sortOrder,
        },
      });
    }
  }, SEED_TRANSACTION_OPTIONS);
  console.log(
    `[seed] 確定マスタ投入完了: interests=${INTERESTS.length} traits=${TRAITS.length} questions=${QUESTIONS.length} question_options=${QUESTION_OPTIONS.length}`,
  );

  // interests・questions を更新したので、キャッシュ（#57）を削除する。
  // Redisが落ちていてもseed自体は失敗させない（redis.ts の設計方針に合わせる）。
  try {
    await redis.del("master:interests", "master:questions");
    console.log("[seed] マスタキャッシュ削除完了");
  } catch (err) {
    console.error("[seed] マスタキャッシュ削除に失敗（Redis未接続の可能性）:", err);
  }

  // ---- 2. 未確定マスタ（空配列なら何もしない） ----
  const jobGroups = readJson<JobGroupData[]>("job-groups.json");
  const academicFields = readJson<AcademicFieldData[]>("academic-fields.json");
  const jobs = readJson<JobData[]>("jobs.json");

  await prisma.$transaction(async (tx) => {
    for (const group of jobGroups) {
      await tx.jobGroup.upsert({
        where: { id: group.id },
        create: group,
        update: group,
      });
    }

    for (const field of academicFields) {
      await tx.academicField.upsert({
        where: { name: field.name },
        create: {
          name: field.name,
          category: field.category as AcademicCategory,
          representativeTopics: field.representativeTopics ?? null,
          sortOrder: field.sortOrder,
        },
        update: {
          category: field.category as AcademicCategory,
          representativeTopics: field.representativeTopics ?? null,
          sortOrder: field.sortOrder,
        },
      });
    }

    for (const job of jobs) {
      assertValidInterestCodes(job.interestCodes, `jobs id=${job.id}`);
      assertValidTraitCodes(job.traitCodes, `jobs id=${job.id}`);

      if (
        job.interestCodes.length === 0 ||
        job.traitCodes.length === 0 ||
        job.academicFieldNames.length === 0
      ) {
        throw new Error(
          `[seed] jobs id=${job.id}: 好きなもの・特性・学問領域のいずれかが空欄です（DB設計.md §6.4）`,
        );
      }

      const summary = job.summary ?? job.description.slice(0, 60);

      await tx.job.upsert({
        where: { id: job.id },
        create: {
          id: job.id,
          jobGroupId: job.jobGroupId,
          name: job.name,
          summary,
          description: job.description,
          imageUrl: job.imageUrl ?? null,
          emoji: job.emoji ?? null,
          isPublished: job.isPublished ?? true,
        },
        update: {
          jobGroupId: job.jobGroupId,
          name: job.name,
          summary,
          description: job.description,
          imageUrl: job.imageUrl ?? null,
          emoji: job.emoji ?? null,
          isPublished: job.isPublished ?? true,
        },
      });

      // job_interests / job_traits / job_academic_fields は張り直し
      // （中間テーブルなので deleteMany → createMany で冪等にする）
      await tx.jobInterest.deleteMany({ where: { jobId: job.id } });
      const interestRows = await tx.interest.findMany({
        where: { code: { in: job.interestCodes } },
      });
      await tx.jobInterest.createMany({
        data: interestRows.map((i) => ({ jobId: job.id, interestId: i.id })),
      });

      await tx.jobTrait.deleteMany({ where: { jobId: job.id } });
      const traitRows = await tx.trait.findMany({
        where: { code: { in: job.traitCodes } },
      });
      await tx.jobTrait.createMany({
        data: traitRows.map((t) => ({ jobId: job.id, traitId: t.id })),
      });

      await tx.jobAcademicField.deleteMany({ where: { jobId: job.id } });
      const academicFieldRows = await tx.academicField.findMany({
        where: { name: { in: job.academicFieldNames } },
      });
      if (academicFieldRows.length !== job.academicFieldNames.length) {
        throw new Error(
          `[seed] jobs id=${job.id}: academic_fields に存在しない学問領域名が含まれています`,
        );
      }
      await tx.jobAcademicField.createMany({
        data: academicFieldRows.map((f) => ({ jobId: job.id, academicFieldId: f.id })),
      });
    }
  }, SEED_TRANSACTION_OPTIONS);

  console.log(
    `[seed] 未確定マスタ投入完了: job_groups=${jobGroups.length} academic_fields=${academicFields.length} jobs=${jobs.length}` +
      (jobs.length === 0 ? "（xlsx未確定のため現在は空。別Issueで投入予定）" : ""),
  );

  // 職業・分野・学問を更新したので、職業詳細のキャッシュ（#60、master:job:{id}）を削除する。
  // 非公開にした職業のキーも残さないよう、jobs.json のIDではなくキーのパターンで探す。
  try {
    let cursor = "0";
    let deleted = 0;
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", "master:job:*", "COUNT", 100);
      cursor = next;
      if (keys.length > 0) deleted += await redis.del(...keys);
    } while (cursor !== "0");
    console.log(`[seed] 職業詳細キャッシュ削除完了: ${deleted}件`);
  } catch (err) {
    console.error("[seed] 職業詳細キャッシュ削除に失敗（Redis未接続の可能性）:", err);
  }

  // ---- 3. デモ用の学校・学校管理者・契約 ----
  // 管理者の自己登録は廃止（#11で決定）。UI-A03の4状態（無料体験中／無料体験終了／
  // 契約中／契約期限切れ）を確認・デモできるよう、状態違いの学校を4件用意する。
  // 本番の2回目以降は SEED_DEMO_SCHOOLS=false で流す（管理者の重複・支払い後の契約の上書きを防ぐ。#79）
  if (process.env.SEED_DEMO_SCHOOLS === "false") {
    console.log("[seed] デモ校はスキップしました（SEED_DEMO_SCHOOLS=false）");
  } else {
    await prisma.$transaction(async (tx) => {
      for (const demo of DEMO_SCHOOLS) {
        const school = await tx.school.upsert({
          where: { schoolCode: demo.schoolCode },
          create: { name: demo.name, schoolCode: demo.schoolCode },
          update: { name: demo.name },
        });

        await tx.schoolAdmin.upsert({
          where: { firebaseUid: demo.firebaseUid },
          create: { schoolId: school.id, firebaseUid: demo.firebaseUid, email: demo.adminEmail },
          update: { schoolId: school.id, email: demo.adminEmail },
        });

        await tx.contract.upsert({
          where: { schoolId: school.id },
          create: { schoolId: school.id, ...demo.contract },
          update: { ...demo.contract },
        });
      }
    }, SEED_TRANSACTION_OPTIONS);
    console.log(`[seed] デモ校投入完了: schools=${DEMO_SCHOOLS.length}`);

    // プレースホルダーの UID のままの学校だけ知らせる（その学校の管理画面にはログインできない）
    const placeholders = DEMO_SCHOOLS.filter((d) => d.firebaseUid.startsWith("REPLACE_WITH_"));
    if (placeholders.length > 0) {
      console.log(
        `[seed]  ⚠️ 管理者の firebase_uid がプレースホルダーのままです: ${placeholders.map((d) => d.schoolCode).join(", ")}` +
          "（ログインを試すには、SEED_FIREBASE_UID_TRIAL などに Firebase の UID を入れて流し直してください）",
      );
    }
  }

  console.log("[seed] 完了");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    // quit() は Redis の返事を待つため、つながらないと接続が閉じられず、seed が終了しなくなる（#122）。
    // キャッシュの削除はここまでに終わっているので、返事を待たずにこちらから閉じる。
    redis.disconnect();
  });

import jwt from "jsonwebtoken";

export const SESSION_EXPIRES_IN_SECONDS = 8 * 60 * 60;

export type StudentTokenPayload = {
  studentId: number;
  schoolId: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET が設定されていません");
  }
  return secret;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function issueStudentToken({ studentId, schoolId }: StudentTokenPayload): string {
  return jwt.sign({ schoolId, role: "student" }, getSessionSecret(), {
    algorithm: "HS256",
    subject: String(studentId),
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
  });
}

/**
 * 署名・有効期限・中身の形がすべて正しい場合だけ値を返し、それ以外は null を返す。
 * SESSION_SECRET 未設定はトークン不正ではなく設定ミスなので、null にせず例外にする。
 */
export function verifyStudentToken(token: string): StudentTokenPayload | null {
  const secret = getSessionSecret();

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }

  if (typeof decoded === "string" || decoded.role !== "student") {
    return null;
  }

  const studentId =
    typeof decoded.sub === "string" && /^[1-9]\d*$/.test(decoded.sub) ? Number(decoded.sub) : null;
  if (studentId === null || !isPositiveInteger(decoded.schoolId)) {
    return null;
  }

  return { studentId, schoolId: decoded.schoolId };
}

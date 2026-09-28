import jwt from "jsonwebtoken";

/**
 * テスト用のセッション署名鍵。
 * 各テストの beforeEach で vi.stubEnv("SESSION_SECRET", TEST_SESSION_SECRET) してから使う。
 */
export const TEST_SESSION_SECRET = "test-session-secret";

/** requireStudent を通る、正しい生徒トークンを作る */
export function makeStudentToken(studentId: number, schoolId: number): string {
  return jwt.sign({ schoolId, role: "student" }, TEST_SESSION_SECRET, {
    algorithm: "HS256",
    subject: String(studentId),
  });
}

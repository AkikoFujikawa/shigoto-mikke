export function extractBearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer (\S+)$/);
  return match ? match[1] : null;
}

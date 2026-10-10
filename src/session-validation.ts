export function isInvalidAccount(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return ["user_not_found", "session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt"].includes(code || "");
}

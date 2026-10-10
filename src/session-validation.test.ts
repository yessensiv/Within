import { describe, expect, it } from "vitest";
import { isInvalidAccount } from "./session-validation";
describe("account validation", () => {
  it("recognizes deleted accounts and revoked sessions", () => {
    expect(isInvalidAccount({ code: "user_not_found" })).toBe(true);
    expect(isInvalidAccount({ code: "session_not_found" })).toBe(true);
  });
  it("keeps sessions on network and server failures", () => {
    expect(isInvalidAccount(new TypeError("Failed to fetch"))).toBe(false);
    expect(isInvalidAccount({ status: 503 })).toBe(false);
  });
});

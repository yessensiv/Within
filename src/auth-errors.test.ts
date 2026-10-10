import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("Сообщения авторизации", () => {
  it("отличает лимит писем от сбоя сети", () => {
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 }, "forgot"))
      .toContain("Лимит отправки писем");
    expect(authErrorMessage({ status: 429 }, "forgot")).toContain("Слишком много запросов");
    expect(authErrorMessage({ name: "AuthRetryableFetchError" }, "forgot"))
      .toContain("Проверь соединение");
  });
  it("поясняет подтверждение почты без показа внутренней ошибки", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" }, "login"))
      .toContain("Подтверди email");
    expect(authErrorMessage({ message: "private server detail" }, "forgot"))
      .not.toContain("private server detail");
  });
});

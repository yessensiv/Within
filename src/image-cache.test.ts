import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedImageUrl, loadImageUrl } from "./image-cache";

afterEach(() => vi.useRealTimers());
describe("Кэш изображений", () => {
  it("объединяет запросы карточки и панели и повторное открытие", async () => {
    const source = { url: vi.fn().mockResolvedValue("signed-image") };
    await Promise.all([loadImageUrl(source, "covers", "photo"), loadImageUrl(source, "covers", "photo")]);
    expect(cachedImageUrl(source, "covers", "photo")).toBe("signed-image");
    await loadImageUrl(source, "covers", "photo");
    expect(source.url).toHaveBeenCalledTimes(1);
  });
  it("обновляет истекающую ссылку и изолирует аккаунты", async () => {
    vi.useFakeTimers();
    const first = { url: vi.fn().mockResolvedValue("first") };
    const second = { url: vi.fn().mockResolvedValue("second") };
    await loadImageUrl(first, "covers", "photo");
    expect(cachedImageUrl(second, "covers", "photo")).toBe("");
    vi.advanceTimersByTime(240_001);
    expect(cachedImageUrl(first, "covers", "photo")).toBe("");
    await loadImageUrl(first, "covers", "photo");
    expect(first.url).toHaveBeenCalledTimes(2);
  });
  it("позволяет повторить запрос после ошибки", async () => {
    const source = { url: vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue("retry") };
    await expect(loadImageUrl(source, "avatars", "photo")).rejects.toThrow("network");
    await expect(loadImageUrl(source, "avatars", "photo")).resolves.toBe("retry");
  });
});

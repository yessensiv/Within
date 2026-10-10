import { beforeEach, describe, it, expect, vi } from "vitest";
import { LocalRepository, validateImage } from "./repository";
import { saveNoteSerial } from "./drafts";
import { seed, stamp, completion, today } from "./domain";
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
});
describe("Демо-репозиторий", () => {
  it("данные сохраняются между экземплярами", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    const g = { ...d.goals[0], title: "Изменённая цель" };
    await repo.put("goals", g);
    expect(
      (await new LocalRepository().load()).goals.find((r) => r.id === g.id)
        ?.title,
    ).toBe(g.title);
  });
  it("два запроса конвертации дают одну цель и сохраняют запись", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    const n = d.notes[0];
    const g = { ...d.goals[0], id: crypto.randomUUID() };
    const first = await repo.convert(n, g);
    const second = await repo.convert(n, { ...g, id: crypto.randomUUID() });
    const result = await repo.load();
    expect(second).toBe(first);
    expect(result.goals).toHaveLength(d.goals.length + 1);
    expect(result.notes[0].body).toBe(n.body);
    expect(result.notes[0].goal_id).toBe(first);
  });
  it("одно воспоминание на цель", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    const m = {
      id: "1",
      user_id: "demo",
      goal_id: d.goals[0].id,
      body: "Первое",
      is_public: false,
      created_at: stamp(),
      updated_at: stamp(),
    };
    await repo.put("memories", m);
    await repo.put("memories", { ...m, id: "2", body: "Второе" });
    expect((await repo.load()).memories).toHaveLength(1);
    expect((await repo.load()).memories[0].body).toBe("Второе");
  });
  it("мягкое удаление и восстановление не разрывают связи", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    const g = d.goals[0];
    await repo.convert(d.notes[0], { ...g, id: "linked-goal" });
    await repo.put("memories", {
      id: "m",
      user_id: "demo",
      goal_id: "linked-goal",
      body: "Воспоминание",
      is_public: false,
      created_at: stamp(),
      updated_at: stamp(),
    });
    let target = (await repo.load()).goals.find((g) => g.id === "linked-goal")!;
    await repo.put("goals", { ...target, deleted_at: stamp() });
    await repo.put("goals", { ...target, deleted_at: null });
    const after = await repo.load();
    expect(after.notes[0].goal_id).toBe("linked-goal");
    expect(after.memories[0].body).toBe("Воспоминание");
  });
  it("навсегда удалённая цель обнуляет связь и удаляет воспоминание", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    const g = { ...d.goals[0], id: "permanent" };
    await repo.convert(d.notes[0], g);
    await repo.put("memories", {
      id: "m",
      user_id: "demo",
      goal_id: g.id,
      body: "Текст",
      is_public: false,
      created_at: stamp(),
      updated_at: stamp(),
    });
    await repo.remove("goals", g.id);
    const after = await repo.load();
    expect(after.notes[0].goal_id).toBeNull();
    expect(after.memories).toHaveLength(0);
  });
  it("очищает только корзину старше 30 дней", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    await repo.put("goals", {
      ...d.goals[0],
      deleted_at: new Date(Date.now() - 31 * 86400000).toISOString(),
    });
    await repo.put("goals", { ...d.goals[1], deleted_at: stamp() });
    await repo.purge();
    const after = await repo.load();
    expect(after.goals.find((g) => g.id === d.goals[0].id)).toBeUndefined();
    expect(after.goals.find((g) => g.id === d.goals[1].id)).toBeDefined();
  });
  it("сохранение текста не затирает закрепление и связь", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    const n = d.notes[0];
    await repo.convert(n, { ...d.goals[0], id: "goal" });
    await repo.put("notes", { ...(await repo.load()).notes[0], pinned: true });
    await repo.saveNote({
      ...n,
      body: "Последняя версия",
      goal_id: null,
      pinned: false,
    });
    const after = (await repo.load()).notes[0];
    expect(after.goal_id).toBe("goal");
    expect(after.pinned).toBe(true);
    expect(after.body).toBe("Последняя версия");
  });
  it("публичные данные не содержат записей, фотографий или приватных воспоминаний", async () => {
    const repo = new LocalRepository();
    const d = await repo.load();
    await repo.put("profiles", {
      ...d.profile,
      is_public: true,
      public_slug: "long-public-slug",
    });
    await repo.put("goals", {
      ...completion(d.goals[0], today()),
      is_public: true,
      cover_path: "private-path",
    });
    const result = await repo.public("long-public-slug");
    expect(JSON.stringify(result)).not.toContain("private-path");
    expect(JSON.stringify(result)).not.toContain(d.notes[0].body);
    expect(result.goals).toHaveLength(1);
    await repo.put("profiles", {
      ...d.profile,
      is_public: false,
      public_slug: "long-public-slug",
    });
    expect(await repo.public("long-public-slug")).toEqual(
      await repo.public("missing-slug"),
    );
  });
  it("проверяет размер и тип изображения", () => {
    expect(() =>
      validateImage({ size: 6 * 1024 * 1024, type: "image/png" } as File),
    ).toThrow("5 МБ");
    expect(() =>
      validateImage({ size: 100, type: "image/svg+xml" } as File),
    ).toThrow("JPEG");
    expect(() =>
      validateImage({ size: 100, type: "image/webp" } as File),
    ).not.toThrow();
  });
});
describe("Очередь сохранения черновиков", () => {
  it("последняя версия побеждает при медленном первом запросе", async () => {
    const n = seed().notes[0];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const writes: string[] = [];
    let index = 0;
    const write = async (row: typeof n) => {
      if (index++ === 0) await gate;
      writes.push(row.body);
    };
    const a = saveNoteSerial(
      { ...n, updated_at: "2026-01-01T00:00:00.000Z", body: "Первая" },
      write,
    );
    const b = saveNoteSerial(
      { ...n, updated_at: "2026-01-01T00:00:01.000Z", body: "Последняя" },
      write,
    );
    release();
    await Promise.all([a, b]);
    expect(writes).toEqual(["Первая", "Последняя"]);
  });
  it("сбой не блокирует повтор и старый снимок не затирает новый", async () => {
    const n = seed().notes[0];
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    await expect(
      saveNoteSerial({ ...n, updated_at: "2026-01-02", body: "новая" }, write),
    ).rejects.toThrow("offline");
    await saveNoteSerial(
      { ...n, updated_at: "2026-01-02", body: "новая" },
      write,
    );
    await saveNoteSerial(
      { ...n, updated_at: "2026-01-01", body: "старая" },
      write,
    );
    expect(write).toHaveBeenCalledTimes(2);
  });
});

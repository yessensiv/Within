import { describe, it, expect } from "vitest";
import {
  seed,
  filterGoals,
  sortGoals,
  sortNotes,
  completion,
  today,
  publicData,
  linkedGoal,
  slug,
  plain,
} from "./domain";
describe("Мои цели", () => {
  it("сортирует записи, сохраняя закреплённые сверху и исходные данные", () => {
    const base = seed().notes[0];
    const notes = [
      {
        ...base,
        id: "b",
        title: "Билет",
        pinned: false,
        created_at: "2026-10-02T00:00:00Z",
      },
      {
        ...base,
        id: "p",
        title: "Ясность",
        pinned: true,
        created_at: "2026-10-01T00:00:00Z",
      },
      {
        ...base,
        id: "a",
        title: "Альбом",
        pinned: false,
        created_at: "2026-10-03T00:00:00Z",
      },
    ];
    expect(sortNotes(notes, "newest").map((n) => n.id)).toEqual([
      "p",
      "a",
      "b",
    ]);
    expect(sortNotes(notes, "oldest").map((n) => n.id)).toEqual([
      "p",
      "b",
      "a",
    ]);
    expect(sortNotes(notes, "title").map((n) => n.id)).toEqual(["p", "a", "b"]);
    expect(notes.map((n) => n.id)).toEqual(["b", "p", "a"]);
  });
  it("сортирует по дате создания и русскому названию, не меняя исходный массив", () => {
    const base = seed().goals[0];
    const goals = [
      {
        ...base,
        id: "b",
        title: "Билет 10",
        created_at: "2026-10-02T00:00:00Z",
      },
      { ...base, id: "a", title: "Альбом", created_at: "2026-10-03T00:00:00Z" },
      {
        ...base,
        id: "c",
        title: "Билет 2",
        created_at: "2026-10-01T00:00:00Z",
      },
    ];
    expect(sortGoals(goals, "newest").map((g) => g.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortGoals(goals, "oldest").map((g) => g.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(sortGoals(goals, "title").map((g) => g.id)).toEqual(["a", "c", "b"]);
    expect(goals.map((g) => g.id)).toEqual(["b", "a", "c"]);
  });
  it("поиск по названию и описанию, категории и статусы", () => {
    const d = seed();
    expect(
      filterGoals(d.goals, "СЕВЕРНОЕ", "Все", "Все категории"),
    ).toHaveLength(1);
    expect(
      filterGoals(d.goals, "меняет цвета", "Не выполнено", "Путешествия"),
    ).toHaveLength(1);
    expect(filterGoals(d.goals, "", "Выполнено", "Все категории")).toHaveLength(
      1,
    );
    expect(filterGoals(d.goals, "", "Все", "Деньги")).toHaveLength(0);
  });
  it("исключает корзину", () => {
    const d = seed();
    d.goals[0].deleted_at = new Date().toISOString();
    expect(
      filterGoals(d.goals, "северное", "Все", "Все категории"),
    ).toHaveLength(0);
  });
  it("выполнение и отмена сохраняют воспоминание", () => {
    const d = seed();
    const g = d.goals[0];
    d.memories.push({
      id: "m",
      user_id: "demo",
      goal_id: g.id,
      body: "Помню",
      is_public: false,
      created_at: "",
      updated_at: "",
    });
    d.goals[0] = completion(g, today());
    expect(d.goals[0].completed_on).toBe(today());
    d.goals[0] = completion(d.goals[0], null);
    expect(d.goals[0].completed_on).toBeNull();
    expect(d.memories[0].body).toBe("Помню");
    expect(
      d.goals
        .filter((g) => g.completed_on)
        .some((g) => g.id === d.memories[0].goal_id),
    ).toBe(false);
    d.goals[0] = completion(d.goals[0], today());
    expect(d.memories.find((m) => m.goal_id === d.goals[0].id)?.body).toBe(
      "Помню",
    );
  });
  it("запрещает будущую дату", () => {
    expect(() => completion(seed().goals[0], "2999-01-01")).toThrow();
  });
  it("связь не создаёт дубликат", () => {
    const d = seed();
    const n = d.notes[0];
    const g = d.goals[0];
    expect(linkedGoal(d, n, g)).toBe(g);
    n.goal_id = g.id;
    expect(linkedGoal(d, n, d.goals[1])).toBe(g);
  });
  it("слаг длинный и случайный", () => {
    const a = slug();
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(slug()).not.toBe(a);
    expect(a).toMatch(/^[a-f0-9]+$/);
    expect(slug("existing-random-slug")).toBe("existing-random-slug");
  });
  it("описание из записи — чистый текст не длиннее 500 символов", () => {
    expect(
      plain(
        "## Название\n- **Текст** и [ссылка](https://example.com)<b> ещё</b>",
      ),
    ).toBe(" Название\nТекст и ссылка ещё");
    expect(plain("а".repeat(700))).toHaveLength(500);
  });
  it("публичный профиль раскрывает только разрешённые выполненные цели", () => {
    const d = seed();
    d.goals[0].is_public = true;
    d.goals[4].is_public = true;
    expect(publicData(d).goals).toHaveLength(0);
    d.profile.is_public = true;
    expect(publicData(d).goals).toHaveLength(1);
    expect(Object.keys(publicData(d).goals[0]).sort()).toEqual([
      "body",
      "category",
      "completed_on",
      "title",
    ]);
  });
});

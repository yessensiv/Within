export const categories = [
  "Путешествия",
  "Карьера",
  "Здоровье",
  "Деньги",
  "Творчество",
  "Отношения",
  "Личное",
] as const;
export type Category = (typeof categories)[number];
export type Goal = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: Category;
  cover_path: string | null;
  completed_on: string | null;
  is_public: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Note = {
  tags?: string[];
  id: string;
  user_id: string;
  title: string;
  body: string;
  pinned: boolean;
  goal_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Memory = {
  id: string;
  user_id: string;
  goal_id: string;
  body: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};
export type Profile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};
export type Data = {
  profile: Profile;
  goals: Goal[];
  notes: Note[];
  memories: Memory[];
};
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const stamp = () => new Date().toISOString();
export const slug = (existing?: string | null) =>
  existing || crypto.randomUUID().replaceAll("-", "");
export function filterGoals(
  goals: Goal[],
  query: string,
  status: string,
  category: string,
) {
  const q = query.toLocaleLowerCase("ru").trim();
  return goals.filter(
    (g) =>
      !g.deleted_at &&
      `${g.title} ${g.description}`.toLocaleLowerCase("ru").includes(q) &&
      (status === "Все" ||
        (status === "Выполнено" ? !!g.completed_on : !g.completed_on)) &&
      (category === "Все категории" || g.category === category),
  );
}
export type GoalSort = "newest" | "oldest" | "title";
function compareOrder(
  a: Pick<Goal, "title" | "created_at">,
  b: Pick<Goal, "title" | "created_at">,
  order: GoalSort,
) {
  if (order === "title") {
    return a.title.localeCompare(b.title, "ru", {
      numeric: true,
      sensitivity: "base",
    });
  }
  const difference = Date.parse(a.created_at) - Date.parse(b.created_at);
  return order === "oldest" ? difference : -difference;
}
export function sortGoals(goals: Goal[], order: GoalSort): Goal[] {
  return [...goals].sort((a, b) => compareOrder(a, b, order));
}
export function sortNotes(notes: Note[], order: GoalSort): Note[] {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || compareOrder(a, b, order),
  );
}
export function completion(g: Goal, date: string | null): Goal {
  if (date && date > today()) throw new Error("Будущая дата недопустима");
  return { ...g, completed_on: date, updated_at: stamp() };
}
export function publicData(d: Data) {
  if (!d.profile.is_public) return { name: "", goals: [] };
  return {
    name: d.profile.display_name,
    goals: d.goals
      .filter((g) => g.completed_on && g.is_public && !g.deleted_at)
      .map((g) => ({
        title: g.title,
        category: g.category,
        completed_on: g.completed_on,
        body:
          d.memories.find((m) => m.goal_id === g.id && m.is_public)?.body ??
          null,
      })),
  };
}
export function linkedGoal(d: Data, n: Note, input: Goal) {
  if (n.goal_id) return d.goals.find((g) => g.id === n.goal_id)!;
  return input;
}
export function plain(md: string) {
  return md
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[\*_#>`]/g, "")
    .slice(0, 500);
}
export function seed(uid = "demo"): Data {
  const now = stamp();
  const base = {
    user_id: uid,
    description: "",
    cover_path: null,
    completed_on: null,
    is_public: false,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };
  return {
    profile: {
      id: uid,
      display_name: "Александра",
      avatar_path: null,
      is_public: false,
      public_slug: null,
      created_at: now,
      updated_at: now,
    },
    goals: [
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Увидеть северное сияние",
        description:
          "Оказаться под огромным небом, увидеть, как оно меняет цвета. И просто побыть в этом моменте.",
        category: "Путешествия",
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Научиться играть на пианино",
        description:
          "Сыграть любимую мелодию — для себя, без спешки и ожиданий.",
        category: "Творчество",
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Найти работу по душе",
        description:
          "Заниматься тем, что интересно, и чувствовать, что я на своём месте.",
        category: "Карьера",
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Пробежать свои первые 5 км",
        description: "Почувствовать лёгкость и удовольствие от движения.",
        category: "Здоровье",
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Провести выходные у моря",
        description: "Слушать волны, гулять босиком и никуда не торопиться.",
        category: "Путешествия",
        completed_on: today(),
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Собрать семейные фотографии",
        description: "Сохранить истории, которые хочется помнить.",
        category: "Отношения",
      },
    ],
    notes: [
      {
        id: crypto.randomUUID(),
        user_id: uid,
        title: "То, что хочется сохранить",
        body: "Сегодня подумала: не обязательно всё превращать в план.\n\nИногда достаточно записать мысль и дать ей немного места.\n\n**Хочу чаще замечать простые вещи.**",
        pinned: true,
        goal_id: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    memories: [],
  };
}

import type { Data, Goal, Note, Memory, Profile } from "./domain";
import { seed, stamp, publicData } from "./domain";
import { noteVersions, preserveVersion, type NoteVersion } from "./note-history";
export interface Repository {
  demo: boolean;
  load(): Promise<Data>;
  put(
    table: "goals" | "notes" | "memories" | "profiles",
    row: Goal | Note | Memory | Profile,
  ): Promise<void>;
  remove(table: "goals" | "notes", id: string): Promise<void>;
  purge(): Promise<void>;
  saveNote(note: Note): Promise<void>;
  history(uid: string, noteId: string): Promise<NoteVersion[]>;
  convert(note: Note, goal: Goal): Promise<string>;
  image(bucket: "covers" | "avatars", file: File): Promise<string>;
  url(bucket: "covers" | "avatars", path: string): Promise<string>;
  public(slug: string): Promise<{
    name: string;
    goals: {
      title: string;
      category: string;
      completed_on: string | null;
      body: string | null;
    }[];
  }>;
}
export class LocalRepository implements Repository {
  demo = true;
  key = "my-world-v1";
  read(): Data {
    const raw = localStorage.getItem(this.key);
    if (raw) return JSON.parse(raw);
    const d = seed();
    this.write(d);
    return d;
  }
  write(d: Data) {
    localStorage.setItem(this.key, JSON.stringify(d));
  }
  async load() {
    return this.read();
  }
  async put(
    table: "goals" | "notes" | "memories" | "profiles",
    row: Goal | Note | Memory | Profile,
  ) {
    const d = this.read();
    if (table === "profiles") d.profile = row as Profile;
    else {
      const rows = d[table] as (Goal | Note | Memory)[];
      const i =
        table === "memories"
          ? rows.findIndex(
              (r) => (r as Memory).goal_id === (row as Memory).goal_id,
            )
          : rows.findIndex((r) => r.id === row.id);
      if (i < 0) rows.push(row as Goal | Note | Memory);
      else rows[i] = row as Goal | Note | Memory;
    }
    this.write(d);
  }
  async remove(table: "goals" | "notes", id: string) {
    const d = this.read();
    if (table === "goals") {
      d.goals = d.goals.filter((g) => g.id !== id);
      d.memories = d.memories.filter((m) => m.goal_id !== id);
      d.notes = d.notes.map((n) =>
        n.goal_id === id ? { ...n, goal_id: null } : n,
      );
    } else d.notes = d.notes.filter((n) => n.id !== id);
    this.write(d);
  }
  async saveNote(note: Note) {
    const d = this.read();
    const i = d.notes.findIndex((n) => n.id === note.id);
    if (i < 0) throw new Error("Запись недоступна");
    preserveVersion(d.notes[i], note);
    d.notes[i].tags = note.tags || [];
    d.notes[i] = {
      ...d.notes[i],
      title: note.title,
      body: note.body,
      updated_at: note.updated_at,
    };
    this.write(d);
  }
  async history(uid: string, noteId: string) {
    return noteVersions(uid, noteId);
  }
  async convert(note: Note, goal: Goal) {
    const d = this.read();
    const n = d.notes.find((n) => n.id === note.id && !n.deleted_at);
    if (!n) throw new Error("Запись недоступна");
    if (n.goal_id) return n.goal_id;
    d.goals.unshift(goal);
    n.goal_id = goal.id;
    n.updated_at = stamp();
    this.write(d);
    return goal.id;
  }
  async purge() {
    const d = this.read();
    for (const table of ["goals", "notes"] as const)
      for (const r of d[table])
        if (
          r.deleted_at &&
          Date.now() - Date.parse(r.deleted_at) > 30 * 86400000
        )
          await this.remove(table, r.id);
  }
  async image(_: string, file: File) {
    validateImage(file);
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  async url(_: string, path: string) {
    return path;
  }
  async public(s: string) {
    const d = this.read();
    return d.profile.public_slug === s
      ? publicData(d)
      : { name: "", goals: [] };
  }
}
export function validateImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Выберите JPEG, PNG или WebP");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Изображение должно быть меньше 5 МБ");
}
export const draftKey = (uid: string, id: string) =>
  `my-world-draft:${uid}:${id}`;
export { stamp };

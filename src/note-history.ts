import type { Note } from "./domain";
export type NoteVersion = { id: string; title: string; body: string; saved_at: string };
const key = (uid: string, id: string) => `within-history:${uid}:${id}`;
export function noteVersions(uid: string, id: string): NoteVersion[] {
  try { return JSON.parse(localStorage.getItem(key(uid, id)) || "[]"); } catch { return []; }
}
export function preserveVersion(note: Note, next: Note) {
  if (note.title === next.title && note.body === next.body) return;
  const versions = noteVersions(note.user_id, note.id);
  if (versions[0]?.title === note.title && versions[0]?.body === note.body) return;
  versions.unshift({ id: crypto.randomUUID(), title: note.title, body: note.body, saved_at: note.updated_at });
  localStorage.setItem(key(note.user_id, note.id), JSON.stringify(versions.slice(0, 100)));
}

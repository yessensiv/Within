import type { Note } from "./domain";
const memoryDrafts = new Map<string, Note>();
export function rememberDraft(key: string, note: Note) {
  memoryDrafts.set(key, { ...note });
  localStorage.setItem(key, JSON.stringify(note));
}
export function readDraft(key: string): Note | null {
  const cached = memoryDrafts.get(key);
  if (cached) return cached;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
export function clearDraft(key: string) {
  memoryDrafts.delete(key);
  localStorage.removeItem(key);
}
// Очередь общая для всех редакторов: повторное открытие записи не запускает параллельную запись.
const queues = new Map<string, { tail: Promise<void>; newest: string }>();
export function saveNoteSerial(
  note: Note,
  write: (n: Note) => Promise<void>,
): Promise<void> {
  const key = note.user_id + ":" + note.id;
  const queue = queues.get(key) || { tail: Promise.resolve(), newest: "" };
  if (note.updated_at < queue.newest) return queue.tail;
  queue.newest = note.updated_at;
  const task = queue.tail.catch(() => {}).then(() => write(note));
  queue.tail = task;
  queues.set(key, queue);
  return task;
}
let flush: (() => Promise<boolean>) | null = null;
export function registerEditor(callback: () => Promise<boolean>) {
  flush = callback;
  return () => {
    if (flush === callback) flush = null;
  };
}
export async function beforeLeaveNote() {
  if (!flush) return true;
  const saved = await flush();
  return (
    saved ||
    window.confirm(
      "Запись не удалось отправить. Черновик сохранён в этом браузере. Перейти и повторить сохранение при возвращении?",
    )
  );
}

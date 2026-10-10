import { createClient, type Session } from "@supabase/supabase-js";
import type { Data, Goal, Note, Memory, Profile } from "./domain";
import type { Repository } from "./repository";
import { validateImage } from "./repository";
const env = import.meta.env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null;
export const googleEnabled = env.VITE_ENABLE_GOOGLE === "true";
export class SupabaseRepository implements Repository {
  demo = false;
  constructor(private uid: string) {}
  async load(): Promise<Data> {
    const client = supabase!;
    const results = await Promise.all([
      client.from("profiles").select("*").eq("id", this.uid).single(),
      client
        .from("goals")
        .select("*")
        .order("created_at", { ascending: false }),
      client
        .from("notes")
        .select("*")
        .order("updated_at", { ascending: false }),
      client.from("memories").select("*"),
    ]);
    for (const r of results) if (r.error) throw r.error;
    return {
      profile: results[0].data as unknown as Profile,
      goals: results[1].data as unknown as Goal[],
      notes: results[2].data as unknown as Note[],
      memories: results[3].data as unknown as Memory[],
    };
  }
  async put(
    table: "goals" | "notes" | "memories" | "profiles",
    row: Goal | Note | Memory | Profile,
  ) {
    const { error } = await supabase!
      .from(table)
      .upsert(row as unknown as Record<string, unknown>, {
        onConflict: table === "memories" ? "goal_id" : "id",
      });
    if (error) throw error;
  }
  async remove(table: "goals" | "notes", id: string) {
    const { error } = await supabase!.from(table).delete().eq("id", id);
    if (error) throw error;
  }
  async saveNote(note: Note) {
    const { error } = await supabase!
      .from("notes")
      .update({ title: note.title, body: note.body })
      .eq("id", note.id)
      .eq("user_id", this.uid);
    if (error) throw error;
  }
  async convert(note: Note, goal: Goal) {
    const { data, error } = await supabase!.rpc("goal_from_note", {
      note_id: note.id,
      goal,
    });
    if (error) throw error;
    return data as string;
  }
  async purge() {
    const { error } = await supabase!.rpc("purge_my_trash");
    if (error) throw error;
  }
  async image(bucket: "covers" | "avatars", file: File) {
    validateImage(file);
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[file.type];
    const path = `${this.uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase!.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }
  async url(bucket: "covers" | "avatars", path: string) {
    const { data, error } = await supabase!.storage
      .from(bucket)
      .createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  }
  async public(slug: string) {
    const [profile, goals] = await Promise.all([
      supabase!.rpc("public_profile_by_slug", { slug }),
      supabase!.rpc("public_goals_by_slug", { slug }),
    ]);
    if (profile.error) throw profile.error;
    if (goals.error) throw goals.error;
    return {
      name: profile.data?.[0]?.display_name || "",
      goals: goals.data || [],
    };
  }
}
export type { Session };

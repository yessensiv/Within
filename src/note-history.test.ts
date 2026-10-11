import { beforeEach, it, expect, vi } from "vitest";
import { seed } from "./domain";
import { noteVersions, preserveVersion } from "./note-history";
beforeEach(() => { const data = new Map<string,string>(); vi.stubGlobal("localStorage", { getItem:(k:string)=>data.get(k) ?? null, setItem:(k:string,v:string)=>data.set(k,v) }); });
it("preserves previous content without duplicate or metadata-only versions", () => {
 const n=seed().notes[0]; preserveVersion(n,{...n,pinned:true}); expect(noteVersions(n.user_id,n.id)).toHaveLength(0);
 preserveVersion(n,{...n,body:"new"}); preserveVersion(n,{...n,body:"new"});
 expect(noteVersions(n.user_id,n.id)).toHaveLength(1); expect(noteVersions(n.user_id,n.id)[0].body).toBe(n.body);
 expect(noteVersions("another-user",n.id)).toHaveLength(0);
});
it("preserves the replaced version when restoring old text", () => {
 const n=seed().notes[0], changed={...n,body:"new"}; preserveVersion(n,changed); preserveVersion(changed,n);
 expect(noteVersions(n.user_id,n.id).map(v=>v.body)).toEqual(["new",n.body]);
});

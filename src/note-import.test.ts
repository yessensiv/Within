import { describe, it, expect } from "vitest";
import { normalizeTags, parseMarkdown } from "./note-import";
describe("Markdown and tags", () => {
  it("preserves Markdown and derives title", () => {
    expect(parseMarkdown("thought.md", "\uFEFF# Мысль\r\n\r\n**Текст**")).toEqual({title:"Мысль",body:"# Мысль\n\n**Текст**"});
  });
  it("uses filename when heading absent", () => expect(parseMarkdown("Идеи.markdown", "текст").title).toBe("Идеи"));
  it("normalizes duplicates and limits tag length and count", () => {
    expect(normalizeTags([" Работа ", "работа", "", "Идеи"])).toEqual(["работа","идеи"]);
    expect(normalizeTags(Array.from({length:20},(_,i)=>String(i)))).toHaveLength(12);
  });
});

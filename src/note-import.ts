export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(t => t.trim().toLocaleLowerCase("ru").slice(0, 40)).filter(Boolean))].slice(0, 12);
}
export function parseMarkdown(name: string, source: string) {
  const body = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const heading = body.match(/^#\s+(.+)$/m)?.[1].trim();
  return { title: heading || name.replace(/\.(md|markdown)$/i, "") || "Импортированная запись", body };
}

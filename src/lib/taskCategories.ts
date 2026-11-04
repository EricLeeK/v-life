/** The same open vocabulary is used by personal tasks and projects. */
export function taskCategory(value?: string | null): string {
  const category = value?.trim();
  return !category || category === "Uncategorized" ? "未分类" : category;
}

export function taskCategories(...sources: Array<ReadonlyArray<{ category?: string | null }>>): string[] {
  return [...new Set(sources.flat().map(row => taskCategory(row.category)))]
    .filter(category => category !== "未分类");
}

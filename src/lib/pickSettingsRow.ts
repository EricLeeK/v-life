export type SettingsLike = {
  display_name?: string | null;
  fortune_profile?: unknown;
  updated_at?: string | null;
};

function completeness(row: SettingsLike): number {
  return (row.display_name?.trim() ? 2 : 0) + (row.fortune_profile ? 1 : 0);
}

/** When a user has duplicate settings rows, keep the most complete (then newest) one. */
export function pickSettingsRow<T extends SettingsLike>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const byScore = completeness(b) - completeness(a);
    if (byScore !== 0) return byScore;
    return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
  })[0];
}

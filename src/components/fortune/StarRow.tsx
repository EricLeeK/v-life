export function starsText(n: number): string {
  const v = Math.max(1, Math.min(5, Math.round(n)));
  return "★".repeat(v) + "☆".repeat(5 - v);
}

export function StarRow({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-lg bg-[#f4f3ee] px-2 py-2 text-center text-[11px] text-[#5c564c]">
      <div>{label}</div>
      <div className="mt-0.5 font-semibold text-[#1f1a14]">{starsText(value)}</div>
    </div>
  );
}

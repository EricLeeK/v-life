export function starsText(n: number): string {
  const v = Math.max(1, Math.min(5, Math.round(n)));
  return "★".repeat(v) + "☆".repeat(5 - v);
}

export function MetricStarCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="card-premium min-w-0 p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">{label}</p>
      <p className="mt-1 font-mono-data text-[22px] font-semibold tracking-tight text-[#1f1a14] sm:text-[28px]">
        {value}
        <span className="ml-1 text-[12px] font-normal text-[#8a847a]">/5</span>
      </p>
      <p className="mt-1 text-[12px] text-[#c49840]">{starsText(value)}</p>
      {hint && <p className="mt-1 text-[11px] text-[#8a847a]">{hint}</p>}
    </div>
  );
}

export function MetricPercentCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="card-premium min-w-0 p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">{label}</p>
      <p className="mt-1 font-mono-data text-[22px] font-semibold tracking-tight text-[#1f1a14] sm:text-[28px]">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-[#8a847a]">{hint}</p>}
    </div>
  );
}

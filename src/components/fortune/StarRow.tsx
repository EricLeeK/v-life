import { Paragraph } from "@/components/ui/typography";
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
      <Paragraph className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Paragraph>
      <Paragraph className="mt-1 font-mono-data text-[22px] font-semibold tracking-tight text-foreground sm:text-[28px]">
        {value}
        <span className="ml-1 text-[12px] font-normal text-muted-foreground">/5</span>
      </Paragraph>
      <Paragraph className="mt-1 text-[12px] text-cat-yellow">{starsText(value)}</Paragraph>
      {hint && <Paragraph className="mt-1 text-[11px] text-muted-foreground">{hint}</Paragraph>}
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
      <Paragraph className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Paragraph>
      <Paragraph className="mt-1 font-mono-data text-[22px] font-semibold tracking-tight text-foreground sm:text-[28px]">
        {value}
      </Paragraph>
      {hint && <Paragraph className="mt-1 text-[11px] text-muted-foreground">{hint}</Paragraph>}
    </div>
  );
}

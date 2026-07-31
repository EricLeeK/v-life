import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function FortunePageHeader(props: {
  title: string;
  subtitle?: string;
  backLabel: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Link
          to="/fortune"
          className="mb-3 inline-flex items-center gap-1 text-[12px] text-[#8a847a] transition-colors hover:text-[#1f1a14]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {props.backLabel}
        </Link>
        <h1
          className="font-bold leading-[1.1] tracking-tight text-[#1f1a14] heading-font"
          style={{ fontSize: "clamp(28px, 3.6vw, 48px)" }}
        >
          {props.title}
        </h1>
        {props.subtitle && (
          <p className="mt-2 text-[14px] text-[#8a847a]">{props.subtitle}</p>
        )}
      </div>
      {props.actions && <div className="shrink-0">{props.actions}</div>}
    </div>
  );
}

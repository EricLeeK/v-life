import { Heading, Paragraph } from "@/components/ui/typography";
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
          className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {props.backLabel}
        </Link>
        <Heading as="h1"
          className="font-semibold leading-[1.15] tracking-tight text-foreground heading-font"
          style={{ fontSize: "clamp(28px, 3.2vw, 42px)" }}
        >
          {props.title}
        </Heading>
        {props.subtitle && (
          <Paragraph className="mt-2 text-[14px] text-muted-foreground">{props.subtitle}</Paragraph>
        )}
      </div>
      {props.actions && <div className="shrink-0">{props.actions}</div>}
    </div>
  );
}

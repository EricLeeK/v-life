import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import "./preparation.css";

const destinations = [
  ["overview", "备考总览", "/preparation"],
  ["questions", "错题库", "/preparation/questions"],
  ["banks", "题库与材料", "/preparation/banks"],
  ["integration", "V 记连接", "/preparation/integration"],
] as const;

export function PrepShell({
  title,
  active = "overview",
  back,
  actions,
  children,
  focus = false,
}: {
  title: string;
  active?: string;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
  focus?: boolean;
}) {
  return (
    <AppLayout header={false} title="备考">
      <div className={`prep-workspace ${focus ? "prep-workspace--focus" : ""}`}>
        <header className="prep-heading">
          <div className="prep-heading-name">
            {back && (
              <Link className="prep-back" to={back} aria-label="返回备考">
                <ArrowLeft size={18} />
              </Link>
            )}
            <h1>{title}</h1>
            {focus && <span className="prep-focus-label">专注作答</span>}
          </div>
          <div className="prep-heading-actions">{actions}</div>
        </header>
        {!focus && (
          <nav className="prep-navigation" aria-label="备考导航">
            {destinations.map(([key, label, to]) => (
              <Link
                key={key}
                to={to}
                aria-current={active === key ? "page" : undefined}
              >
                {label}
                {key === "integration" && <ArrowUpRight size={13} />}
              </Link>
            ))}
          </nav>
        )}
        <div className="prep-page-content">{children}</div>
      </div>
    </AppLayout>
  );
}

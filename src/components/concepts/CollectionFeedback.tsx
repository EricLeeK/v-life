import type { ReactNode } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

/** Empty artwork is only shown after the owning query has resolved successfully. */
export function CollectionFeedback({ loading, error, retry, children }: {
  loading?: boolean;
  error?: unknown;
  retry?: () => unknown;
  children: ReactNode;
}) {
  const { t } = useLang();
  if (loading) return <div role="status" className="concept-feedback text-muted-foreground">
    <span className="concept-loading-line" aria-hidden="true" />
    <p>{t("正在读取记录…", "Loading records…")}</p>
  </div>;
  if (error) return <div role="alert" className="concept-feedback">
    <p>{t("暂时无法读取记录", "Records could not be loaded")}</p>
    <p className="text-sm text-muted-foreground">{t("请重试，已有记录仍会保留。", "Please retry. Your saved records are kept.")}</p>
    {retry && <Button variant="outline" onClick={() => { void retry(); }}>{t("重新加载", "Try again")}</Button>}
  </div>;
  return <>{children}</>;
}

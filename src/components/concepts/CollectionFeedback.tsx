import { Paragraph } from "@/components/ui/typography";
import type { ReactNode } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { SkeletonBox } from "skullet/react";
import { Button } from "@/components/ui/button";

/** Empty artwork is only shown after the owning query has resolved successfully. */
export function CollectionFeedback({ loading, error, retry, skeleton, children }: {
  loading?: boolean;
  error?: unknown;
  retry?: () => unknown;
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLang();
  if (loading) return <div role="status" aria-busy="true" aria-label={t("正在加载内容", "Loading content")} className="w-full space-y-3 py-3">
    {skeleton ?? Array.from({ length: 5 }, (_, index) => <SkeletonBox key={index} className="block h-14 w-full rounded-md bg-muted" style={{ height: undefined, width: undefined, borderRadius: undefined }} />)}
  </div>;
  if (error) return <div role="alert" className="concept-feedback">
    <Paragraph>{t("暂时无法读取记录", "Records could not be loaded")}</Paragraph>
    <Paragraph className="text-sm text-muted-foreground">{t("请重试，已有记录仍会保留。", "Please retry. Your saved records are kept.")}</Paragraph>
    {retry && <Button variant="outline" onClick={() => { void retry(); }}>{t("重新加载", "Try again")}</Button>}
  </div>;
  return <>{children}</>;
}

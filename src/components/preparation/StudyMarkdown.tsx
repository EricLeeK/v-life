import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/** One reading surface for notes, materials, question stems and explanations. */
type MarkdownProps = { children: string; variant?: "note" | "question" };
export function StudyMarkdown({ children, variant = "note" }: MarkdownProps) {
  if (!/asset:[0-9a-f-]{36}/.test(children))
    return <MarkdownContent variant={variant}>{children}</MarkdownContent>;
  return <AssetMarkdown variant={variant}>{children}</AssetMarkdown>;
}
function AssetMarkdown({ children, variant }: MarkdownProps) {
  const ids = [
    ...new Set(
      [...children.matchAll(/asset:([0-9a-f-]{36})/g)].map((m) => m[1]),
    ),
  ];
  const resolved = useQuery({
    queryKey: ["prep-assets", ...ids],
    enabled: ids.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          ids.map(async (id) => {
            const { data, error } = await supabase.functions.invoke(
              "prep-api",
              { body: { action: "asset_url", input: { id } } },
            );
            if (error || data?.error) throw error || new Error(data.error);
            return [id, data.data.signedUrl || data.data.url];
          }),
        ),
      ),
  });
  const markdown = children.replace(
    /asset:([0-9a-f-]{36})/g,
    (_, id) => resolved.data?.[id] || "",
  );
  return (
    <>
      {resolved.isError && (
        <p role="alert" className="text-sm text-destructive">
          图片加载失败。
          <button onClick={() => resolved.refetch()} className="underline">
            重试
          </button>
        </p>
      )}
      <MarkdownContent variant={variant}>{markdown}</MarkdownContent>
    </>
  );
}
function MarkdownContent({ children, variant }: MarkdownProps) {
  return (
    <div
      className={`${variant === "question" ? "prep-reading" : "obsidian-markdown"} min-w-0 break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:object-contain [&_pre]:overflow-x-auto ${variant==="question"?"":"[&_table]:block [&_table]:overflow-x-auto"}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          table: ({children}) => variant==="question" ? <div className="prep-table-scroll"><table>{children}</table></div> : <table>{children}</table>,
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || "题目配图"}
              loading="lazy"
              className="mx-auto max-h-[32rem]"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

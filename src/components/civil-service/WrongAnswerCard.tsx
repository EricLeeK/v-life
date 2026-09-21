import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import type { CivilWrongAnswer } from "@/hooks/useCivilService";

export type WrongOption = { key: string; text: string };

const inlineMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <span className="inline">{children}</span>,
};

function parseOptions(raw: CivilWrongAnswer["options"]): WrongOption[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((o): o is WrongOption => typeof o === "object" && o !== null && "key" in o && "text" in o)
    .map((o) => ({ key: String(o.key), text: String(o.text) }));
}

function isCorrectKey(correctAnswer: string | null, key: string): boolean {
  if (!correctAnswer) return false;
  return correctAnswer.toUpperCase().includes(key.toUpperCase());
}

export function WrongAnswerCard({ item }: { item: CivilWrongAnswer }) {
  const { t } = useLang();
  const [selectedKey, setSelectedKey] = useState<string | null>(item.user_answer || null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const options = parseOptions(item.options);
  const hasImage = !!item.image_url;
  const showInlineImage = hasImage && item.image_required;

  const markdownPlugins = [remarkGfm, remarkMath];
  const rehypePlugins = [rehypeKatex];

  return (
    <div className="space-y-3">
      {item.title && (
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
      )}

      {item.content && (
        <div className="wrong-answer-serif wrong-answer-body prose max-w-none text-foreground">
          <ReactMarkdown remarkPlugins={markdownPlugins} rehypePlugins={rehypePlugins}>
            {item.content}
          </ReactMarkdown>
        </div>
      )}

      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const isSelected = selectedKey === opt.key;
            const isCorrect = showAnswer && isCorrectKey(item.correct_answer, opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelectedKey(isSelected ? null : opt.key)}
                className={[
                  "wrong-answer-serif inline-flex max-w-full items-baseline gap-1 rounded-md border px-2 py-1.5 text-left transition-colors",
                  isCorrect
                    ? "border-cat-green/60 bg-cat-green-bg text-cat-green"
                    : isSelected
                      ? "border-cat-orange/60 bg-cat-orange-bg text-foreground"
                      : "border-border bg-card text-foreground hover:border-cat-orange/50 hover:bg-muted/50",
                ].join(" ")}
              >
                <span className="shrink-0 font-medium leading-none">{opt.key}.</span>
                <span className="wrong-answer-option-md min-w-0 [&_.katex]:text-[15px]">
                  <ReactMarkdown
                    remarkPlugins={markdownPlugins}
                    rehypePlugins={rehypePlugins}
                    components={inlineMarkdownComponents}
                  >
                    {opt.text}
                  </ReactMarkdown>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {item.correct_answer && (
        <div>
          <button
            type="button"
            onClick={() => setShowAnswer((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-cat-teal hover:text-cat-teal/80"
          >
            {showAnswer ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showAnswer ? t("收起正确答案", "Hide answer") : t("查看正确答案", "Show answer")}
          </button>
          {showAnswer && (
            <p className="mt-1 text-[13px] font-medium text-cat-green">
              {t("正确答案", "Correct answer")}：{item.correct_answer}
              {item.user_answer && item.user_answer !== item.correct_answer && (
                <span className="ml-2 text-cat-orange">
                  （{t("你的选择", "Your choice")}：{item.user_answer}）
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {item.wrong_reason && (
        <details className="rounded-md border border-cat-red/40 bg-cat-red-bg/50">
          <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-cat-red select-none">
            ❌ {t("错因分析", "Wrong reason")}
          </summary>
          <div className="wrong-answer-serif px-3 pb-2 text-cat-red/90">{item.wrong_reason}</div>
        </details>
      )}

      {item.knowledge_point && (
        <p className="text-[12px] text-cat-teal">
          {t("知识点", "Knowledge")}：{item.knowledge_point}
        </p>
      )}

      {showInlineImage && (
        <button type="button" onClick={() => setLightboxOpen(true)} className="block">
          <img
            src={item.image_url!}
            alt=""
            className="max-h-48 rounded-md border border-border object-contain cursor-zoom-in"
          />
        </button>
      )}

      {hasImage && !item.image_required && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-cat-teal"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {t("查看原图", "View image")}
        </button>
      )}

      {hasImage && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: item.image_url! }]}
        />
      )}
    </div>
  );
}

import { format, isValid, parseISO } from "date-fns";

export function questionExcerpt(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "（配图）")
    .replace(/[#*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export const questionTypeLabel = {
  single: "单选题",
  multiple: "多选题",
  judgement: "判断题",
  text: "主观题",
};

export function materialExcerpt(markdown: string) {
  const firstBlock = markdown.trim().split(/\n\s*\n/)[0];
  return questionExcerpt(firstBlock
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "")
    .replace(/\|/g, " · ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"));
}

export function examDateLabel(value: string | null | undefined) {
  const date = parseISO(value || "");
  return isValid(date) ? format(date, "yyyy.MM.dd") : "日期待设置";
}

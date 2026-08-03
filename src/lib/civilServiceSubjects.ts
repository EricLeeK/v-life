export type SubjectGroup = "xingce" | "shenlun" | "mianshi" | "general";

export const SUBJECT_GROUP_LABELS: Record<SubjectGroup, { zh: string; en: string }> = {
  xingce: { zh: "行测", en: "Xingce" },
  shenlun: { zh: "申论", en: "Shenlun" },
  mianshi: { zh: "面试", en: "Interview" },
  general: { zh: "综合", en: "General" },
};

export const SUBJECT_TAGS: Record<Exclude<SubjectGroup, "general">, string[]> = {
  xingce: [
    "套卷",
    "言语理解",
    "资料分析",
    "图形推理",
    "定义类比",
    "逻辑推理",
    "数量关系",
    "时政常识",
  ],
  shenlun: ["综应", "申论"],
  mianshi: ["理论学习", "素材积累", "热点剖析"],
};

export const EXAM_TYPES = ["国考", "省考", "事业编", "自定义"] as const;

export const SUBJECT_GROUPS: Exclude<SubjectGroup, "general">[] = ["xingce", "shenlun", "mianshi"];

export function isSubjectGroup(value: string): value is SubjectGroup {
  return value === "xingce" || value === "shenlun" || value === "mianshi" || value === "general";
}

export function tagsForGroup(group: SubjectGroup): string[] {
  if (group === "general") return [];
  return SUBJECT_TAGS[group];
}

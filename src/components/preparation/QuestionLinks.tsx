import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudyMarkdown } from "./StudyMarkdown";
import {
  useLearningCourses,
  useLearningNotes,
  useCreateLearningNote,
} from "@/hooks/useData";
import { usePreparation } from "@/hooks/usePreparation";
import { useToast } from "@/hooks/use-toast";
import type { PrepQuestion } from "@/lib/preparation/domain";
export function QuestionLinks({
  question: q,
  prep,
}: {
  question: PrepQuestion;
  prep: ReturnType<typeof usePreparation>;
}) {
  const { data: courses = [] } = useLearningCourses();
  const [course, setCourse] = useState("");
  const { data: notes = [] } = useLearningNotes(course);
  const createNote = useCreateLearningNote();
  const [note, setNote] = useState("");
  const [pitfall, setPitfall] = useState("");
  const [newPitfall, setNewPitfall] = useState("");
  const [exam, setExam] = useState("");
  const [paper, setPaper] = useState("");
  const [number, setNumber] = useState("");
  const [version, setVersion] = useState("");
  const { toast } = useToast();
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "保存失败",
        variant: "destructive",
      });
    }
  };
  const data = prep.data!;
  const history = data.attempts
    .filter((a) => a.question_id === q.id)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const versions = data.versions
    .filter((v) => v.entity === "question" && v.entity_id === q.id)
    .sort((a, b) => b.revision - a.revision);
  const select = (
    label: string,
    value: string,
    set: (v: string) => void,
    items: { id: string; name: string }[],
  ) => (
    <label className="text-sm flex-1 min-w-36">
      {label}
      <select
        className="block w-full mt-1 p-2 rounded-md border border-input bg-background"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">请选择</option>
        {items.map((v) => (
          <option value={v.id} key={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
  const state = data.states.find((s) => s.question_id === q.id);
  return (
    <div className="prep-link-panel space-y-5">
      <details>
        <summary className="cursor-pointer font-medium min-h-11">
          所属题库与适用考试
        </summary>
        <div className="space-y-3">
          {data.banks.map((b) => {
            const membership = data.bankQuestions.find(
              (x) => x.bank_id === b.id && x.question_id === q.id,
            );
            return (
              <div key={b.id} className="flex justify-between">
                <span className="text-sm">{b.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(() =>
                      membership
                        ? prep.save({
                            collection: "bankQuestions",
                            id: membership.id,
                            remove: true,
                          })
                        : prep.save({
                            collection: "bankQuestions",
                            record: { bank_id: b.id, question_id: q.id },
                          }),
                    )
                  }
                >
                  {membership ? "移出题库" : "加入题库"}
                </Button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2">
            {select("单题考试例外", exam, setExam, data.exams)}
            {[
              ["include", "单独加入"],
              ["exclude", "排除此题"],
            ].map(([mode, label]) => (
              <Button
                key={mode}
                disabled={!exam}
                variant="outline"
                onClick={() =>
                  run(() => {
                    const existing = data.exceptions.find(
                      (e) => e.exam_id === exam && e.question_id === q.id,
                    );
                    return prep.save({
                      collection: "exceptions",
                      id: existing?.id,
                      record: { question_id: q.id, exam_id: exam, mode },
                    });
                  })
                }
              >
                {label}
              </Button>
            ))}
          </div>
          {data.exceptions
            .filter((e) => e.question_id === q.id)
            .map((e) => (
              <div key={e.exam_id} className="flex justify-between text-sm">
                <span>
                  {data.exams.find((x) => x.id === e.exam_id)?.name} ·{" "}
                  {e.mode === "include" ? "单独加入" : "已排除"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    run(() =>
                      prep.save({
                        collection: "exceptions",
                        id: e.id,
                        remove: true,
                      }),
                    )
                  }
                >
                  恢复随题库
                </Button>
              </div>
            ))}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-medium min-h-11">
          关联套卷与原题号
        </summary>
        <div className="flex flex-wrap items-end gap-2">
          {select(
            "套卷",
            paper,
            setPaper,
            data.papers.map((p) => ({ id: p.id, name: p.source || p.id })),
          )}
          <label className="text-sm">
            原题号
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <Button
            disabled={!paper}
            onClick={() =>
              run(() =>
                prep.save({
                  collection: "paperQuestions",
                  record: {
                    paper_id: paper,
                    question_id: q.id,
                    source_number: number,
                  },
                }),
              )
            }
          >
            关联
          </Button>
        </div>
        {data.paperQuestions
          .filter((r) => r.question_id === q.id)
          .map((r) => (
            <p className="text-sm mt-3" key={r.id}>
              {data.papers.find((p) => p.id === r.paper_id)?.source} · 第{" "}
              {r.source_number || "—"} 题
            </p>
          ))}
      </details>
      <details>
        <summary className="cursor-pointer font-medium min-h-11">
          易错点 · 找到反复掉坑的原因
        </summary>
        <div className="flex flex-wrap items-end gap-2">
          {select(
            "已有易错点",
            pitfall,
            setPitfall,
            data.pitfalls.map((p) => ({ id: p.id, name: p.title })),
          )}
          <Button
            disabled={!pitfall}
            onClick={() =>
              run(() =>
                prep.save({
                  collection: "pitfallQuestions",
                  record: { question_id: q.id, pitfall_id: pitfall },
                }),
              )
            }
          >
            关联
          </Button>
        </div>
        <form
          className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const p = await prep.save({
                collection: "pitfalls",
                record: { title: newPitfall },
              });
              await prep.save({
                collection: "pitfallQuestions",
                record: { question_id: q.id, pitfall_id: p.id },
              });
              setNewPitfall("");
            });
          }}
        >
          <Input
            aria-label="新的易错点"
            placeholder="例如：混淆基期量和现期量"
            value={newPitfall}
            onChange={(e) => setNewPitfall(e.target.value)}
          />
          <Button disabled={!newPitfall.trim()}>新建</Button>
        </form>
        {data.pitfallQuestions
          .filter((r) => r.question_id === q.id)
          .map((r) => (
            <div key={r.id} className="mt-4">
              <p className="font-medium text-sm">
                {data.pitfalls.find((p) => p.id === r.pitfall_id)?.title}
              </p>
              <Link
                className="text-sm underline"
                to={`/preparation/questions?pitfall=${r.pitfall_id}`}
              >
                查看同类错题
              </Link>
              <Link
                className="text-sm underline ml-4"
                to={`/preparation/review?mode=practice&pitfall=${r.pitfall_id}`}
              >
                集中练习
              </Link>
            </div>
          ))}
      </details>
      <details>
        <summary className="cursor-pointer font-medium min-h-11">
          关联学习笔记
        </summary>
        <div className="flex flex-wrap gap-3 items-end">
          {select(
            "学习库",
            course,
            setCourse,
            courses.map((c) => ({ id: c.id, name: c.name })),
          )}
          {select(
            "笔记",
            note,
            setNote,
            notes.map((n) => ({ id: n.id, name: n.title })),
          )}
          <Button
            disabled={!note}
            onClick={() =>
              run(() =>
                prep.save({
                  collection: "noteLinks",
                  record: { question_id: q.id, note_id: note },
                }),
              )
            }
          >
            关联笔记
          </Button>
        </div>
        <Button
          className="mt-3"
          variant="outline"
          disabled={!course || createNote.isPending}
          onClick={() =>
            run(async () => {
              const n = await createNote.mutateAsync({
                course_id: course,
                title: q.tags[0] || q.stem_md.slice(0, 30),
                content: `${q.explanation_md}\n\n## 我的错因\n${q.analysis_md}`,
                tags: q.tags,
              });
              await prep.save({
                collection: "noteLinks",
                record: { question_id: q.id, note_id: n.id },
              });
              toast({ title: "已保存到学习笔记" });
            })
          }
        >
          将解析与错因沉淀为笔记
        </Button>
        {data.noteLinks
          .filter((r) => r.question_id === q.id)
          .map((r) => (
            <p className="mt-3 text-sm" key={r.id}>
              <Link
                className="underline"
                to={`/learning-notes?note=${r.note_id}`}
              >
                {notes.find((n) => n.id === r.note_id)?.title || "打开关联笔记"}
              </Link>
            </p>
          ))}
      </details>
      <details>
        <summary className="cursor-pointer font-medium min-h-11">
          历史作答与内容版本（{history.length} 次）
        </summary>
        {history.map((a) => (
          <div key={a.id} className="text-sm border-b border-border py-3">
            <p>
              {a.created_at ? new Date(a.created_at).toLocaleString() : "刚刚"}{" "}
              ·{" "}
              {a.correct === true
                ? "答对"
                : a.correct === false
                  ? "答错"
                  : "未判定"}
              {a.yellow ? " · 黄题" : ""} · {a.duration_seconds ?? "—"} 秒 ·{" "}
              {a.mode === "review" ? "复习" : "练习"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {a.reason_tags?.join(" · ")} · 内容 v{a.content_revision}
            </p>
          </div>
        ))}
        {select(
          "查看历史题面",
          version,
          setVersion,
          versions.map((v) => ({ id: v.id, name: `v${v.revision}` })),
        )}
        {version && (
          <StudyMarkdown variant="question">
            {versions.find((v) => v.id === version)?.content.stem_md || ""}
          </StudyMarkdown>
        )}
      </details>
      {state && (
        <Button
          variant="outline"
          onClick={() =>
            run(() =>
              prep.save({
                collection: "states",
                id: q.id,
                record: { paused: !state.paused },
              }),
            )
          }
        >
          {state.paused ? "重新启用复习" : "暂停此题复习"}
        </Button>
      )}
    </div>
  );
}

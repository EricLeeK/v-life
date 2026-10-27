import { DateField } from "@/components/arc/DateField";
import { PaperTrends } from "@/components/preparation/PaperTrends";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { differenceInCalendarDays, parseISO, format, isValid } from "date-fns";
import {
  ArrowRight,
  Plus,
  BookOpen,
  Settings2,
  CheckCheck,
  CalendarDays,
} from "lucide-react";
import { PrepShell } from "@/components/preparation/PrepShell";
import { examDateLabel, questionExcerpt } from "@/components/preparation/presentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePreparation, questionsForExam } from "@/hooks/usePreparation";
import { selectExamPreview, CIVIL_SECTIONS } from "@/lib/preparation/domain";
import { useToast } from "@/hooks/use-toast";

export default function PreparationPage() {
  const prep = usePreparation();
  const { examId } = useParams();
  const [search] = useSearchParams();
  const all = search.get("view") === "exams";
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [civil, setCivil] = useState(false);
  const [tab, setTab] = useState("questions");
  const [examDateDraft, setExamDateDraft] = useState<{ id: string; value: string } | null>(null);
  const [bankName, setBankName] = useState("");
  const { toast } = useToast();
  const data = prep.data;
  const exam = data?.exams.find((e) => e.id === examId);
  const today = format(new Date(), "yyyy-MM-dd");
  const report = (e: unknown) =>
    toast({
      title: e instanceof Error ? e.message : "保存失败，请重试",
      variant: "destructive",
    });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!name.trim() || !isValid(parseISO(date))) throw new Error("请填写考试名称和有效日期");
      await prep.save({
        collection: "exams",
        record: {
          name: name.trim(),
          exam_date: date,
          template: civil ? "civil" : null,
          is_primary: false,
          is_archived: false,
        },
      });
      setCreating(false);
      setName("");
      setDate("");
    } catch (e) {
      report(e);
    }
  };
  const questions = data
    ? questionsForExam(data, examId).filter((q) => q.status === "active")
    : [];
  const due = questions.filter((q) =>
    data?.states.some(
      (s) =>
        s.question_id === q.id &&
        !s.paused &&
        (!s.due_at || new Date(s.due_at) <= new Date()),
    ),
  );
  return (
    <PrepShell
      title={exam?.name || "备考"}
      back={examId ? "/preparation" : undefined}
      actions={
        !examId ? (
          <Button
            className="prep-add-exam"
            variant="outline"
            onClick={() => setCreating(!creating)}
          >
            <Plus size={16} />
            添加考试
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setTab("settings")}>
            <Settings2 size={16} />
            考试设置
          </Button>
        )
      }
    >
      {exam && (
        <div className="prep-contextbar">
          <CalendarDays size={15} />
          <span>{exam.exam_date}</span>
          <span>·</span>
          <span>
            {differenceInCalendarDays(parseISO(exam.exam_date), new Date()) >= 0
              ? `距考试 ${differenceInCalendarDays(parseISO(exam.exam_date), new Date())} 天`
              : "考试已结束"}
          </span>
        </div>
      )}
      {prep.isLoading && (
        <div
          className="prep-loading"
          role="status"
          aria-label="正在加载备考内容"
        />
      )}
      {prep.error && (
        <div className="prep-error" role="alert">
          备考内容暂时无法读取。
          <Button variant="ghost" onClick={() => prep.refetch()}>
            重新加载
          </Button>
        </div>
      )}
      {creating && (
        <form
          onSubmit={create}
          className="prep-form grid sm:grid-cols-[1fr_12rem_auto] gap-4"
        >
          <div>
            <Label htmlFor="exam-name">考试名称</Label>
            <Input
              id="exam-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：江苏省考"
            />
          </div>
          <div>
            <DateField id="exam-date" label="考试日期" required value={date} onChange={setDate} />
          </div>
          <Button disabled={prep.saving || !name.trim()} className="self-end">
            保存考试
          </Button>
          <label className="text-sm flex items-center gap-2 sm:col-span-3">
            <input
              type="checkbox"
              checked={civil}
              onChange={(e) => setCivil(e.target.checked)}
            />
            使用公务员套卷模板（题型可自行修改）
          </label>
        </form>
      )}

      {exam && (
        <nav className="prep-tabs" aria-label="考试内容">
          {[
            ["questions", "错题"],
            ["papers", "套卷"],
            ["notes", "学习资料"],
            ["settings", "设置"],
          ].map(([key, label]) => (
            <button
              key={key}
              className="prep-tab"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {data && (!examId || tab === "questions") && (
        <section className="prep-review-inbox" aria-label="今日待复习">
          <div className="prep-review-start">
            <h2>今日待复习</h2>
            <div className="prep-due-number">
              {due.length}
              <span>道题</span>
            </div>
            <Button className="prep-primary" asChild>
              <Link
                to={`/preparation/review${examId ? `?exam=${examId}` : ""}`}
              >
                {due.length ? "开始复习" : "进入复习"}
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="prep-inbox-list">
            {due.slice(0, 3).map((q, i) => (
              <Link
                className="prep-inbox-row"
                key={q.id}
                to={`/preparation/questions/${q.id}`}
              >
                <span className="prep-inbox-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="prep-inbox-title">
                    {questionExcerpt(q.stem_md)}
                  </p>
                  <p className="prep-inbox-meta">
                    {q.tags.join(" · ") || "待复盘"}
                  </p>
                </div>
                <ArrowRight size={15} />
              </Link>
            ))}
            {due.length === 0 && (
              <div className="py-8">
                <CheckCheck className="text-cat-green mb-3" size={24} />
                <p className="font-medium">今天的复习已清空</p>
                <p className="text-sm text-muted-foreground mt-2">
                  也可以选一组错题，自由练习。
                </p>
              </div>
            )}
            <div className="prep-inbox-more">
              <Link
                to={`/preparation/review${examId ? `?exam=${examId}` : ""}`}
              >
                {due.length > 3
                  ? `还有 ${due.length - 3} 题，进入复习查看`
                  : "按当前复习安排排序"}
              </Link>
              <Link
                className="inline-flex items-center gap-1"
                to={`/preparation/review?mode=practice${examId ? `&exam=${examId}` : ""}`}
              >
                自由练习
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>
      )}
      {data && !examId && (
        <section>
          <div className="prep-section-heading">
            <h2>
              我的考试
              <span className="prep-section-caption">
                {data.exams.filter((e) => !e.is_archived).length} 项
              </span>
            </h2>
            <Link
              className="prep-subtle-link"
              to={all ? "/preparation" : "/preparation?view=exams"}
            >
              {all ? "收起" : "查看全部"}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="prep-exam-grid">
            {selectExamPreview(
              data.exams,
              today,
              all ? Number.MAX_SAFE_INTEGER : 6,
            ).map((e) => {
              const days = differenceInCalendarDays(
                parseISO(e.exam_date),
                new Date(),
              );
              return (
                <Link
                  key={e.id}
                  to={`/preparation/exams/${e.id}`}
                  className={`prep-exam ${all ? "prep-exam--all" : ""}`}
                >
                  <div className="prep-exam-top">
                    <div>
                      <h3>{e.name}</h3>
                      <p className="prep-exam-date">
                        {examDateLabel(e.exam_date)}
                      </p>
                    </div>
                    {e.is_primary && <span className="prep-pin">已置顶</span>}
                  </div>
                  <div className="prep-exam-countdown">
                    {!Number.isFinite(days) ? <span>待设日期</span> : days >= 0 ? (
                      <>
                        <span className="prep-countdown-prefix">还有</span>
                        <strong>{days}</strong>
                        <span>天</span>
                      </>
                    ) : (
                      <strong className="text-base">已结束</strong>
                    )}
                    <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
          {data.exams.length === 0 && (
            <div className="prep-empty">
              <CalendarDays size={24} />
              <h2>下一场考试，从这里开始</h2>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                添加考试
              </Button>
            </div>
          )}
          {all && data.exams.some((e) => e.is_archived) && (
            <details className="mt-5">
              <summary className="prep-subtle-link cursor-pointer">
                已归档考试
              </summary>
              <div className="flex flex-wrap gap-4">
                {data.exams
                  .filter((e) => e.is_archived)
                  .map((e) => (
                    <Link
                      className="underline text-sm"
                      key={e.id}
                      to={`/preparation/exams/${e.id}`}
                    >
                      {e.name}
                    </Link>
                  ))}
              </div>
            </details>
          )}
        </section>
      )}
      {data && exam && tab === "settings" && (
        <section className="prep-form space-y-5">
          <h2 className="heading-font text-xl">考试信息</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget);
              prep
                .save({
                  collection: "exams",
                  id: exam.id,
                  record: {
                    name: fields.get("name"),
                    exam_date: examDateDraft?.id === exam.id ? examDateDraft.value : exam.exam_date,
                    template: fields.get("civil") ? "civil" : null,
                    is_primary: !!fields.get("primary"),
                  },
                })
                .then(() => toast({ title: "考试已更新" }))
                .catch(report);
            }}
          >
            <label className="block text-sm">
              名称
              <Input name="name" required defaultValue={exam.name} />
            </label>
            <DateField key={exam.id} label="考试日期" required
              value={examDateDraft?.id === exam.id ? examDateDraft.value : exam.exam_date}
              onChange={(value) => setExamDateDraft({ id: exam.id, value })} />
            <label className="flex gap-2 text-sm">
              <input
                name="civil"
                type="checkbox"
                defaultChecked={exam.template === "civil"}
              />
              使用公务员套卷模板
            </label>
            <label className="flex gap-2 text-sm">
              <input
                name="primary"
                type="checkbox"
                defaultChecked={exam.is_primary}
              />
              置顶考试
            </label>
            <Button disabled={prep.saving}>保存考试</Button>
          </form>
          <h2 className="heading-font text-xl">关联题库</h2>
          <p className="text-sm text-muted-foreground">
            题库新增的题目会自动出现在本考试，同一道题始终共用复习状态。
          </p>
          {data.banks.map((b) => {
            const membership = data.examBanks.find(
              (r) => r.exam_id === examId && r.bank_id === b.id,
            );
            const linked = !!membership;
            return (
              <div
                key={b.id}
                className="flex justify-between border-b border-border py-3"
              >
                <span>{b.name}</span>
                <Button
                  variant="outline"
                  disabled={prep.saving}
                  onClick={() =>
                    prep
                      .save(
                        linked
                          ? {
                              collection: "examBanks",
                              id: membership?.id,
                              remove: true,
                            }
                          : {
                              collection: "examBanks",
                              record: { exam_id: examId, bank_id: b.id },
                            },
                      )
                      .catch(report)
                  }
                >
                  {linked ? "取消关联" : "关联题库"}
                </Button>
              </div>
            );
          })}
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const bank = await prep.save({
                  collection: "banks",
                  record: { name: bankName.trim() },
                });
                await prep.save({
                  collection: "examBanks",
                  record: { exam_id: examId, bank_id: bank.id },
                });
                setBankName("");
              } catch (e) {
                report(e);
              }
            }}
          >
            <Input
              aria-label="新题库名称"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="例如：江苏省情"
            />
            <Button disabled={!bankName.trim() || prep.saving}>
              新建并关联
            </Button>
          </form>
          <Button
            variant="outline"
            onClick={() =>
              prep
                .save({
                  collection: "exams",
                  id: exam.id,
                  record: { is_archived: !exam.is_archived },
                })
                .catch(report)
            }
          >
            {exam.is_archived ? "恢复考试" : "归档考试"}
          </Button>
        </section>
      )}
      {data && exam && tab === "papers" && (
        <PaperSection
          prep={prep}
          examId={exam.id}
          civil={exam.template === "civil"}
        />
      )}
      {exam && tab === "notes" && (
        <section className="prep-form space-y-3">
          <h2 className="heading-font text-xl">从错题回到知识</h2>
          <p className="text-sm text-muted-foreground">
            在题目详情中关联学习笔记，沉淀解题方法与易错点。
          </p>
          <Button asChild variant="outline">
            <Link to="/learning-notes">打开学习笔记</Link>
          </Button>
        </section>
      )}

      {data && exam && tab === "questions" && (
        <div className="flex gap-5">
          <Link
            className="prep-subtle-link"
            to={`/preparation/questions?exam=${examId}`}
          >
            <BookOpen size={15} />
            全部错题
            <ArrowRight size={14} />
          </Link>
          <Link className="prep-subtle-link" to="/preparation/banks">
            管理关联题库
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </PrepShell>
  );
}
function PaperSection({
  prep,
  examId,
  civil,
}: {
  prep: ReturnType<typeof usePreparation>;
  examId: string;
  civil: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [editId, setEditId] = useState<string | undefined>();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [score, setScore] = useState("");
  const [minutes, setMinutes] = useState("");
  const [sections, setSections] = useState(
    (civil ? CIVIL_SECTIONS : []).map((name) => ({
      name,
      total: 0,
      correct: 0,
    })),
  );
  const { toast } = useToast();
  return (
    <section className="space-y-5">
      <div className="flex justify-between">
        <h2 className="heading-font text-xl">套卷记录</h2>
        <Button
          onClick={() => {
            setEditId(undefined);
            setSource("");
            setScore("");
            setMinutes("");
            setSections(
              (civil ? CIVIL_SECTIONS : []).map((name) => ({
                name,
                total: 0,
                correct: 0,
              })),
            );
            setOpen(!open);
          }}
        >
          录入套卷
        </Button>
      </div>
      {open && (
        <form
          className="prep-form space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await prep.save({
                collection: "papers",
                id: editId,
                record: {
                  exam_id: examId,
                  name: source,
                  source,
                  taken_date: date,
                  total_score: score ? Number(score) : null,
                  duration_minutes: minutes ? Number(minutes) : null,
                  sections,
                  is_mock: true,
                },
              });
              setOpen(false);
            } catch (e) {
              toast({ title: String(e), variant: "destructive" });
            }
          }}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ["套卷名称", source, setSource, "text"],
              ["作答日期", date, setDate, "date"],
              ["总分", score, setScore, "number"],
              ["用时（分钟）", minutes, setMinutes, "number"],
            ].map(([label, value, set, type]) => (
              type === "date" ? <DateField key={label as string} label={label as string} required value={value as string} onChange={set as (value: string) => void} /> : <label key={label as string} className="text-sm">
                {label as string}
                <Input
                  type={type as string}
                  value={value as string}
                  required={type === "text"}
                  min="0"
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            分项成绩来自整卷，不要求录入全部题目。
          </p>
          {sections.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_5rem_auto] gap-2"
            >
              <Input
                aria-label="分项名称"
                value={s.name}
                onChange={(e) =>
                  setSections((v) =>
                    v.map((x, n) =>
                      n === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                aria-label="题量"
                type="number"
                min="0"
                value={s.total}
                onChange={(e) =>
                  setSections((v) =>
                    v.map((x, n) =>
                      n === i ? { ...x, total: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <Input
                aria-label="正确数"
                type="number"
                min="0"
                max={s.total}
                value={s.correct}
                onChange={(e) =>
                  setSections((v) =>
                    v.map((x, n) =>
                      n === i ? { ...x, correct: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSections((v) => v.filter((_, n) => n !== i))}
              >
                删除
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSections((v) => [...v, { name: "", total: 0, correct: 0 }])
              }
            >
              添加分项
            </Button>
            <Button disabled={prep.saving}>保存套卷</Button>
          </div>
        </form>
      )}
      <PaperTrends
        papers={prep.data?.papers.filter((p) => p.exam_id === examId) || []}
      />
      <div className="divide-y divide-border">
        {prep.data?.papers
          .filter((p) => p.exam_id === examId || !p.exam_id)
          .sort((a, b) => b.taken_date.localeCompare(a.taken_date))
          .map((p) => (
            <article key={p.id} className="prep-material-item">
              <div className="flex justify-between">
                <h3 className="font-medium">{p.source}</h3>
                <span className="font-mono-data">
                  {p.total_score ?? "—"} 分
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {p.taken_date} · {p.duration_minutes ?? "—"} 分钟
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditId(p.id);
                    setSource(p.source);
                    setDate(p.taken_date);
                    setScore(p.total_score?.toString() || "");
                    setMinutes(p.duration_minutes?.toString() || "");
                    setSections(p.sections);
                    setOpen(true);
                  }}
                >
                  编辑套卷
                </Button>
                <Button asChild variant="outline">
                  <Link
                    to={`/preparation/questions?exam=${examId}&paper=${p.id}`}
                  >
                    录入本卷错题
                  </Link>
                </Button>
              </div>
              {!p.exam_id && (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() =>
                    prep
                      .save({
                        collection: "papers",
                        id: p.id,
                        record: { exam_id: examId },
                      })
                      .catch((e) =>
                        toast({ title: String(e), variant: "destructive" }),
                      )
                  }
                >
                  将历史套卷关联到此考试
                </Button>
              )}
              <div className="flex flex-wrap gap-4 mt-3">
                {p.sections.map((s, i) => (
                  <span key={i} className="text-xs">
                    {s.name} {s.correct}/{s.total}
                  </span>
                ))}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

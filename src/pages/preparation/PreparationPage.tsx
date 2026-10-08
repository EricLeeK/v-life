import { PaperTrends } from "@/components/preparation/PaperTrends";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { ArrowRight, Plus, BookOpen, Clock, Settings2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
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
    <AppLayout header={false} title="备考">
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 pb-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {exam && (
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                to="/preparation"
              >
                备考 /
              </Link>
            )}
            <h1 className="heading-font text-3xl sm:text-4xl font-semibold mt-2">
              {exam?.name || "备考"}
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              {exam
                ? `${exam.exam_date} · ${differenceInCalendarDays(parseISO(exam.exam_date), new Date()) >= 0 ? `还有 ${differenceInCalendarDays(parseISO(exam.exam_date), new Date())} 天` : "考试已结束"}`
                : "按考试整理目标，让共通的知识只复习一次。"}
            </p>
          </div>
          {!examId && (
            <Button onClick={() => setCreating(!creating)}>
              <Plus className="mr-2 h-4 w-4" />
              添加考试
            </Button>
          )}
        </header>
        {prep.isDemo && (
          <p className="text-xs text-muted-foreground">
            演示数据 · 此处操作不会写入你的账户
          </p>
        )}
        {prep.isLoading && <p role="status">正在加载备考内容…</p>}
        {prep.error && (
          <div role="alert" className="border border-border rounded-md p-5">
            <p>备考数据暂时无法读取。请确认备考数据库已更新，或稍后重试。</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => prep.refetch()}
            >
              重新加载
            </Button>
          </div>
        )}
        {creating && (
          <form
            onSubmit={create}
            className="border-y border-border py-5 grid sm:grid-cols-[1fr_12rem_auto] gap-4"
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
              <Label htmlFor="exam-date">考试日期</Label>
              <Input
                id="exam-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
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
        {data && !examId && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-font text-xl">我的考试</h2>
              <Link
                to={all ? "/preparation" : "/preparation?view=exams"}
                className="text-sm underline underline-offset-4"
              >
                {all ? "收起" : "查看全部"}
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectExamPreview(
                data.exams,
                today,
                all ? Number.MAX_SAFE_INTEGER : 6,
              ).map((e, i) => {
                const days = differenceInCalendarDays(
                  parseISO(e.exam_date),
                  new Date(),
                );
                return (
                  <Link
                    key={e.id}
                    to={`/preparation/exams/${e.id}`}
                    className={`group border border-border bg-card rounded-lg p-4 sm:p-5 min-h-28 sm:min-h-36 flex flex-col justify-between hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring ${!all && i >= 3 ? "hidden sm:flex" : ""}`}
                  >
                    <h3 className="font-medium text-lg break-words">
                      {e.name}
                    </h3>
                    <div className="mt-5 flex items-end justify-between">
                      <span className="text-xs text-muted-foreground">
                        {e.exam_date}
                      </span>
                      <span className="font-mono-data text-xl">
                        {days >= 0 ? (
                          <>
                            {days}
                            <span className="text-xs ml-1 font-sans">天</span>
                          </>
                        ) : (
                          "已结束"
                        )}
                        <ArrowRight className="inline ml-3 w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
            {all && data.exams.some(e=>e.is_archived) && <details className="mt-5"><summary className="min-h-11 cursor-pointer text-sm text-muted-foreground">已归档考试</summary><div className="flex flex-wrap gap-4">{data.exams.filter(e=>e.is_archived).map(e=><Link className="underline text-sm" key={e.id} to={`/preparation/exams/${e.id}`}>{e.name}</Link>)}</div></details>}
            {data.exams.length === 0 && (
              <p className="py-8 text-muted-foreground">
                先添加一个考试，再关联你要复习的题库。
              </p>
            )}
          </section>
        )}
        {examId && exam && (
          <nav
            aria-label="考试内容"
            className="flex gap-1 border-b border-border overflow-x-auto"
          >
            {[
              ["questions", "错题"],
              ["papers", "套卷"],
              ["notes", "学习资料"],
              ["settings", "设置"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`min-h-11 px-5 whitespace-nowrap border-b-2 ${tab === key ? "border-foreground font-medium" : "border-transparent text-muted-foreground"}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        {data && (!examId || tab === "questions") && (
          <section className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="p-5 flex flex-wrap gap-3 justify-between items-center">
              <div>
                <h2 className="heading-font text-xl">
                  今日待复习{" "}
                  <span className="text-sm font-mono-data text-muted-foreground ml-2">
                    {due.length}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  先独立作答，再核对解析与错因。
                </p>
              </div>
              <Button asChild>
                <Link
                  to={`/preparation/review${examId ? `?exam=${examId}` : ""}`}
                >
                  开始复习
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
            <div className="divide-y divide-border">
              {due.slice(0, 3).map((q) => (
                <Link
                  key={q.id}
                  to={`/preparation/questions/${q.id}`}
                  className="flex gap-4 items-center px-5 py-4 hover:bg-muted/50"
                >
                  <BookOpen className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">
                      {q.stem_md.replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/[#*![\]]/g, "")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.tags.join(" · ") || "待复盘"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ))}
            </div>
            {due.length === 0 && (
              <p className="p-5 pt-0 text-sm text-muted-foreground">
                当前没有到期题目，也可以进入题库自由练习。
              </p>
            )}
            {due.length > 3 && (
              <Link
                to={`/preparation/review${examId ? `?exam=${examId}` : ""}`}
                className="block border-t border-border px-5 py-4 text-sm"
              >
                另有 {due.length - 3} 题 · 查看全部 →
              </Link>
            )}
          </section>
        )}
        {data && exam && tab === "settings" && (
          <section className="space-y-5">
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
                      exam_date: fields.get("date"),
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
              <label className="block text-sm">
                日期
                <Input
                  name="date"
                  type="date"
                  required
                  defaultValue={exam.exam_date}
                />
              </label>
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
          <section className="space-y-3">
            <h2 className="heading-font text-xl">从错题回到知识</h2>
            <p className="text-sm text-muted-foreground">
              在题目详情中关联学习笔记，沉淀解题方法与易错点。
            </p>
            <Button asChild variant="outline">
              <Link to="/learning-notes">打开学习笔记</Link>
            </Button>
          </section>
        )}
        {data && (
          <footer className="flex flex-wrap gap-3 border-t border-border pt-5">
            <Button asChild variant="outline">
              <Link
                to={`/preparation/questions${examId ? `?exam=${examId}` : ""}`}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                全部错题
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                to={`/preparation/review?mode=practice${examId ? `&exam=${examId}` : ""}`}
              >
                <Clock className="w-4 h-4 mr-2" />
                自由练习
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/preparation/banks">题库与材料</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/preparation/integration">
                <Settings2 className="w-4 h-4 mr-2" />V 记连接
              </Link>
            </Button>
          </footer>
        )}
      </div>
    </AppLayout>
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
        <Button onClick={() => {setEditId(undefined);setSource("");setScore("");setMinutes("");setSections((civil ? CIVIL_SECTIONS : []).map(name=>({name,total:0,correct:0})));setOpen(!open);}}>录入套卷</Button>
      </div>
      {open && (
        <form
          className="space-y-4 border border-border p-5 rounded-lg"
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
              <label key={label as string} className="text-sm">
                {label as string}
                <Input
                  type={type as string}
                  value={value as string}
                  required={type === "text" || type === "date"}
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
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_5rem_auto] gap-2">
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
            <article key={p.id} className="py-4">
              <div className="flex justify-between">
                <h3 className="font-medium">{p.source}</h3>
                <span className="font-mono-data">
                  {p.total_score ?? "—"} 分
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {p.taken_date} · {p.duration_minutes ?? "—"} 分钟
              </p>
              <div className="flex flex-wrap gap-3 mt-3"><Button variant="ghost" onClick={()=>{setEditId(p.id);setSource(p.source);setDate(p.taken_date);setScore(p.total_score?.toString()||"");setMinutes(p.duration_minutes?.toString()||"");setSections(p.sections);setOpen(true);}}>编辑套卷</Button><Button asChild variant="outline"><Link to={`/preparation/questions?exam=${examId}&paper=${p.id}`}>录入本卷错题</Link></Button></div>
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

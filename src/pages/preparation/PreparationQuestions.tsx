import { QuestionLinks } from "@/components/preparation/QuestionLinks";
import { StudyImageUpload } from "@/components/preparation/StudyImageUpload";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StudyMarkdown } from "@/components/preparation/StudyMarkdown";
import { usePreparation, questionsForExam } from "@/hooks/usePreparation";
import {
  gradeAttempt,
  normalizeAnswer,
  REASON_TAGS,
  type PrepQuestion,
} from "@/lib/preparation/domain";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PreparationQuestions({
  review = false,
}: {
  review?: boolean;
}) {
  const prep = usePreparation();
  const { questionId } = useParams();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const examId = params.get("exam") || undefined;
  const paperId = params.get("paper") || undefined;
  const practice = params.get("mode") === "practice";
  const [flag, setFlag] = useState("");
  const [bankFilter, setBankFilter] = useState(params.get("bank") || "");
  const [typeFilter, setTypeFilter] = useState("");
  const all = prep.data ? questionsForExam(prep.data, examId) : [];
  const questions = all.filter(
    (q) =>
      q.status !== "archived" &&
      (!review || q.status === "active") &&
      (!review ||
        practice ||
        prep.data?.states.some(
          (s) =>
            s.question_id === q.id &&
            !s.paused &&
            (!s.due_at || new Date(s.due_at) <= new Date()),
        )) &&
      !done.includes(q.id) &&
      (!paperId || prep.data?.paperQuestions.some(r=>r.question_id===q.id&&r.paper_id===paperId)) &&
      (!params.get("pitfall") ||
        prep.data?.pitfallQuestions.some(
          (r) =>
            r.question_id === q.id && r.pitfall_id === params.get("pitfall"),
        )) &&
      (!bankFilter ||
        prep.data?.bankQuestions.some(
          (r) => r.question_id === q.id && r.bank_id === bankFilter,
        )) &&
      (!typeFilter || q.question_type === typeFilter) &&
      (!params.get("tag") || q.tags.includes(params.get("tag")!)) &&
      (!flag ||
        prep.data?.attempts.some(
          (a) =>
            a.question_id === q.id &&
            (flag === "yellow" ? a.yellow : a.correct === false),
        )),
  );
  const [current, setCurrent] = useState<PrepQuestion | null>(null);
  useEffect(() => {
    if (review && !current && questions.length) setCurrent(questions[0]);
  }, [review, current, questions]);
  const question = questionId
    ? all.find((q) => q.id === questionId)
    : review
      ? current
      : null;
  return (
    <AppLayout header={false} title={review ? "错题复习" : "错题库"}>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <Link
          to={examId ? `/preparation/exams/${examId}` : "/preparation"}
          className="text-sm text-muted-foreground"
        >
          ← 返回备考
        </Link>
        <header className="flex justify-between items-center gap-4">
          <h1 className="heading-font text-3xl">
            {review
              ? practice
                ? "自由练习"
                : "今日复习"
              : questionId
                ? "题目与复盘"
                : "我的错题"}
          </h1>
          {!review && (
            <Button onClick={() => setEditing(!editing)}>
              {question ? "编辑题目" : "添加题目"}
            </Button>
          )}
        </header>
        {prep.isLoading && <p role="status">正在读取题目…</p>}
        {prep.error && (
          <div role="alert">
            题目未能加载。<Button onClick={() => prep.refetch()}>重试</Button>
          </div>
        )}
        {editing && (
          <QuestionEditor
            question={question || undefined}
            prep={prep}
            examId={examId}
            paperId={paperId}
            onClose={() => setEditing(false)}
          />
        )}
        {question && !editing && (
          <QuestionReader
            key={question.id}
            question={question}
            prep={prep}
            review={review}
            practice={practice}
            onNext={() => {
              setDone((v) => [...v, question.id]);
              setCurrent(null);
            }}
          />
        )}
        {!questionId && !review && !editing && (
          <>
            <div className="flex flex-wrap gap-3">
              <select
                aria-label="按题库筛选"
                className="border border-input rounded-md bg-background p-2"
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
              >
                <option value="">所有题库</option>
                {prep.data?.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="按题型筛选"
                className="border border-input rounded-md bg-background p-2"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">所有题型</option>
                <option value="single">单选</option>
                <option value="multiple">多选</option>
                <option value="judgement">判断</option>
                <option value="text">主观题</option>
              </select>
              <select
                aria-label="按标记筛选"
                className="border border-input rounded-md bg-background p-2"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
              >
                <option value="">所有记录</option>
                <option value="wrong">有答错记录</option>
                <option value="yellow">有黄题记录</option>
              </select>
            </div>
            <Input
              aria-label="搜索题目与解析"
              placeholder="搜索题干、解析或知识点…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="divide-y divide-border">
              {questions
                .filter((q) =>
                  `${q.stem_md} ${q.explanation_md} ${q.tags.join(" ")}`.includes(
                    search,
                  ),
                )
                .map((q) => (
                  <Link
                    key={q.id}
                    to={`/preparation/questions/${q.id}`}
                    className="block py-5 hover:bg-muted/40"
                  >
                    <p className="line-clamp-2 font-medium">{q.stem_md.replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1")}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {q.tags.join(" · ")}
                      {q.status === "draft" ? " · 草稿" : ""} ·{" "}
                      {q.target_seconds
                        ? `${q.target_seconds} 秒目标`
                        : "未设速度目标"}
                    </p>
                  </Link>
                ))}
            </div>
          </>
        )}
        {review && prep.data && !question && questions.length === 0 && (
          <div className="py-12 text-center">
            <h2 className="heading-font text-2xl">本轮题目已完成</h2>
            <p className="text-muted-foreground mt-3">
              复习状态以已同步的结果为准。
            </p>
            <Button asChild className="mt-5">
              <Link to="/preparation">返回备考</Link>
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
function QuestionReader({
  question: q,
  prep,
  review,
  practice,
  onNext,
}: {
  question: PrepQuestion;
  prep: ReturnType<typeof usePreparation>;
  review: boolean;
  practice: boolean;
  onNext: () => void;
}) {
  const draftKey = `prep-draft:${prep.userId}:${q.id}:${practice ? "practice" : "review"}`;
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  });
  const [answer, setAnswer] = useState<string[]>(draft?.answer || []);
  const [text, setText] = useState(draft?.text || "");
  const [revealed, setRevealed] = useState(draft?.revealed || false);
  const [seconds, setSeconds] = useState(draft?.seconds || 0);
  const [paused, setPaused] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selfCorrect, setSelfCorrect] = useState(false);
  const eventId = useRef(draft?.pendingPayload?.idempotency_key || crypto.randomUUID());
  const presentedRevision = useRef(
    draft?.expectedRevision ??
      prep.data?.states.find((s) => s.question_id === q.id)?.revision ??
      0,
  );
  const contentRevision = useRef(draft?.contentRevision ?? q.revision);
  const [receipt, setReceipt] = useState<{attempt?:{mode:string};review_state?:{due_at:string}} | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string,unknown> | null>(
    draft?.pendingPayload || null,
  );
  const { toast } = useToast();
  const material = prep.data?.materials.find((m) => m.id === q.material_id);
  const state = prep.data?.states.find((s) => s.question_id === q.id);
  const result = gradeAttempt(
    answer,
    q.correct_answer,
    seconds,
    q.target_seconds,
  );
  useEffect(() => {
    if (review && !saved)
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          answer,
          text,
          revealed,
          seconds,
          eventId: eventId.current,
          expectedRevision: presentedRevision.current,
          contentRevision: contentRevision.current,
          pendingPayload,
        }),
      );
  }, [
    answer,
    text,
    revealed,
    seconds,
    review,
    saved,
    draftKey,
    pendingPayload,
  ]);
  useEffect(() => {
    if (!review || revealed || paused) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setSeconds((v) => v + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [review, revealed, paused]);
  const submit = async (rating: number) => {
    setSaving(true);
    try {
      const payload = pendingPayload || {
        question_id: q.id,
        idempotency_key: eventId.current,
        answer: q.question_type === "text" ? text : answer,
        duration_seconds: seconds,
        expected_revision: presentedRevision.current,
        content_revision: contentRevision.current,
        mode: practice ? "practice" : "review",
        rating,
        reason_tags: reasons,
        self_correct: selfCorrect,
      };
      setPendingPayload(payload);
      if (prep.isDemo) {
        await prep.save({
          collection: "attempts",
          record: {
            ...payload,
            correct: q.question_type === "text" ? selfCorrect : result.correct,
            yellow: result.yellow,
            created_at: new Date().toISOString(),
          },
        });
        if (!practice)
          await prep.save({
            collection: "states",
            id: q.id,
            record: {
              due_at: new Date(Date.now() + 86400000).toISOString(),
              revision: presentedRevision.current + 1,
            },
          });
      } else {
        const { data, error } = await supabase.functions.invoke("prep-api", {
          body: { action: "submit_attempt", input: payload },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setReceipt(data.data);
      }
      setSaved(true);
      setPendingPayload(null);
      localStorage.removeItem(draftKey);
      toast({ title: prep.isDemo ? "演示作答已记录" : "本次作答已同步" });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "同步失败，答案仍保留，请重试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      {review && (
        <div className="flex justify-between border-y border-border py-3 text-sm">
          <span className="font-mono-data">
            {seconds} 秒
            {q.target_seconds
              ? ` / 目标 ${q.target_seconds} 秒`
              : " · 未设速度目标"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? "继续计时" : "暂停"}
          </Button>
        </div>
      )}
      <div
        className={material ? "grid lg:grid-cols-2 gap-8" : "max-w-3xl mx-auto"}
      >
        {material && (
          <details
            open
            className="min-w-0 border-b lg:border-b-0 lg:border-r border-border pb-5 lg:pr-7"
          >
            <summary className="font-medium cursor-pointer mb-4">
              共用材料
            </summary>
            <StudyMarkdown>{material.content_md}</StudyMarkdown>
          </details>
        )}
        <section className="min-w-0">
          <StudyMarkdown>{q.stem_md}</StudyMarkdown>
          <div
            className={`mt-6 grid gap-3 ${q.options.some((o) => o.content_md.includes("![")) ? "grid-cols-2" : ""}`}
          >
            {q.options.map((o) => (
              <button
                key={o.key}
                type="button"
                disabled={revealed || !review}
                aria-pressed={answer.includes(o.key)}
                onClick={() =>
                  setAnswer((v) =>
                    q.question_type === "multiple"
                      ? v.includes(o.key)
                        ? v.filter((k) => k !== o.key)
                        : [...v, o.key]
                      : [o.key],
                  )
                }
                className={`text-left p-4 border rounded-md min-w-0 ${answer.includes(o.key) ? "border-foreground bg-muted" : "border-border bg-card"} ${revealed && normalizeAnswer(q.correct_answer).includes(o.key) ? "ring-1 ring-cat-green" : ""}`}
              >
                <span className="block text-xs font-semibold mb-2">
                  {o.key}
                </span>
                <StudyMarkdown>{o.content_md}</StudyMarkdown>
              </button>
            ))}
          </div>
          {q.question_type === "text" && review && (
            <Textarea
              className="mt-5 min-h-40"
              aria-label="我的作答"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={revealed}
              placeholder="先写下你的作答，再查看参考答案…"
            />
          )}
          {review && !revealed && (
            <Button
              className="mt-5"
              disabled={
                q.question_type === "text" ? !text.trim() : answer.length === 0
              }
              onClick={() => setRevealed(true)}
            >
              提交答案并查看解析
            </Button>
          )}
        </section>
      </div>
      {(!review || revealed) && (
        <section className="max-w-3xl mx-auto border-t border-border pt-6 space-y-6">
          <div>
            <h2 className="heading-font text-xl mb-3">答案与解析</h2>
            {q.question_type === "text" ? (
              <StudyMarkdown>
                {typeof q.correct_answer === "string" ? q.correct_answer : ""}
              </StudyMarkdown>
            ) : (
              <p className="font-medium mb-4">
                正确答案：
                {normalizeAnswer(q.correct_answer).join("、") || "待补充"}
                {review
                  ? ` · ${result.correct ? (result.yellow ? "答对，但用时未达标" : "答对了") : "这次答错了"}`
                  : ""}
              </p>
            )}
            <StudyMarkdown>{q.explanation_md || "解析待补充。"}</StudyMarkdown>
          </div>
          <div>
            <h2 className="heading-font text-xl mb-3">我的错因</h2>
            <StudyMarkdown>
              {q.analysis_md || "记录当时的错误思路，下次更容易识别。"}
            </StudyMarkdown>
          </div>
          {review && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {REASON_TAGS.map((r) => (
                  <button
                    key={r}
                    aria-pressed={reasons.includes(r)}
                    className={`border rounded-md min-h-11 px-3 text-sm ${reasons.includes(r) ? "bg-muted border-foreground" : "border-border"}`}
                    onClick={() =>
                      setReasons((v) =>
                        v.includes(r) ? v.filter((x) => x !== r) : [...v, r],
                      )
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
              {q.question_type === "text" && (
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selfCorrect}
                    onChange={(e) => setSelfCorrect(e.target.checked)}
                  />
                  对照评分要点，本次作答正确
                </label>
              )}
              {saved ? (
                <div className="space-y-3">
                  {receipt?.attempt?.mode === "practice" && !practice && (
                    <p className="text-sm text-cat-orange">
                      题目或复习状态已更新，本次保留为练习，没有重复推进排期。
                    </p>
                  )}
                  {receipt?.review_state?.due_at && (
                    <p className="text-sm text-muted-foreground">
                      下次复习：
                      {new Date(receipt.review_state.due_at).toLocaleString()}
                    </p>
                  )}
                  <Button
                    onClick={() => {
                      onNext();
                      void prep.refresh();
                    }}
                  >
                    下一题
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[
                    [1, "重学"],
                    [2, "困难"],
                    [3, "正常"],
                    [4, "轻松"],
                  ].map(([rating, label]) => (
                    <Button
                      key={rating}
                      variant={rating === 3 ? "default" : "outline"}
                      disabled={
                        saving ||
                        (Number(rating) > 1 &&
                          !(q.question_type === "text"
                            ? selfCorrect
                            : result.correct)) ||
                        (Number(rating) > 2 && result.yellow)
                      }
                      onClick={() => submit(Number(rating))}
                    >
                      {saving ? "同步中…" : label}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {practice
                  ? "自由练习只记录表现，不推进复习排期。"
                  : "确认结果后同步复习状态；答对但超时仍按黄题处理。"}
              </p>
            </div>
          )}
        </section>
      )}
      {!review && prep.data && <QuestionLinks question={q} prep={prep} />}
    </div>
  );
}
function QuestionEditor({
  question,
  prep,
  examId,
  paperId,
  onClose,
}: {
  question?: PrepQuestion;
  prep: ReturnType<typeof usePreparation>;
  examId?: string;
  paperId?: string;
  onClose: () => void;
}) {
  const draftKey = `prep-editor:${prep.userId}:${question?.id || paperId || examId || "new"}`;
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  });
  const [baseRevision, setBaseRevision] = useState(
    draft?.baseRevision ?? question?.revision ?? 1,
  );
  const [conflict, setConflict] = useState<PrepQuestion | null>(null);
  const [createdId, setCreatedId] = useState(
    draft?.createdId || question?.id || "",
  );
  const newId = useRef(draft?.newId || crypto.randomUUID());
  const [material, setMaterial] = useState(
    draft?.material ?? question?.material_id ?? "",
  );
  const [materialText, setMaterialText] = useState(draft?.materialText || "");
  const [newMaterial, setNewMaterial] = useState(draft?.newMaterial || false);
  const [uploadTarget, setUploadTarget] = useState("stem");
  const [stem, setStem] = useState(draft?.stem ?? (question?.stem_md || ""));
  const [type, setType] = useState<PrepQuestion["question_type"]>(
    draft?.type || question?.question_type || "single",
  );
  const [options, setOptions] = useState(
    draft?.options ||
      question?.options ||
      ["A", "B", "C", "D"].map((key) => ({ key, content_md: "" })),
  );
  const [answer, setAnswer] = useState(
    draft?.answer ?? normalizeAnswer(question?.correct_answer).join(","),
  );
  const [explanation, setExplanation] = useState(
    draft?.explanation ?? (question?.explanation_md || ""),
  );
  const [analysis, setAnalysis] = useState(
    draft?.analysis ?? (question?.analysis_md || ""),
  );
  const [target, setTarget] = useState(
    draft?.target ?? (question?.target_seconds?.toString() || ""),
  );
  const [tags, setTags] = useState(
    draft?.tags ?? (question?.tags.join("，") || ""),
  );
  const [bank, setBank] = useState(draft?.bank || "");
  const [status, setStatus] = useState(
    draft?.status || question?.status || "draft",
  );
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        baseRevision,
        createdId,
        newId: newId.current,
        material,
        materialText,
        newMaterial,
        bank,
        status,
        stem,
        explanation,
        analysis,
        answer,
        target,
        tags,
        type,
        options,
      }),
    );
  }, [
    draftKey,
    baseRevision,
    createdId,
    material,
    materialText,
    newMaterial,
    bank,
    status,
    stem,
    explanation,
    analysis,
    answer,
    target,
    tags,
    type,
    options,
  ]);
  const field = (
    label: string,
    value: string,
    set: (s: string) => void,
    large = false,
  ) => (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      {large ? (
        <Textarea
          className="min-h-32"
          value={value}
          onChange={(e) => set(e.target.value)}
        />
      ) : (
        <Input value={value} onChange={(e) => set(e.target.value)} />
      )}
    </label>
  );
  return (
    <form
      className="space-y-5 border-y border-border py-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting || conflict) return;
        setSubmitting(true);
        try {
          let materialId = material;
          if (newMaterial && materialText.trim()) {
            const m = await prep.save({
              collection: "materials",
              record: { content_md: materialText, title: "共享材料" },
            });
            materialId = m.id;
            setMaterial(m.id);
            setNewMaterial(false);
          }
          const patch = {
            material_id: materialId || null,
            stem_md: stem,
            question_type: type,
            options: type === "text" ? [] : options,
            correct_answer:
              type === "text"
                ? answer
                : answer
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            explanation_md: explanation,
            analysis_md: analysis,
            target_seconds: target ? Number(target) : null,
            tags: tags
              .split(/[,，]/)
              .map((t) => t.trim())
              .filter(Boolean),
            status,
          };
          if (
            status === "active" &&
            (!answer.trim() ||
              (type !== "text" && options.some((o) => !o.content_md.trim())))
          )
            throw new Error("请补齐答案与选项后再启用复习");
          const row = createdId
            ? await prep.editQuestion(
                {
                  ...patch,
                  id: createdId,
                  revision: baseRevision,
                } as PrepQuestion,
                patch,
              )
            : await prep.save({
                collection: "questions",
                record: { ...patch, id: newId.current, revision: 1 },
              });
          setCreatedId(row.id);
          setBaseRevision(row.revision);
          if (!question) {
            if (bank)
              await prep.save({
                collection: "bankQuestions",
                record: { bank_id: bank, question_id: row.id },
              });
            if (examId)
              await prep.save({
                collection: "exceptions",
                record: {
                  exam_id: examId,
                  question_id: row.id,
                  mode: "include",
                },
              });
          }
          if(paperId)await prep.save({collection:"paperQuestions",record:{paper_id:paperId,question_id:row.id}});
          localStorage.removeItem(draftKey);
          onClose();
        } catch (e) {
          if (
            (e as { code?: string })?.code === "40001" ||
            String((e as { message?: string })?.message || e).includes(
              "revision conflict",
            )
          ) {
            const fresh = await prep.refetch();
            const latest = fresh.data?.questions.find(
              (q) => q.id === (createdId || question?.id),
            );
            if (latest) setConflict(latest);
          }
          toast({
            title:
              (e as { message?: string })?.message || "保存失败，草稿已保留",
            variant: "destructive",
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {conflict && (
        <div
          role="alert"
          className="border border-border rounded-md p-4 space-y-3"
        >
          <p className="font-medium">另一端已修改此题，你的草稿仍保留。</p>
          <details open>
            <summary>最新版本 v{conflict.revision}</summary>
            <StudyMarkdown>
              {[conflict.stem_md,...conflict.options.map(o=>`${o.key}. ${o.content_md}`),`答案：${normalizeAnswer(conflict.correct_answer).join("、")}`,conflict.explanation_md,conflict.analysis_md].join("\n\n")}
            </StudyMarkdown>
          </details>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setBaseRevision(conflict.revision);
              setConflict(null);
            }}
          >
            我已对照合并，允许用当前草稿保存
          </Button>
        </div>
      )}
      <div className="space-y-3 border-b border-border pb-4">
        <label className="text-sm block">
          共用材料
          <select
            className="block w-full p-2 border border-input rounded-md bg-background mt-1"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          >
            <option value="">无材料</option>
            {prep.data?.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.content_md.slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => setNewMaterial((v) => !v)}
        >
          新建共享材料
        </Button>
        {newMaterial &&
          field(
            "材料正文 · 后续子题可复用",
            materialText,
            setMaterialText,
            true,
          )}
      </div>
      {field("题干 · 支持 Markdown", stem, setStem, true)}
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="图片插入位置"
          className="p-2 bg-background border border-input rounded-md"
          value={uploadTarget}
          onChange={(e) => setUploadTarget(e.target.value)}
        >
          <option value="stem">题干</option>
          <option value="explanation">解析</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              选项 {o.key}
            </option>
          ))}
        </select>
        {createdId ? (
          <StudyImageUpload
            questionId={createdId}
            disabled={prep.isDemo}
            onInsert={(md) => {
              if (uploadTarget === "stem") setStem((v) => v + "\n\n" + md);
              else if (uploadTarget === "explanation")
                setExplanation((v) => v + "\n\n" + md);
              else
                setOptions((v) =>
                  v.map((o) =>
                    o.key === uploadTarget
                      ? { ...o, content_md: o.content_md + "\n" + md }
                      : o,
                  ),
                );
            }}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!stem.trim() || prep.saving}
            onClick={async () => {
              try {
                const row = await prep.save({
                  collection: "questions",
                  record: {
                    id: newId.current,
                    stem_md: stem,
                    status: "draft",
                    question_type: type,
                    options: type === "text" ? [] : options,
                    correct_answer:
                      type === "text"
                        ? answer
                        : answer
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                    explanation_md: explanation,
                    analysis_md: analysis,
                    material_id: material || null,
                    target_seconds: target ? Number(target) : null,
                    tags: tags
                      .split(/[,，]/)
                      .map((t) => t.trim())
                      .filter(Boolean),
                  },
                });
                setCreatedId(row.id);
                setBaseRevision(row.revision);
              } catch (e) {
                toast({ title: String(e), variant: "destructive" });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            保存草稿以插入图片
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          选项图建议统一画布，保留完整图形。
        </span>
      </div>
      <label className="block text-sm">
        题型
        <select
          className="block w-full mt-2 bg-background border border-input rounded-md p-2"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="single">单选</option>
          <option value="multiple">多选</option>
          <option value="judgement">判断</option>
          <option value="text">主观题</option>
        </select>
      </label>
      {type !== "text" &&
        options.map((o, i) => (
          <div key={o.key}>
            {field(
              `选项 ${o.key} · 支持 Markdown 图片`,
              o.content_md,
              (value) =>
                setOptions((v) =>
                  v.map((x, n) => (n === i ? { ...x, content_md: value } : x)),
                ),
              true,
            )}
          </div>
        ))}
      {type !== "text" && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={options.length >= 10}
            onClick={() =>
              setOptions((v) => [
                ...v,
                { key: String.fromCharCode(65 + v.length), content_md: "" },
              ])
            }
          >
            添加选项
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={options.length <= 2}
            onClick={() => setOptions((v) => v.slice(0, -1))}
          >
            移除最后一项
          </Button>
        </div>
      )}
      {field(
        type === "text" ? "参考答案" : "正确答案（多选用英文逗号分隔）",
        answer,
        setAnswer,
        type === "text",
      )}
      {field("解析 · Markdown", explanation, setExplanation, true)}
      {field("错因与下次提醒 · Markdown", analysis, setAnalysis, true)}
      <div className="grid sm:grid-cols-2 gap-4">
        {field("目标用时（秒，可留空）", target, setTarget)}
        {field("知识点（逗号分隔）", tags, setTags)}
      </div>
      {!question && (
        <label className="block text-sm">
          加入题库
          <select
            className="block w-full mt-2 bg-background border border-input rounded-md p-2"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          >
            <option value="">暂不归类</option>
            {prep.data?.banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={status === "active"}
          onChange={(e) => setStatus(e.target.checked ? "active" : "draft")}
        />
        内容已核对，启用复习
      </label>
      <div className="flex gap-3">
        <Button
          disabled={submitting || prep.saving || !!conflict || !stem.trim()}
        >
          保存题目
        </Button>
        <Button variant="outline" type="button" onClick={onClose}>
          取消
        </Button>
      </div>
    </form>
  );
}

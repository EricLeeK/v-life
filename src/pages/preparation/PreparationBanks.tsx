import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StudyMarkdown } from "@/components/preparation/StudyMarkdown";
import { StudyImageUpload } from "@/components/preparation/StudyImageUpload";
import { usePreparation } from "@/hooks/usePreparation";
import { prepDb } from "@/hooks/usePreparation";
import { useToast } from "@/hooks/use-toast";
export default function PreparationBanks() {
  const prep = usePreparation();
  const [name, setName] = useState("");
  const [material, setMaterial] = useState("");
  const [edit, setEdit] = useState<{
    id: string;
    revision: number;
    content_md: string;
    title?: string;
  } | null>(null);
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
  return (
    <AppLayout header={false} title="题库与材料">
      <div className="mx-auto max-w-4xl space-y-7">
        <Link to="/preparation" className="text-sm text-muted-foreground">
          ← 返回备考
        </Link>
        <h1 className="heading-font text-3xl">题库与共用材料</h1>
        <p className="text-sm text-muted-foreground">
          按知识的适用范围组织题库，再将题库关联到考试。资料中的子题引用同一份材料。
        </p>
        {prep.error && (
          <p role="alert">
            数据读取失败。<Button onClick={() => prep.refetch()}>重试</Button>
          </p>
        )}
        <section>
          <h2 className="heading-font text-xl mb-4">共享题库</h2>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await prep.save({
                  collection: "banks",
                  record: { name: name.trim() },
                });
                setName("");
              });
            }}
          >
            <Input
              aria-label="题库名称"
              placeholder="例如：行测通用、浙江省情"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button disabled={!name.trim() || prep.saving}>创建题库</Button>
          </form>
          <div className="divide-y divide-border mt-4">
            {prep.data?.banks.map((b) => (
              <div
                key={b.id}
                className="py-4 flex flex-wrap gap-3 items-center"
              >
                <Input
                  aria-label={`题库名称 ${b.name}`}
                  className="max-w-xs"
                  defaultValue={b.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== b.name)
                      run(() =>
                        prep.save({
                          collection: "banks",
                          id: b.id,
                          record: { name: e.target.value.trim() },
                        }),
                      );
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {
                    prep.data!.bankQuestions.filter((r) => r.bank_id === b.id)
                      .length
                  }{" "}
                  题
                </span>
                <Link
                  to={`/preparation/questions?bank=${b.id}`}
                  className="text-sm underline"
                >
                  管理题目
                </Link>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-4 border-t border-border pt-6">
          <h2 className="heading-font text-xl">共用材料</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const row = await prep.save({
                  collection: "materials",
                  record: {
                    content_md: material,
                    title: material.slice(0, 30),
                  },
                });
                setMaterial("");
                setEdit(row);
              });
            }}
          >
            <Textarea
              aria-label="新增材料"
              placeholder="粘贴材料正文，保存后可插入图片…"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
            />
            <Button disabled={!material.trim() || prep.saving}>
              保存新材料
            </Button>
          </form>
          {prep.data?.materials.map((m) => (
            <article key={m.id} className="border-b border-border py-4">
              <div className="flex justify-between gap-3">
                <p className="line-clamp-2 text-sm">{m.content_md}</p>
                <Button variant="outline" onClick={() => setEdit({ ...m })}>
                  编辑
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                被{" "}
                {
                  prep.data!.questions.filter((q) => q.material_id === m.id)
                    .length
                }{" "}
                道子题引用 · v{m.revision}
              </p>
            </article>
          ))}
        </section>
        {edit && (
          <section className="space-y-4 border border-border rounded-lg p-5">
            <h2 className="font-medium">编辑共享材料</h2>
            <p className="text-sm text-cat-orange">
              保存将更新所有引用此材料的子题；历史作答仍保留原版本。
            </p>
            <Textarea
              className="min-h-60"
              aria-label="材料内容"
              value={edit.content_md}
              onChange={(e) => setEdit({ ...edit, content_md: e.target.value })}
            />
            <StudyImageUpload
              materialId={edit.id}
              disabled={prep.isDemo}
              onInsert={(md) =>
                setEdit((current) =>
                  current && current.id === edit.id
                    ? {
                        ...current,
                        content_md: current.content_md + "\n\n" + md,
                      }
                    : current,
                )
              }
            />
            <details>
              <summary className="min-h-11 cursor-pointer">预览</summary>
              <StudyMarkdown>{edit.content_md}</StudyMarkdown>
            </details>
            <div className="flex gap-3">
              <Button
                onClick={() =>
                  run(async () => {
                    if (prep.isDemo)
                      await prep.save({
                        collection: "materials",
                        id: edit.id,
                        record: {
                          content_md: edit.content_md,
                          revision: edit.revision + 1,
                        },
                      });
                    else {
                      const { error } = await prepDb.rpc(
                        "prep_edit_material",
                        {
                          p_material_id: edit.id,
                          p_expected_revision: edit.revision,
                          p_content_md: edit.content_md,
                          p_title: edit.title || "",
                        },
                      );
                      if (error) throw error;
                    }
                    await prep.refresh();
                    setEdit(null);
                  })
                }
              >
                保存修改
              </Button>
              <Button variant="outline" onClick={() => setEdit(null)}>
                取消
              </Button>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

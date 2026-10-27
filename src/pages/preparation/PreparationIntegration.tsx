import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PrepShell } from "@/components/preparation/PrepShell";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepDb } from "@/hooks/usePreparation";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useToast } from "@/hooks/use-toast";
export default function PreparationIntegration() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const { isDemo } = useDemoMode();
  const { toast } = useToast();
  const connections = useQuery({
    queryKey: ["prep-connections"],
    enabled: !isDemo,
    queryFn: async () => {
      const { data, error } = await prepDb.rpc("prep_connection_list");
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        revoked_at: string | null;
        last_used_at: string | null;
      }[];
    },
  });
  return (
    <PrepShell title="V 记连接" active="integration">
      <div className="prep-connection prep-form">
        <div className="prep-connection-heading">
          <div className="prep-connection-symbol">
            <span>V-Life</span>
            <ArrowRightLeft size={20} />
            <span>V 记</span>
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          在 V 记的连接设置中绑定备考后，你的错题将出现在「V-Life ·
          备考错题」卡片盒。两端共用答案、解析、错因和复习状态。
        </p>
        <ol className="prep-steps">
          <li>在这里生成专用连接码。</li>
          <li>前往 V 记设置中的「V-Life 备考」，粘贴连接码并连接。</li>
          <li>打开关联卡片盒，开始复习。修改解析也会同步回来。</li>
        </ol>
        <Button
          disabled={busy || isDemo}
          onClick={async () => {
            setBusy(true);
            try {
              const { data, error } = await prepDb.functions.invoke(
                "prep-api",
                { body: { action: "connection_create" } },
              );
              if (error || data?.error) throw error || new Error(data.error);
              setToken(data.data.token);
              await connections.refetch();
            } catch (e) {
              toast({
                title: e instanceof Error ? e.message : "生成失败",
                variant: "destructive",
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          生成新的连接码
        </Button>
        <p className="text-xs text-muted-foreground">
          生成新码会撤销旧连接码。连接码只授予备考内容和复习权限，请只填入你自己的
          V 记。
        </p>
        {isDemo && <p className="text-sm">演示模式不创建真实连接。</p>}
        {token && (
          <div className="border border-border rounded-md p-4 space-y-3">
            <p className="text-sm">连接码仅在本次显示</p>
            <code className="block break-all text-sm">{token}</code>
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard
                  .writeText(token)
                  .then(() => toast({ title: "已复制" }))
                  .catch(() => toast({ title: "复制失败，请手动选择复制" }))
              }
            >
              复制连接码
            </Button>
          </div>
        )}
        {connections.error && (
          <p role="alert">连接状态读取失败，请稍后重试。</p>
        )}
        {connections.data?.map((c) => (
          <div
            key={c.id}
            className="border-t border-border py-4 flex justify-between gap-4"
          >
            <div>
              <p>
                {c.name} · {c.revoked_at ? "已撤销" : "已启用"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                最近同步：
                {c.last_used_at
                  ? new Date(c.last_used_at).toLocaleString()
                  : "尚未连接"}
              </p>
            </div>
            {!c.revoked_at && (
              <Button
                variant="outline"
                onClick={async () => {
                  const { error } = await prepDb.rpc("prep_connection_revoke", {
                    p_id: c.id,
                  });
                  if (error)
                    toast({ title: error.message, variant: "destructive" });
                  else {
                    setToken("");
                    connections.refetch();
                  }
                }}
              >
                撤销
              </Button>
            )}
          </div>
        ))}
      </div>
    </PrepShell>
  );
}

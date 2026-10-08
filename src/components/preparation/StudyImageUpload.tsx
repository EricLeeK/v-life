import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
export function StudyImageUpload({
  questionId,
  materialId,
  onInsert,
  disabled = false,
}: {
  questionId?: string;
  materialId?: string;
  onInsert: (md: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <label
      className={`inline-flex items-center min-h-11 border border-border rounded-md px-3 text-sm ${busy || disabled ? "opacity-50" : "cursor-pointer hover:bg-muted"}`}
    >
      {busy ? "正在上传…" : "插入图片"}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={busy || disabled}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            if (file.size > 10 * 1024 * 1024)
              throw new Error("请使用 10 MB 以内的清晰图片");
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result));
              r.onerror = reject;
              r.readAsDataURL(file);
            });
            const bitmap = await createImageBitmap(file);
            const { data, error } = await supabase.functions.invoke(
              "prep-api",
              {
                body: {
                  action: "asset_upload",
                  input: {
                    base64: dataUrl.split(",")[1],
                    mime_type: file.type,
                    question_id: questionId,
                    material_id: materialId,
                    alt: file.name,
                    width: bitmap.width,
                    height: bitmap.height,
                  },
                },
              },
            );
            bitmap.close();
            if (error || data?.error) throw error || new Error(data.error);
            onInsert(data.data.markdown);
          } catch (err) {
            toast({
              title: err instanceof Error ? err.message : "图片上传失败",
              variant: "destructive",
            });
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}

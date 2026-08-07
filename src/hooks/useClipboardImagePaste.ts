import { useCallback } from "react";

export function useClipboardImagePaste(onFiles: (files: File[]) => void) {
  return useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((it) => it.type.startsWith("image/"));
      if (!imageItems.length) return;
      e.preventDefault();
      const files = imageItems.map((it) => it.getAsFile()).filter(Boolean) as File[];
      if (files.length) onFiles(files);
    },
    [onFiles],
  );
}

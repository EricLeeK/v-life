import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Reserve only each article's natural height, so the next block fills the column. */
export function PaperFlow({ children, edition }: { children: ReactNode; edition: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const flow = ref.current;
    if (!flow) return;
    let frame = 0;
    let disposed = false;
    let previousColumns = "";
    let previousBlocks: Element[] = [];

    function pack() {
      frame = 0;
      if (disposed || !flow!.getBoundingClientRect().width) return;
      const blocks = Array.from(flow!.children) as HTMLElement[];
      const heights = blocks.map((block) => Math.ceil(block.getBoundingClientRect().height));
      const columns = getComputedStyle(flow!).getPropertyValue("--np-columns").trim();
      // Balance once per edition/column count, never shuffle articles while typing
      // or expanding their text. Keep the front page first and mobile in source order.
      if (columns !== previousColumns || blocks.some((block, i) => block !== previousBlocks[i]) || blocks.length !== previousBlocks.length) {
        const ordered = blocks.map((block, index) => ({ block, index, height: heights[index] }));
        if (Number(columns) > 1) {
          ordered.sort((a, b) => a.index < 2 || b.index < 2 ? a.index - b.index : b.height - a.height || a.index - b.index);
        }
        ordered.forEach(({ block }, index) => { block.style.order = String(index); });
        previousColumns = columns;
        previousBlocks = blocks;
      }
      blocks.forEach((block, index) => {
        const span = `span ${Math.max(1, heights[index])}`;
        if (block.style.gridRowEnd !== span) block.style.gridRowEnd = span;
      });
      flow!.dataset.packed = "true";
    }

    function queuePack() {
      if (!disposed && !frame) frame = requestAnimationFrame(pack);
    }

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(queuePack);
    function observeBlocks() {
      observer?.disconnect();
      observer?.observe(flow!);
      Array.from(flow!.children).forEach((block) => observer?.observe(block));
      pack();
    }
    // Sections can appear or disappear after a report refresh or visibility change.
    const mutations = new MutationObserver(observeBlocks);
    mutations.observe(flow, { childList: true });
    observeBlocks();
    window.addEventListener("resize", queuePack);
    flow.addEventListener("load", queuePack, true);
    void document.fonts?.ready.then(queuePack);
    document.fonts?.addEventListener("loadingdone", queuePack);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", queuePack);
      flow.removeEventListener("load", queuePack, true);
      document.fonts?.removeEventListener("loadingdone", queuePack);
    };
  }, [edition]);

  return <div ref={ref} className="np-flow" aria-label="日报内容">{children}</div>;
}

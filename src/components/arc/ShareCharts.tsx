import type { ComponentProps } from "react";
import { ArcScope } from "@/components/arc/ArcScope";
import DonutChart from "@/vendor/uiarc/registry/components/donut-chart/donut-chart";
import LineChart from "@/vendor/uiarc/registry/components/line-chart/line-chart";

/** The same morphing ring used by finance and calories. Selection is pinned so a page can filter with it. */
export function ShareDonut(props: ComponentProps<typeof DonutChart>) {
  return (
    <ArcScope className="share-donut">
      <DonutChart legendAction="select" groupBelow={0} maxSegments={8} {...props} />
    </ArcScope>
  );
}

/** The same scrubbable trend used by finance, calories, and weight. */
export function TrendLine(props: ComponentProps<typeof LineChart>) {
  return (
    <ArcScope>
      <LineChart curve="smooth" {...props} />
    </ArcScope>
  );
}

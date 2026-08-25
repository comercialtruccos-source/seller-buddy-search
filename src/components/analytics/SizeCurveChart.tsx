import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { SizeCurveEntry } from "@/lib/inventoryAnalytics";

interface SizeCurveChartProps {
  data: SizeCurveEntry[];
}

const CORE_SIZES = new Set([
  "S", "M", "L", "30", "32", "34", "36", "8", "10", "12",
]);

export default function SizeCurveChart({ data }: SizeCurveChartProps) {
  const chartData = data.map((d) => ({
    size: d.size,
    units: d.units,
    isCore: CORE_SIZES.has(d.size.toUpperCase()),
  }));

  const chartConfig: ChartConfig = {
    units: { label: "Unidades", color: "hsl(262 83% 58%)" },
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Curva de Tallas
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            data={chartData}
            margin={{ left: -10, right: 8, top: 4, bottom: 4 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="size"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, props) => {
                    const entry = props.payload;
                    const coreLabel = entry.isCore ? " (Core)" : " (Fringe)";
                    return `Talla ${entry.size}${coreLabel}: ${Number(value).toLocaleString("es-CO")} uds`;
                  }}
                />
              }
            />
            <Bar
              dataKey="units"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              fill="var(--color-units)"
            />
          </BarChart>
        </ChartContainer>

        {/* Core vs fringe summary */}
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            Core (S/M/L):{" "}
            <span className="font-medium text-foreground">
              {chartData
                .filter((d) => d.isCore)
                .reduce((a, d) => a + d.units, 0)
                .toLocaleString("es-CO")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-violet-300" />
            Fringe:{" "}
            <span className="font-medium text-foreground">
              {chartData
                .filter((d) => !d.isCore)
                .reduce((a, d) => a + d.units, 0)
                .toLocaleString("es-CO")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

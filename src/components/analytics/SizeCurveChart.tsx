import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import type { SizeCurveEntry } from "@/lib/inventoryAnalytics";

interface SizeCurveChartProps {
  data: SizeCurveEntry[];
  selectedTallas?: string[];
  onSelectTalla?: (size: string) => void;
  onSelectGroup?: (sizes: string[]) => void;
}

const CORE_SIZES = new Set([
  "S", "M", "L", "30", "32", "34", "36", "08", "10", "12", "8",
]);

export default function SizeCurveChart({
  data,
  selectedTallas = [],
  onSelectTalla,
  onSelectGroup,
}: SizeCurveChartProps) {
  const chartData = data.map((d) => ({
    size: d.size,
    units: d.units,
    isCore: CORE_SIZES.has(d.size.toUpperCase()),
  }));

  const coreSizesList = chartData.filter((d) => d.isCore).map((d) => d.size);
  const fringeSizesList = chartData.filter((d) => !d.isCore).map((d) => d.size);

  const isCoreActive =
    coreSizesList.length > 0 &&
    coreSizesList.every((s) => selectedTallas.includes(s));
  const isFringeActive =
    fringeSizesList.length > 0 &&
    fringeSizesList.every((s) => selectedTallas.includes(s));

  const chartConfig: ChartConfig = {
    units: { label: "Unidades", color: "hsl(262 83% 58%)" },
  };

  const handleBarClick = (entry: any) => {
    if (entry && entry.size && onSelectTalla) {
      onSelectTalla(entry.size);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">Curva de Tallas</CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Haz clic en una barra para filtrar las métricas por esa talla
          </p>
        </div>
        {selectedTallas.length > 0 && (
          <Badge
            variant="secondary"
            className="text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-900/40"
          >
            {selectedTallas.length} {selectedTallas.length === 1 ? "talla" : "tallas"}
          </Badge>
        )}
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
                    return `Talla ${entry.size}${coreLabel}: ${Number(value).toLocaleString("es-CO")} uds (Clic para filtrar)`;
                  }}
                />
              }
            />
            <Bar
              dataKey="units"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              className="cursor-pointer"
              onClick={handleBarClick}
            >
              {chartData.map((entry) => {
                const isSelected = selectedTallas.includes(entry.size);
                return (
                  <Cell
                    key={entry.size}
                    fill={
                      isSelected
                        ? "#6d28d9"
                        : entry.isCore
                        ? "hsl(262 83% 58%)"
                        : "hsl(262 60% 75%)"
                    }
                    stroke={isSelected ? "#4c1d95" : undefined}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Core vs fringe summary with interactive click filters */}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
          <button
            onClick={() => onSelectGroup && onSelectGroup(coreSizesList)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all ${
              isCoreActive
                ? "bg-violet-100 text-violet-800 font-semibold dark:bg-violet-900/60 dark:text-violet-200"
                : "hover:bg-muted"
            }`}
            title="Clic para filtrar métricas por tallas Core (S/M/L/30-36)"
          >
            <div className="w-2 h-2 rounded-full bg-violet-600" />
            Core (S/M/L):{" "}
            <span className="font-semibold text-foreground">
              {chartData
                .filter((d) => d.isCore)
                .reduce((a, d) => a + d.units, 0)
                .toLocaleString("es-CO")}
            </span>
          </button>

          <button
            onClick={() => onSelectGroup && onSelectGroup(fringeSizesList)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all ${
              isFringeActive
                ? "bg-violet-100 text-violet-800 font-semibold dark:bg-violet-900/60 dark:text-violet-200"
                : "hover:bg-muted"
            }`}
            title="Clic para filtrar métricas por tallas Fringe (XS/XL/3XL/06/U/etc.)"
          >
            <div className="w-2 h-2 rounded-full bg-violet-300" />
            Fringe:{" "}
            <span className="font-semibold text-foreground">
              {chartData
                .filter((d) => !d.isCore)
                .reduce((a, d) => a + d.units, 0)
                .toLocaleString("es-CO")}
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}


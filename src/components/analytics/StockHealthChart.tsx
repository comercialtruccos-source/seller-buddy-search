import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { HealthBreakdown } from "@/lib/inventoryAnalytics";

interface StockHealthChartProps {
  health: HealthBreakdown;
}

const HEALTH_COLORS = {
  oos: "#ef4444",
  low: "#f59e0b",
  healthy: "#10b981",
  overstock: "#6366f1",
};

const HEALTH_LABELS: Record<string, string> = {
  oos: "Sin Stock",
  low: "Stock Bajo",
  healthy: "Saludable",
  overstock: "Sobrestock",
};

const chartConfig: ChartConfig = {
  oos: { label: "Sin Stock (0)", color: HEALTH_COLORS.oos },
  low: { label: "Stock Bajo (1-3)", color: HEALTH_COLORS.low },
  healthy: { label: "Saludable (4-30)", color: HEALTH_COLORS.healthy },
  overstock: { label: "Sobrestock (30+)", color: HEALTH_COLORS.overstock },
};

export default function StockHealthChart({ health }: StockHealthChartProps) {
  const total = health.oos + health.low + health.healthy + health.overstock;

  const data = [
    { name: "oos", value: health.oos, fill: HEALTH_COLORS.oos },
    { name: "low", value: health.low, fill: HEALTH_COLORS.low },
    { name: "healthy", value: health.healthy, fill: HEALTH_COLORS.healthy },
    { name: "overstock", value: health.overstock, fill: HEALTH_COLORS.overstock },
  ].filter((d) => d.value > 0);

  const healthyPct =
    total > 0
      ? (((health.healthy + health.overstock) / total) * 100).toFixed(0)
      : "0";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Salud del Stock</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="mx-auto h-[200px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const label = HEALTH_LABELS[name as string] || name;
                    const pct =
                      total > 0
                        ? ((Number(value) / total) * 100).toFixed(1)
                        : "0";
                    return `${label}: ${value} SKUs (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              strokeWidth={2}
              stroke="var(--background)"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Center label */}
        <div className="text-center -mt-28 mb-14 pointer-events-none">
          <p className="text-2xl font-bold">{healthyPct}%</p>
          <p className="text-[10px] text-muted-foreground">Óptimo</p>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
          {Object.entries(HEALTH_COLORS).map(([key, color]) => {
            const val = health[key as keyof HealthBreakdown];
            if (key === "orphan") return null;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
            return (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground truncate">
                  {HEALTH_LABELS[key]}
                </span>
                <span className="ml-auto font-medium tabular-nums">
                  {val} <span className="text-muted-foreground/60">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { BodegaEntry } from "@/lib/inventoryAnalytics";

interface WarehouseChartProps {
  data: BodegaEntry[];
}

function shortenName(name: string, maxLen = 18): string {
  if (name.length <= maxLen) return name;
  return name.substring(0, maxLen - 1) + "…";
}

export default function WarehouseChart({ data }: WarehouseChartProps) {
  const chartData = data.slice(0, 10).map((d) => ({
    name: shortenName(d.name),
    fullName: d.name,
    units: d.units,
    costValue: d.costValue,
  }));

  const chartConfig: ChartConfig = {
    units: { label: "Unidades", color: "hsl(221 83% 53%)" },
  };

  const formatCop = (v: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Distribución por Bodega
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, props) => {
                    const entry = props.payload;
                    return `${entry.fullName}: ${Number(value).toLocaleString("es-CO")} uds · ${formatCop(entry.costValue)}`;
                  }}
                />
              }
            />
            <Bar
              dataKey="units"
              fill="var(--color-units)"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

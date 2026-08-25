import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { SizeHeatmapRow } from "@/lib/inventoryAnalytics";

interface SizeHeatmapProps {
  data: SizeHeatmapRow[];
  allSizes: string[];
}

function cellColor(stock: number | undefined): string {
  if (stock === undefined || stock === 0)
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  if (stock <= 3)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  if (stock <= 20)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
}

function stockBadge(total: number): { text: string; cls: string } {
  if (total === 0)
    return { text: "OOS", cls: "bg-red-500 text-white" };
  if (total <= 3)
    return { text: "Bajo", cls: "bg-amber-500 text-white" };
  if (total <= 30)
    return { text: "OK", cls: "bg-emerald-500 text-white" };
  return { text: "Alto", cls: "bg-indigo-500 text-white" };
}

export default function SizeHeatmap({ data, allSizes }: SizeHeatmapProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? data.filter(
        (r) =>
          r.referencia.toLowerCase().includes(search.toLowerCase()) ||
          r.descripcion.toLowerCase().includes(search.toLowerCase()) ||
          r.color.toLowerCase().includes(search.toLowerCase())
      )
    : data;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">
            Matriz de Tallas por Referencia
          </CardTitle>
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs pl-7"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/40 border border-red-200" /> 0
          </span>
          <span className="text-[10px] flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-200" /> 1-3
          </span>
          <span className="text-[10px] flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200" /> 4-20
          </span>
          <span className="text-[10px] flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200" /> 20+
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[600px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-background z-10 min-w-[180px]">
                    Referencia / Color
                  </th>
                  {allSizes.map((size) => (
                    <th
                      key={size}
                      className="text-center px-1.5 py-2 font-semibold min-w-[44px]"
                    >
                      {size}
                    </th>
                  ))}
                  <th className="text-center px-2 py-2 font-semibold min-w-[56px]">
                    Total
                  </th>
                  <th className="text-center px-2 py-2 font-semibold min-w-[48px]">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={allSizes.length + 3}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay datos para mostrar
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => {
                    const badge = stockBadge(row.totalStock);
                    return (
                      <tr
                        key={`${row.referencia}-${row.color}-${idx}`}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-3 py-1.5 sticky left-0 bg-background z-10">
                          <div className="font-medium">{row.referencia}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                            {row.color}
                          </div>
                        </td>
                        {allSizes.map((size) => {
                          const val = row.sizes[size];
                          return (
                            <td key={size} className="text-center px-1 py-1.5">
                              <span
                                className={`inline-flex items-center justify-center w-8 h-6 rounded text-[11px] font-medium ${cellColor(val)}`}
                              >
                                {val ?? 0}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-2 py-1.5 font-bold tabular-nums">
                          {row.totalStock.toLocaleString("es-CO")}
                        </td>
                        <td className="text-center px-2 py-1.5">
                          <Badge
                            className={`text-[9px] px-1.5 ${badge.cls}`}
                            variant="secondary"
                          >
                            {badge.text}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

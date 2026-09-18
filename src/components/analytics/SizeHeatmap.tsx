import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  SlidersHorizontal,
  Layers,
  PackageCheck,
  PackageX,
  Sparkles,
} from "lucide-react";
import type { SizeHeatmapRow } from "@/lib/inventoryAnalytics";
import {
  STANDARD_LETTER_SIZES,
  STANDARD_NUMERIC_SIZES,
  STANDARD_PANT_SIZES,
  STANDARD_UNICA_SIZES,
  sizeSort,
} from "@/lib/inventoryAnalytics";

interface SizeHeatmapProps {
  data: SizeHeatmapRow[];
  allSizes: string[];
}

type SizeViewMode =
  | "catalog"
  | "letter"
  | "numeric"
  | "pant"
  | "unica"
  | "active-only";

function cellColor(stock: number | undefined): string {
  if (stock === undefined || stock === 0)
    return "bg-red-50 text-red-700/80 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-900/40";
  if (stock <= 3)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 font-semibold";
  if (stock <= 20)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 font-semibold";
  return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-300 font-bold";
}

function stockBadge(total: number): { text: string; cls: string } {
  if (total === 0)
    return { text: "Agotado", cls: "bg-red-500 text-white hover:bg-red-600" };
  if (total <= 3)
    return { text: "Crítico", cls: "bg-amber-500 text-white hover:bg-amber-600" };
  if (total <= 30)
    return { text: "Óptimo", cls: "bg-emerald-500 text-white hover:bg-emerald-600" };
  return { text: "Sobrestock", cls: "bg-indigo-600 text-white hover:bg-indigo-700" };
}

export default function SizeHeatmap({ data, allSizes }: SizeHeatmapProps) {
  const [search, setSearch] = useState("");
  const [sizeMode, setSizeMode] = useState<SizeViewMode>("catalog");
  const [selectedLinea, setSelectedLinea] = useState<string>("all");
  const [onlyWithStock, setOnlyWithStock] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState<number>(50);

  // Filter base rows by search and linea
  const baseRows = useMemo(() => {
    let rows = data;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.referencia.toLowerCase().includes(q) ||
          r.descripcion.toLowerCase().includes(q) ||
          r.color.toLowerCase().includes(q)
      );
    }

    if (selectedLinea !== "all") {
      rows = rows.filter((r) =>
        r.referencia.toUpperCase().startsWith(selectedLinea)
      );
    }

    return rows;
  }, [data, search, selectedLinea]);

  // Determine initial candidate size columns based on sizeMode
  const candidateDisplayedSizes = useMemo(() => {
    switch (sizeMode) {
      case "letter": {
        return STANDARD_LETTER_SIZES;
      }
      case "numeric": {
        return STANDARD_NUMERIC_SIZES;
      }
      case "pant": {
        return STANDARD_PANT_SIZES;
      }
      case "unica": {
        return STANDARD_UNICA_SIZES;
      }
      case "active-only": {
        // Collect sizes that actually have > 0 units in baseRows
        const activeSizes = new Set<string>();
        baseRows.forEach((r) => {
          Object.entries(r.sizes).forEach(([s, qty]) => {
            if (qty > 0) activeSizes.add(s);
          });
        });
        const arr = Array.from(activeSizes).sort(sizeSort);
        return arr.length > 0 ? arr : allSizes;
      }
      case "catalog":
      default: {
        const merged = new Set([...allSizes, "XS", "S", "M", "L", "XL", "U"]);
        return Array.from(merged).sort(sizeSort);
      }
    }
  }, [sizeMode, allSizes, baseRows]);

  // Filter rows: when onlyWithStock or active-only/unica is active, keep ONLY rows that have stock > 0 in displayed sizes
  const filteredRows = useMemo(() => {
    if (!onlyWithStock && sizeMode !== "active-only" && sizeMode !== "unica") {
      return baseRows;
    }

    return baseRows.filter((r) => {
      if (!onlyWithStock && sizeMode === "unica") {
        return "U" in r.sizes || candidateDisplayedSizes.some((s) => s in r.sizes);
      }
      // Must have at least one candidate displayed size with stock > 0
      return candidateDisplayedSizes.some((s) => (r.sizes[s] || 0) > 0);
    });
  }, [baseRows, candidateDisplayedSizes, onlyWithStock, sizeMode]);

  // Refine displayed size columns for active-only mode to remove completely empty size columns
  const displayedSizes = useMemo(() => {
    if (sizeMode !== "active-only") {
      return candidateDisplayedSizes;
    }
    const activeSizes = new Set<string>();
    filteredRows.forEach((r) => {
      Object.entries(r.sizes).forEach(([s, qty]) => {
        if (qty > 0) activeSizes.add(s);
      });
    });
    const arr = Array.from(activeSizes).sort(sizeSort);
    return arr.length > 0 ? arr : candidateDisplayedSizes;
  }, [sizeMode, candidateDisplayedSizes, filteredRows]);

  // Total items with inventory count for current line/search
  const itemsWithStockCount = useMemo(
    () =>
      baseRows.filter((r) =>
        Object.values(r.sizes).some((qty) => qty > 0)
      ).length,
    [baseRows]
  );

  const visibleRows = filteredRows.slice(0, pageSize);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Matriz de Tallas por Referencia
              </CardTitle>
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium"
              >
                {itemsWithStockCount} prendas con stock
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Visualiza existencias y faltantes por talla en cada prenda para detectar tallas rotas
            </p>
          </div>

          {/* Search + Linea Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Linea pills */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg text-[11px]">
              {[
                { key: "all", label: "Todas" },
                { key: "T", label: "Línea T" },
                { key: "B", label: "Línea B" },
                { key: "P", label: "Plus" },
                { key: "R", label: "Rappaz" },
              ].map((l) => (
                <button
                  key={l.key}
                  onClick={() => setSelectedLinea(l.key)}
                  className={`px-2 py-1 rounded-md transition-all ${
                    selectedLinea === l.key
                      ? "bg-background shadow-xs font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar ref/color..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
          </div>
        </div>

        {/* Size View Mode Tabs + Stock Filter Toggle + Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" /> Modo Tallas:
            </span>
            {[
              { key: "catalog", label: "Curva Completa" },
              { key: "letter", label: "Letras (XS-3XL)" },
              { key: "numeric", label: "Numéricas (02-16)" },
              { key: "pant", label: "Pantalón (28-38)" },
              { key: "unica", label: "Talla Única (U)" },
              { key: "active-only", label: "Solo con Stock" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setSizeMode(m.key as SizeViewMode)}
                className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                  sizeMode === m.key
                    ? "bg-primary text-primary-foreground font-medium shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {m.label}
              </button>
            ))}

            {/* Toggle button to explicitly show only items with stock */}
            <button
              onClick={() => setOnlyWithStock(!onlyWithStock)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                onlyWithStock || sizeMode === "active-only"
                  ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              title={
                onlyWithStock || sizeMode === "active-only"
                  ? "Mostrando solo prendas con inventario disponible (>0)"
                  : "Mostrando todas las prendas (incluye prendas agotadas)"
              }
            >
              {onlyWithStock || sizeMode === "active-only" ? (
                <PackageCheck className="h-3 w-3" />
              ) : (
                <PackageX className="h-3 w-3" />
              )}
              {onlyWithStock || sizeMode === "active-only"
                ? "Solo con inventario"
                : "Todas las prendas"}
            </button>
          </div>

          {/* Color Legend */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-red-100 dark:bg-red-950 border border-red-300" /> 0 (Agotado)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-100 dark:bg-amber-900 border border-amber-300" /> 1-3
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-100 dark:bg-emerald-900 border border-emerald-300" /> 4-20
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-indigo-100 dark:bg-indigo-900 border border-indigo-300" /> &gt;20
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[700px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-bold sticky left-0 bg-background/95 backdrop-blur-sm z-20 min-w-[200px] border-r">
                    Referencia / Color
                  </th>
                  {displayedSizes.map((size) => (
                    <th
                      key={size}
                      className="text-center px-1.5 py-2.5 font-bold min-w-[44px] tracking-tight bg-muted/20"
                    >
                      {size}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2.5 font-bold min-w-[64px] bg-muted/40">
                    Total
                  </th>
                  <th className="text-center px-3 py-2.5 font-bold min-w-[68px]">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displayedSizes.length + 3}
                      className="text-center py-12 text-muted-foreground text-xs"
                    >
                      No se encontraron referencias con inventario para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, idx) => {
                    const badge = stockBadge(row.totalStock);
                    return (
                      <tr
                        key={`${row.referencia}-${row.color}-${idx}`}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-4 py-2 sticky left-0 bg-background/95 backdrop-blur-sm z-10 border-r">
                          <div className="font-semibold text-foreground">
                            {row.referencia}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[190px]">
                            {row.color || "Único"}
                          </div>
                        </td>
                        {displayedSizes.map((size) => {
                          const val = row.sizes[size];
                          return (
                            <td key={size} className="text-center px-1 py-1.5">
                              <span
                                className={`inline-flex items-center justify-center min-w-[34px] h-6 px-1 rounded text-[11px] ${cellColor(
                                  val
                                )}`}
                              >
                                {val !== undefined ? val : 0}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2 font-bold tabular-nums bg-muted/10">
                          {row.totalStock.toLocaleString("es-CO")}
                        </td>
                        <td className="text-center px-3 py-2">
                          <Badge
                            className={`text-[9px] px-2 py-0.5 font-semibold ${badge.cls}`}
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

        {/* Pagination footer */}
        {filteredRows.length > pageSize && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Mostrando {visibleRows.length} de {filteredRows.length} referencias con inventario
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageSize((prev) => prev + 50)}
              className="h-7 text-xs"
            >
              Cargar 50 más
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


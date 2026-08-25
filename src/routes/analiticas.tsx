import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Download,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Package,
  Boxes,
  FileSpreadsheet,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { loadInventory, type InventoryRow, formatCurrency } from "@/lib/inventory";
import {
  computeInventoryAnalytics,
  applyFilters,
  EMPTY_FILTERS,
  type AnalyticsFilterState,
} from "@/lib/inventoryAnalytics";

import KpiCards from "@/components/analytics/KpiCards";
import StockHealthChart from "@/components/analytics/StockHealthChart";
import WarehouseChart from "@/components/analytics/WarehouseChart";
import SizeCurveChart from "@/components/analytics/SizeCurveChart";
import SizeHeatmap from "@/components/analytics/SizeHeatmap";
import AnalyticsFilters from "@/components/analytics/AnalyticsFilters";

export const Route = createFileRoute("/analiticas")({
  component: AnaliticasPage,
});

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function AnaliticasPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsFilterState>(EMPTY_FILTERS);

  // Read disabled bodegas from localStorage
  const [disabledBodegas, setDisabledBodegas] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("disabled_bodegas");
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });

  const reloadData = useCallback(async () => {
    try {
      setLoading(true);
      const { rows: invRows, updatedAt: invUpdated } = await loadInventory();
      setRows(invRows);
      setUpdatedAt(invUpdated);
    } catch (err: any) {
      toast.error("Error al cargar inventario para analíticas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Sync disabled bodegas event
  useEffect(() => {
    const syncBodegas = () => {
      try {
        const saved = localStorage.getItem("disabled_bodegas");
        if (saved) setDisabledBodegas(new Set(JSON.parse(saved)));
      } catch {}
    };
    window.addEventListener("disabled_bodegas_changed", syncBodegas);
    window.addEventListener("storage", syncBodegas);
    return () => {
      window.removeEventListener("disabled_bodegas_changed", syncBodegas);
      window.removeEventListener("storage", syncBodegas);
    };
  }, []);

  // Filter active rows by bodega configuration
  const activeRows = useMemo(() => {
    if (disabledBodegas.size === 0) return rows;
    const disabledUpper = new Set(
      Array.from(disabledBodegas).map((b) => b.trim().toUpperCase())
    );
    return rows.filter((r) => {
      const bName = (r.bodega || "PRINCIPAL 1004").trim().toUpperCase();
      return !disabledUpper.has(bName);
    });
  }, [rows, disabledBodegas]);

  // Filtered rows for current filter criteria
  const filteredRows = useMemo(() => {
    let result = applyFilters(activeRows, filters);

    // Apply special preset logic if selected
    if (filters.preset === "broken-sizes") {
      // Find references with broken size runs (at least one size with 0 while others > 0)
      const refMap = new Map<string, { total: number; sizes: Map<string, number> }>();
      activeRows.forEach((r) => {
        if (!refMap.has(r.referencia)) {
          refMap.set(r.referencia, { total: 0, sizes: new Map() });
        }
        const entry = refMap.get(r.referencia)!;
        entry.total += r.saldo;
        entry.sizes.set(r.talla, (entry.sizes.get(r.talla) || 0) + r.saldo);
      });
      const brokenRefs = new Set<string>();
      refMap.forEach((entry, ref) => {
        if (entry.total > 0 && entry.sizes.size > 1) {
          const hasZero = Array.from(entry.sizes.values()).some((q) => q === 0);
          if (hasZero) brokenRefs.add(ref);
        }
      });
      result = result.filter((r) => brokenRefs.has(r.referencia));
    } else if (filters.preset === "orphans") {
      result = result.filter((r) => r.saldo === 1);
    }

    return result;
  }, [activeRows, filters]);

  // Analytics Computation
  const analytics = useMemo(() => {
    return computeInventoryAnalytics(activeRows, filteredRows);
  }, [activeRows, filteredRows]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border bg-primary text-primary-foreground sticky top-0 z-30 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-primary-foreground hover:bg-accent/30 transition-colors"
              title="Volver al buscador"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold font-sora tracking-tight leading-tight">
                  Analíticas de Inventario
                </h1>
                <Badge
                  variant="secondary"
                  className="bg-accent/20 text-accent-foreground text-[10px] font-semibold hidden sm:inline-flex"
                >
                  Ecommerce KPIs
                </Badge>
              </div>
              <p className="text-xs text-primary-foreground/70 flex items-center gap-2 mt-0.5">
                <Clock className="h-3 w-3 inline" />
                {updatedAt ? (
                  <span>Actualizado: {formatDateTime(updatedAt)}</span>
                ) : (
                  <span>Cargando datos...</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reloadData}
              disabled={loading}
              className="h-8 text-xs bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Link to="/cargar">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                Cargar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 flex-1 w-full space-y-6">
        {/* Filters Section */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <AnalyticsFilters
            filters={filters}
            onFilterChange={setFilters}
            availableBodegas={analytics.availableBodegas}
            availableTallas={analytics.availableTallas}
            availableColors={analytics.availableColors}
          />
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Calculando métricas de inventario…</p>
          </div>
        ) : activeRows.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-xl border border-dashed p-8 space-y-4">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <div>
              <h3 className="text-base font-semibold">No hay datos de inventario disponibles</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Carga un archivo CSV o sincroniza el inventario desde la página de carga para visualizar las analíticas.
              </p>
            </div>
            <Link to="/cargar">
              <Button size="sm" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Ir a Cargar Inventario
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* KPI Cards Row */}
            <KpiCards kpis={analytics.kpis} health={analytics.healthBreakdown} />

            {/* Charts Grid (Donut, Warehouses, Size Curve) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StockHealthChart health={analytics.healthBreakdown} />
              <WarehouseChart data={analytics.bodegaDistribution} />
              <SizeCurveChart data={analytics.sizeCurve} />
            </div>

            {/* Strategic Action Tiers: Top Overstock vs Top Understock */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Overstock Exposure */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <TrendingUp className="h-4 w-4" /> Top Capital Inmovilizado (Sobrestock)
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Referencias con mayor valor en inventario &gt; 30 unidades
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 text-[10px]">
                    {analytics.topOverstock.length} Alertas
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border text-xs">
                    {analytics.topOverstock.length === 0 ? (
                      <p className="p-4 text-center text-muted-foreground text-xs">
                        No hay referencias en sobrestock excesivo.
                      </p>
                    ) : (
                      analytics.topOverstock.slice(0, 5).map((ref) => (
                        <div
                          key={ref.referencia}
                          className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="font-semibold truncate">{ref.referencia}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {ref.descripcion}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-foreground">
                              {formatCurrency(ref.totalCostValue)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {ref.totalStock} uds · PVP: {formatCurrency(ref.pvp)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Understock / Stockout Risk */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <TrendingDown className="h-4 w-4" /> Riesgo de Agotamiento (Stock Bajo)
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Referencias activas con 1 a 3 unidades restantes
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 text-[10px]">
                    {analytics.topUnderstock.length} Críticos
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border text-xs">
                    {analytics.topUnderstock.length === 0 ? (
                      <p className="p-4 text-center text-muted-foreground text-xs">
                        No hay referencias en stock bajo crítico.
                      </p>
                    ) : (
                      analytics.topUnderstock.slice(0, 5).map((ref) => (
                        <div
                          key={ref.referencia}
                          className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold truncate">{ref.referencia}</p>
                              {ref.isBrokenSizeRun && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" title="Talla rota" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {ref.descripcion}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              {ref.totalStock} {ref.totalStock === 1 ? "unidad" : "unidades"}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              PVP: {formatCurrency(ref.pvp)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Size Heatmap Matrix */}
            <SizeHeatmap data={analytics.sizeHeatmap} allSizes={analytics.allSizes} />
          </>
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="border-t border-border bg-card py-4 mt-auto">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Seller Buddy Search — Analíticas de Inventario</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">
              Catálogo e Inventario
            </Link>
            <Link to="/cargar" className="hover:text-foreground transition-colors">
              Gestión de Carga
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React from "react";
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Layers,
  HeartPulse,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsKpis, HealthBreakdown } from "@/lib/inventoryAnalytics";

interface KpiCardsProps {
  kpis: AnalyticsKpis;
  health: HealthBreakdown;
}

function formatCompact(value: number, currency?: "COP" | "USD"): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: value >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    }).format(value);
  }
  if (currency === "COP") {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("es-CO").format(value);
}

const kpiConfig = [
  {
    key: "totalUnits" as const,
    label: "Total Unidades",
    sublabel: (k: AnalyticsKpis) => `${k.uniqueReferences} refs · ${k.totalSkus} SKUs`,
    icon: Package,
    format: (k: AnalyticsKpis) => formatCompact(k.totalUnits),
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/40",
  },
  {
    key: "totalCostValue" as const,
    label: "Valor Costo (PVM)",
    sublabel: (k: AnalyticsKpis) =>
      `AUP: ${formatCompact(k.weightedAupCost, "COP")}`,
    icon: DollarSign,
    format: (k: AnalyticsKpis) => formatCompact(k.totalCostValue, "COP"),
    color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40",
  },
  {
    key: "totalRetailValue" as const,
    label: "Valor Retail (PVP)",
    sublabel: (k: AnalyticsKpis) =>
      `USD: ${formatCompact(k.totalUsdValue, "USD")}`,
    icon: DollarSign,
    format: (k: AnalyticsKpis) => formatCompact(k.totalRetailValue, "COP"),
    color: "text-violet-600 bg-violet-100 dark:bg-violet-900/40",
  },
  {
    key: "theoreticalMarginPct" as const,
    label: "Margen Teórico",
    sublabel: (_k: AnalyticsKpis) => "PVP vs PVM ponderado",
    icon: TrendingUp,
    format: (k: AnalyticsKpis) => `${k.theoreticalMarginPct.toFixed(1)}%`,
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/40",
    badge: (k: AnalyticsKpis) =>
      k.theoreticalMarginPct >= 55
        ? { text: "Óptimo", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
        : { text: "Bajo", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  },
  {
    key: "brokenSizeRate" as const,
    label: "Tallas Rotas",
    sublabel: (_k: AnalyticsKpis) => "Refs con tallas agotadas",
    icon: AlertTriangle,
    format: (k: AnalyticsKpis) => `${k.brokenSizeRate.toFixed(1)}%`,
    color: "text-orange-600 bg-orange-100 dark:bg-orange-900/40",
    badge: (k: AnalyticsKpis) =>
      k.brokenSizeRate <= 15
        ? { text: "Óptimo", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
        : k.brokenSizeRate <= 30
        ? { text: "Atención", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" }
        : { text: "Crítico", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  },
  {
    key: "healthyStockPct" as const,
    label: "Salud del Stock",
    sublabel: (k: AnalyticsKpis) =>
      `Huérfanos: ${k.orphanSkuRatio.toFixed(1)}%`,
    icon: HeartPulse,
    format: (k: AnalyticsKpis) => `${k.healthyStockPct.toFixed(1)}%`,
    color: "text-teal-600 bg-teal-100 dark:bg-teal-900/40",
    badge: (k: AnalyticsKpis) =>
      k.healthyStockPct >= 70
        ? { text: "Saludable", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
        : { text: "Revisar", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  },
];

export default function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiConfig.map((cfg) => {
        const Icon = cfg.icon;
        const badge = cfg.badge?.(kpis);
        return (
          <Card
            key={cfg.key}
            className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`rounded-lg p-1.5 ${cfg.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                {badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}
                  >
                    {badge.text}
                  </span>
                )}
              </div>
              <p className="text-xl font-bold font-sora tracking-tight">
                {cfg.format(kpis)}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                {cfg.label}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {cfg.sublabel(kpis)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, Loader2, TrendingUp } from "lucide-react";
import { Toaster } from "sonner";

import { AnalyticsView } from "@/components/AnalyticsView";
import {
  groupByReferencia,
  loadInventory,
  type ReferenceGroup,
} from "@/lib/inventory";

export const Route = createFileRoute("/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas de Ventas — Buscador de Referencias" },
      {
        name: "description",
        content:
          "Panel privado con las referencias más pedidas y métricas de ventas del inventario.",
      },
      { property: "og:title", content: "Métricas de Ventas — Buscador de Referencias" },
      {
        property: "og:description",
        content:
          "Panel privado con las referencias más pedidas y métricas de ventas del inventario.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetricasPage,
});

function MetricasPage() {
  const [groups, setGroups] = useState<ReferenceGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { rows } = await loadInventory();
        if (!active) return;
        setGroups(groupByReferencia(rows));
      } catch (err) {
        console.error("Error cargando inventario:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster position="top-center" richColors />

      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5">
          <Link
            to="/cargar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-primary-foreground hover:bg-accent/30 transition-colors"
            title="Volver a administración"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold leading-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Métricas de Ventas
            </h1>
            <p className="text-sm text-primary-foreground/70">
              Referencias más pedidas en toda la plataforma
            </p>
          </div>
          <div className="flex-1" />
          <Link
            to="/analiticas"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent/20 px-3.5 py-2 text-sm font-bold text-primary-foreground hover:bg-accent/30 transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            Analíticas
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Cargando inventario...</p>
          </div>
        ) : (
          <AnalyticsView allGroups={groups} />
        )}
      </main>
    </div>
  );
}

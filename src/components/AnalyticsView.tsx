import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, PackageSearch, Loader2 } from "lucide-react";
import type { ReferenceGroup } from "@/lib/inventory";

type TopItem = {
  referencia: string;
  descripcion: string;
  total_cantidad: number;
  imageUrl?: string;
};

export function AnalyticsView({ allGroups }: { allGroups: ReferenceGroup[] }) {
  const [loading, setLoading] = useState(true);
  const [topItems, setTopItems] = useState<TopItem[]>([]);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        // We only care about order items, so fetch them
        const { data, error } = await supabase
          .from("order_items")
          .select("referencia, descripcion, cantidad");

        if (error) throw error;

        // Group by referencia
        const grouped: Record<string, TopItem> = {};
        for (const item of data || []) {
          if (!grouped[item.referencia]) {
            grouped[item.referencia] = {
              referencia: item.referencia,
              descripcion: item.descripcion || "Sin descripción",
              total_cantidad: 0,
            };
          }
          grouped[item.referencia].total_cantidad += item.cantidad;
        }

        // Sort by total_cantidad descending
        const sorted = Object.values(grouped).sort((a, b) => b.total_cantidad - a.total_cantidad);
        
        // Take top 50
        const top50 = sorted.slice(0, 50);

        // Map images from allGroups if available
        for (const item of top50) {
          const group = allGroups.find(g => g.referencia === item.referencia);
          if (group?.imageUrl) {
            item.imageUrl = group.imageUrl;
          }
        }

        setTopItems(top50);
      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    if (allGroups.length > 0) {
      loadAnalytics();
    }
  }, [allGroups]);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p className="text-sm font-medium">Calculando estadísticas...</p>
      </div>
    );
  }

  if (topItems.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-xl">
        <PackageSearch className="h-10 w-10 mb-4 opacity-30" />
        <p className="font-medium">No hay datos suficientes para generar analíticas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4 bg-gradient-to-r from-primary/10 to-transparent p-5 rounded-2xl border border-primary/20">
        <div className="p-3 bg-background rounded-xl text-primary shadow-sm border border-primary/10">
          <TrendingUp className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">Top 50 Referencias Más Pedidas</h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">Basado en el historial de pedidos de toda la plataforma</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {topItems.map((item, index) => (
          <div key={item.referencia} className="relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
            {/* Rank Badge */}
            <div className="absolute top-2.5 left-2.5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-background/90 backdrop-blur-md border border-border/50 font-black text-sm text-foreground shadow-sm">
              #{index + 1}
            </div>
            
            {/* Image */}
            <div className="aspect-[4/5] bg-muted/20 relative flex items-center justify-center overflow-hidden">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.referencia}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="text-muted-foreground/40 text-[10px] font-bold tracking-widest bg-accent/5 w-full h-full flex items-center justify-center">SIN FOTO</div>
              )}
            </div>

            {/* Info */}
            <div className="p-3 border-t border-border flex flex-col flex-1 bg-gradient-to-b from-card to-accent/5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 font-bold truncate" title={item.descripcion}>
                {item.descripcion}
              </div>
              <div className="text-lg font-black text-foreground leading-none mb-3">
                {item.referencia}
              </div>
              
              <div className="mt-auto flex items-center justify-between bg-background rounded-lg p-2 border border-border/50">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Unidades</span>
                <span className="inline-flex items-center justify-center font-black text-primary text-sm">
                  {item.total_cantidad}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

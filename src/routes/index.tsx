import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Clock,
  PackageSearch,
  Tag,
  Boxes,
  FileWarning,
  CheckCircle2,
  Image as ImageIcon,
  Shirt,
  Table,
  LayoutGrid,
  Copy,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { useQuery } from "@tanstack/react-query";

import {
  formatCurrency,
  formatDateTime,
  groupByReferencia,
  loadInventory,
  searchReferences,
  type InventoryRow,
  type ReferenceGroup,
} from "@/lib/inventory";
import { getShopifyProductImage } from "@/lib/shopify";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { rows, updatedAt } = await loadInventory();
        if (!active) return;
        setRows(rows);
        setUpdatedAt(updatedAt);
      } catch {
        if (active) toast.error("No se pudo cargar el inventario.");
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => groupByReferencia(rows), [rows]);
  const results = useMemo(
    () => searchReferences(groups, query),
    [groups, query],
  );

  const [selectedTallas, setSelectedTallas] = useState<Set<string>>(new Set());
  const [selectedColores, setSelectedColores] = useState<Set<string>>(new Set());

  // Filter options based on ALL inventory (independent of query), so filters work without searching first
  const { tallasOptions, coloresOptions } = useMemo(() => {
    const tSet = new Set<string>();
    const cSet = new Set<string>();
    for (const g of groups) {
      for (const v of g.variantes) {
        if (v.saldo <= 0) continue;
        if (v.talla) tSet.add(v.talla);
        if (v.color) cSet.add(v.color);
      }
    }
    const tallas = Array.from(tSet).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "es");
    });
    const colores = Array.from(cSet).sort((a, b) => a.localeCompare(b, "es"));
    return { tallasOptions: tallas, coloresOptions: colores };
  }, [groups]);

  // Clear filters that are no longer available
  useEffect(() => {
    setSelectedTallas((prev) => {
      const next = new Set(Array.from(prev).filter((t) => tallasOptions.includes(t)));
      return next.size === prev.size ? prev : next;
    });
    setSelectedColores((prev) => {
      const next = new Set(Array.from(prev).filter((c) => coloresOptions.includes(c)));
      return next.size === prev.size ? prev : next;
    });
  }, [tallasOptions, coloresOptions]);

  const hasActiveFilters = selectedTallas.size > 0 || selectedColores.size > 0;

  // Base list: search results if there's a query, otherwise all groups when filters are active
  const baseList = useMemo(() => {
    if (query.trim() !== "") return results;
    if (hasActiveFilters) return groups;
    return [];
  }, [query, results, groups, hasActiveFilters]);

  const filteredResults = useMemo(() => {
    if (!hasActiveFilters) return baseList;
    const out: ReferenceGroup[] = [];
    for (const g of baseList) {
      const variantes = g.variantes.filter((v) => {
        const okT = selectedTallas.size === 0 || selectedTallas.has(v.talla);
        const okC = selectedColores.size === 0 || selectedColores.has(v.color);
        return okT && okC;
      });
      if (variantes.length === 0) continue;
      out.push({
        ...g,
        variantes,
        totalSaldo: variantes.reduce((s, v) => s + v.saldo, 0),
      });
    }
    return out;
  }, [baseList, selectedTallas, selectedColores, hasActiveFilters]);

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
  const hasActiveFilters = selectedTallas.size > 0 || selectedColores.size > 0;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <PackageSearch className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">
                Buscador de Referencias
              </h1>
              <p className="text-sm text-primary-foreground/70">
                Consulta de precios detal y mayorista
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Last updated indicator */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {!hydrated ? (
            <span>Cargando…</span>
          ) : updatedAt ? (
            <span>
              Inventario actualizado:{" "}
              <span className="font-semibold text-foreground">
                {formatDateTime(updatedAt)}
              </span>
            </span>
          ) : (
            <span>Aún no has cargado inventario.</span>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por referencia, descripción, color o SKU (ej: B0102, cargo, azul)"
            className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-base shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            autoFocus
          />
        </div>

        {/* Filters */}
        {hydrated && rows.length > 0 && query.trim() !== "" && results.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Filtrar por talla y color
              </span>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSelectedTallas(new Set());
                    setSelectedColores(new Set());
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {tallasOptions.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Tallas
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tallasOptions.map((t) => {
                    const active = selectedTallas.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setSelectedTallas((prev) => toggle(prev, t))}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-accent"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {coloresOptions.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  Colores
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coloresOptions.map((c) => {
                    const active = selectedColores.has(c);
                    return (
                      <button
                        key={c}
                        onClick={() => setSelectedColores((prev) => toggle(prev, c))}
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-accent"
                        }`}
                      >
                        {c.toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content states */}
        <div className="mt-6 space-y-4">
          {hydrated && rows.length === 0 && (
            <EmptyState
              icon={<FileWarning className="h-8 w-8" />}
              title="No hay inventario cargado"
              description="Usa el botón «Cargar inventario» para subir tu archivo CSV y empezar a consultar referencias."
            />
          )}

          {hydrated &&
            rows.length > 0 &&
            query.trim() === "" && (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="Busca por referencia, descripción o SKU"
                description={`${groups.length} referencias disponibles para consultar.`}
              />
            )}

          {hydrated &&
            rows.length > 0 &&
            query.trim() !== "" &&
            results.length === 0 && (
              <EmptyState
                icon={<PackageSearch className="h-8 w-8" />}
                title="Sin resultados"
                description={`No se encontró ninguna referencia que coincida con «${query}».`}
              />
            )}

          {hydrated &&
            query.trim() !== "" &&
            results.length > 0 &&
            filteredResults.length === 0 && (
              <EmptyState
                icon={<PackageSearch className="h-8 w-8" />}
                title="Ninguna variante coincide con los filtros"
                description="Prueba a quitar alguna talla o color seleccionado."
              />
            )}

          {filteredResults.map((group) => (
            <ReferenceCard key={group.referencia} group={group} />
          ))}
        </div>
      </main>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ReferenceCard({ group }: { group: ReferenceGroup }) {
  // Query Shopify search suggestion API to fetch product image in live mode
  const { data: shopifyProduct, isLoading } = useQuery({
    queryKey: ["shopifyProduct", group.referencia],
    queryFn: () => getShopifyProductImage({ data: group.referencia }),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    enabled: !group.imageUrl, // Only fetch if we don't have a custom image URL in inventory data
  });

  const imageUrl = group.imageUrl || shopifyProduct?.imageUrl;
  const shopifyUrl = shopifyProduct?.shopifyUrl;

  // Group variants by color
  const variantsByColor = useMemo(() => {
    const grouped: Record<string, InventoryRow[]> = {};
    for (const v of group.variantes) {
      const color = v.color || "Sin color";
      if (!grouped[color]) grouped[color] = [];
      grouped[color].push(v);
    }
    // Sort colors alphabetically
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [group.variantes]);

  // Click-to-copy SKU handler
  const copySku = (sku: string, talla: string, color: string) => {
    if (!sku) return;
    navigator.clipboard.writeText(sku);
    toast.success(`SKU Copiado: ${sku} (${color} - Talla ${talla})`, {
      duration: 2000,
    });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row">
      {/* Product Image Section */}
      <div className={`relative w-full shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-border transition-all duration-300 ${
        imageUrl ? "md:w-48 aspect-[3/4] md:aspect-auto md:min-h-[220px]" : "md:w-36 bg-muted/30 flex flex-col items-center justify-center p-3"
      }`}>
        {isLoading ? (
          <div className="absolute inset-0 bg-muted/60 animate-pulse flex items-center justify-center min-h-[160px] w-full">
            <Boxes className="h-8 w-8 text-accent animate-spin" />
          </div>
        ) : imageUrl ? (
          <a
            href={shopifyUrl || "#"}
            target={shopifyUrl ? "_blank" : undefined}
            rel="noopener noreferrer"
            className={`block h-full w-full group relative ${shopifyUrl ? "cursor-pointer" : "cursor-default"}`}
          >
            <img
              src={imageUrl}
              alt={group.descripcion}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            {shopifyUrl && (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
                <span className="bg-background/90 backdrop-blur-xs text-[10px] font-bold text-foreground px-2.5 py-1 rounded-full shadow-sm">
                  Ver en tienda
                </span>
              </div>
            )}
          </a>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/30 p-4 border border-dashed border-muted-foreground/20 rounded-xl w-full h-full min-h-[120px]">
            <Shirt className="h-8 w-8 mb-1.5 text-muted-foreground/35 stroke-1" />
            <span className="text-[11px] font-semibold text-center select-none text-muted-foreground/50">Sin foto</span>
          </div>
        )}
      </div>

      {/* Product Info Section */}
      <div className="flex-1 flex flex-col justify-between">
        {/* Card Header */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary px-2.5 py-0.5 font-mono text-xs font-semibold text-primary-foreground tracking-wide">
                {group.referencia}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Boxes className="h-3.5 w-3.5" />
                {group.totalSaldo} unidades
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-foreground tracking-tight">
              {group.descripcion}
            </h2>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PriceBlock
            label="Precio Detal (PVP)"
            value={formatCurrency(group.pvp)}
            highlight
          />
          <PriceBlock
            label="Precio Mayorista (PVM)"
            value={formatCurrency(group.pvm)}
          />
        </div>

        {/* Inventory Header */}
        <div className="px-5 py-3 border-t border-border flex items-center bg-muted/10">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Disponibilidad de Inventario
          </span>
        </div>

        {/* Variants Content (Grid Matrix Only) */}
        <div className="p-5 space-y-4 border-t border-border">
          {variantsByColor.map(([color, variants]) => (
            <div
              key={color}
              className="flex flex-col sm:flex-row sm:items-start gap-3 border-b border-border/50 last:border-0 pb-4 last:pb-0"
            >
              <div className="flex items-center gap-2 w-32 shrink-0 pt-1">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-sm font-bold text-foreground capitalize">
                  {color}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {variants.map((v) => {
                  const hasStock = v.saldo > 0;

                  let badgeColor = "bg-muted text-muted-foreground/60 border-border opacity-30 line-through cursor-not-allowed";
                  if (hasStock) {
                    // Unified brand denim blue color palette for all active stock sizes
                    badgeColor = "bg-accent/10 text-primary border-accent/25 hover:bg-accent/20 dark:bg-accent/15 dark:text-accent dark:border-accent/30 dark:hover:bg-accent/25";
                  }

                  return (
                    <button
                      key={v.sku}
                      disabled={!hasStock}
                      onClick={() => copySku(v.sku, v.talla, color)}
                      className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 group relative ${badgeColor}`}
                      title={hasStock ? `Click para copiar SKU: ${v.sku}` : "Sin stock disponible"}
                    >
                      <span>Talla {v.talla}</span>
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        !hasStock ? "bg-muted/50 text-muted-foreground/40" : "bg-primary/15 text-primary dark:bg-accent/20 dark:text-accent"
                      }`}>
                        {v.saldo}
                      </span>
                      {hasStock && (
                        <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function PriceBlock({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${
      highlight 
        ? "bg-card border-border shadow-xs" 
        : "bg-accent/5 border-accent/15 shadow-xs"
    }`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Tag className="h-3.5 w-3.5 text-muted-foreground/75" />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-extrabold tracking-tight ${
          highlight ? "text-foreground" : "text-primary"
        }`}>
          {value}
        </span>
        {!highlight && (
          <span className="text-[9px] font-extrabold bg-accent/25 text-primary px-1.5 py-0.5 rounded-md uppercase tracking-wider select-none animate-pulse-slow">
            Mayorista
          </span>
        )}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search,
  Clock,
  PackageSearch,
  Tag,
  Boxes,
  FileWarning,
  ChevronDown,
  Shirt,
  Copy,
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  Download,
  X,
  History,
  Save,
  Eye,
  ExternalLink,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import {
  formatCurrency,
  formatDateTime,
  formatUsd,
  groupByReferencia,
  loadInventory,
  searchReferences,
  type InventoryRow,
  type ReferenceGroup,
} from "@/lib/inventory";
import { getShopifyProductImage } from "@/lib/shopify";
import {
  addOrderItem,
  clearOrder,
  downloadOrderXls,
  removeOrderItem,
  setOrderQty,
  useHydrateOrder,
  useOrder,
  saveOrderToDb,
  downloadSavedOrder,
  deleteOrderFromDb,
} from "@/lib/order";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"catalogo" | "historial">("catalogo");
  useHydrateOrder();
  const order = useOrder();
  const orderCount = order.reduce((s, i) => s + i.cantidad, 0);

  const reloadInventory = useCallback(async () => {
    try {
      const { rows, updatedAt } = await loadInventory();
      setRows(rows);
      setUpdatedAt(updatedAt);
    } catch {
      toast.error("No se pudo cargar el inventario.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    reloadInventory();
  }, [reloadInventory]);

  const groups = useMemo(() => groupByReferencia(rows), [rows]);
  const results = useMemo(
    () => searchReferences(groups, query),
    [groups, query],
  );

  const [selectedTallas, setSelectedTallas] = useState<Set<string>>(new Set());
  const [selectedColores, setSelectedColores] = useState<Set<string>>(new Set());
  const [selectedLineas, setSelectedLineas] = useState<Set<string>>(new Set());
  const [selectedBodegas, setSelectedBodegas] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
    description: string;
    refCode: string;
    shopifyUrl?: string;
  } | null>(null);

  const lineasOptions = useMemo(() => ["T", "B", "P", "R"], []);
  const lineasLabels: Record<string, string> = {
    T: "Línea T - Trj",
    B: "Línea B - Casual",
    P: "Línea P - Plus Size",
    R: "Línea R - Rappaz",
  };

  // Filter options based on ALL inventory (independent of query), so filters work without searching first
  const { tallasOptions, coloresOptions, bodegasOptions } = useMemo(() => {
    const tSet = new Set<string>();
    const cSet = new Set<string>();
    const bSet = new Set<string>();
    for (const g of groups) {
      for (const v of g.variantes) {
        if (v.saldo <= 0) continue;
        if (v.talla) tSet.add(v.talla);
        if (v.color) cSet.add(v.color);
        if (v.saldosPorBodega) {
          for (const [b, s] of Object.entries(v.saldosPorBodega)) {
            if (s > 0) bSet.add(b);
          }
        }
      }
    }
    const tallas = Array.from(tSet).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "es");
    });
    const colores = Array.from(cSet).sort((a, b) => a.localeCompare(b, "es"));
    const bodegas = Array.from(bSet).sort((a, b) => a.localeCompare(b, "es"));
    return { tallasOptions: tallas, coloresOptions: colores, bodegasOptions: bodegas };
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
    setSelectedBodegas((prev) => {
      const next = new Set(Array.from(prev).filter((b) => bodegasOptions.includes(b)));
      return next.size === prev.size ? prev : next;
    });
  }, [tallasOptions, coloresOptions, bodegasOptions]);

  const hasActiveFilters = selectedTallas.size > 0 || selectedColores.size > 0 || selectedLineas.size > 0 || selectedBodegas.size > 0;

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
      const firstChar = g.referencia.trim().charAt(0).toUpperCase();
      const okL = selectedLineas.size === 0 || selectedLineas.has(firstChar);
      if (!okL) continue;

      const newSaldosPorBodega: Record<string, number> = {};
      const variantes = g.variantes.map(v => {
        // Calcular saldo activo de la variante basado en bodegas seleccionadas
        let activeSaldo = 0;
        if (selectedBodegas.size === 0) {
          activeSaldo = v.saldo;
        } else {
          for (const b of Array.from(selectedBodegas)) {
            activeSaldo += (v.saldosPorBodega[b] || 0);
          }
        }
        return { ...v, saldo: activeSaldo };
      }).filter((v) => {
        if (v.saldo <= 0) return false;
        const okT = selectedTallas.size === 0 || selectedTallas.has(v.talla);
        const okC = selectedColores.size === 0 || selectedColores.has(v.color);
        return okT && okC;
      });

      if (variantes.length === 0) continue;
      
      const newTotalSaldo = variantes.reduce((s, v) => s + v.saldo, 0);
      
      // Rebuild bodegas summary for the filtered group
      for (const v of variantes) {
        if (selectedBodegas.size === 0) {
          for (const [b, s] of Object.entries(v.saldosPorBodega)) {
            newSaldosPorBodega[b] = (newSaldosPorBodega[b] || 0) + s;
          }
        } else {
          for (const b of Array.from(selectedBodegas)) {
            newSaldosPorBodega[b] = (newSaldosPorBodega[b] || 0) + (v.saldosPorBodega[b] || 0);
          }
        }
      }

      out.push({
        ...g,
        variantes,
        totalSaldo: newTotalSaldo,
        saldosPorBodega: newSaldosPorBodega,
      });
    }
    return out;
  }, [baseList, selectedTallas, selectedColores, selectedLineas, selectedBodegas, hasActiveFilters]);

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-6">
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
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Navigation Tabs */}
        <div className="mb-6 flex gap-2 border-b border-border pb-px">
          <button
            onClick={() => setActiveTab("catalogo")}
            className={`pb-2.5 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "catalogo"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="h-4 w-4" />
            Catálogo e Inventario
          </button>
          <button
            onClick={() => setActiveTab("historial")}
            className={`pb-2.5 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "historial"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            Historial de Pedidos
          </button>
        </div>

        {activeTab === "catalogo" ? (
          <div className="space-y-6">
            {/* Last updated indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            {hydrated && rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Línea"
                  options={lineasOptions}
                  selected={selectedLineas}
                  onToggle={(l) => setSelectedLineas((prev) => toggle(prev, l))}
                  onClear={() => setSelectedLineas(new Set())}
                  renderOption={(l) => lineasLabels[l] || `Línea ${l}`}
                />
                <FilterDropdown
                  label="Bodega"
                  options={bodegasOptions}
                  selected={selectedBodegas}
                  onToggle={(b) => setSelectedBodegas((prev) => toggle(prev, b))}
                  onClear={() => setSelectedBodegas(new Set())}
                  renderOption={(b) => b.toUpperCase()}
                />
                <FilterDropdown
                  label="Talla"
                  options={tallasOptions}
                  selected={selectedTallas}
                  onToggle={(t) => setSelectedTallas((prev) => toggle(prev, t))}
                  onClear={() => setSelectedTallas(new Set())}
                />
                <FilterDropdown
                  label="Color"
                  options={coloresOptions}
                  selected={selectedColores}
                  onToggle={(c) => setSelectedColores((prev) => toggle(prev, c))}
                  onClear={() => setSelectedColores(new Set())}
                  renderOption={(c) => c.toLowerCase()}
                />
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSelectedTallas(new Set());
                      setSelectedColores(new Set());
                      setSelectedLineas(new Set());
                      setSelectedBodegas(new Set());
                    }}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}

            {/* Content states */}
            <div className="mt-6 space-y-4">
              {hydrated && rows.length === 0 && (
                <EmptyState
                  icon={<FileWarning className="h-8 w-8" />}
                  title="No hay inventario cargado"
                  description="Usa el botón «Cargar inventario» en la página de carga para subir tu archivo CSV."
                />
              )}

              {hydrated &&
                rows.length > 0 &&
                query.trim() === "" &&
                !hasActiveFilters && (
                  <EmptyState
                    icon={<Search className="h-8 w-8" />}
                    title="Busca o filtra por talla y color"
                    description={`${groups.length} referencias disponibles. Escribe una referencia o usa los filtros arriba.`}
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
                <ReferenceCard
                  key={group.referencia}
                  group={group}
                  allGroups={groups}
                  onPreviewImage={setPreviewImage}
                />
              ))}
            </div>
          </div>
        ) : (
          <OrderHistory onOrderDeleted={reloadInventory} />
        )}
      </main>

      {/* Floating Action Button (FAB) for Current Order */}
      <button
        onClick={() => setOrderOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-accent px-5 py-4 text-sm font-bold text-accent-foreground shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 hover:shadow-accent/25 hover:shadow-xl"
        aria-label="Ver pedido actual"
      >
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          {orderCount > 0 && (
            <span className="absolute -top-3.5 -right-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-extrabold text-destructive-foreground animate-pulse">
              {orderCount}
            </span>
          )}
        </div>
        <span>Ver Pedido</span>
      </button>

      {orderOpen && (
        <OrderModal
          order={order}
          onClose={() => setOrderOpen(false)}
          onOrderSaved={reloadInventory}
        />
      )}

      {previewImage && (
        <ImageModal
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

function OrderModal({
  order,
  onClose,
  onOrderSaved,
}: {
  order: ReturnType<typeof useOrder>;
  onClose: () => void;
  onOrderSaved?: () => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const total = order.reduce((s, i) => s + i.pvm * i.cantidad, 0);
  const unidades = order.reduce((s, i) => s + i.cantidad, 0);

  const handleDownloadOnly = () => {
    if (order.length === 0) {
      toast.error("El pedido está vacío.");
      return;
    }
    const name = customerName.trim();
    downloadOrderXls(order, name || undefined);
    toast.success("Archivo Excel generado y descargado con éxito.");
  };

  const handleSaveToDb = async () => {
    if (order.length === 0) {
      toast.error("El pedido está vacío.");
      return;
    }
    const name = customerName.trim();
    if (!name) {
      toast.error("Por favor, ingresa el nombre del cliente para guardar el pedido.");
      return;
    }

    try {
      setIsSaving(true);
      toast.loading("Validando inventario y guardando pedido…", { id: "save-order" });
      
      // Save order to DB (validates availability)
      await saveOrderToDb(name, order);
      
      toast.success("¡Pedido guardado exitosamente en la base de datos!", { id: "save-order" });
      
      // Clear order and refresh inventory stock in parent
      clearOrder();
      onOrderSaved?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(`No se pudo guardar: ${err.message || "error desconocido"}`, {
        id: "save-order",
        duration: 6000,
      });
      // Refresh inventory so they see the actual current stock
      onOrderSaved?.();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-5 w-5" />
            <div>
              <h2 className="text-base font-bold leading-tight">Pedido actual</h2>
              <p className="text-xs text-primary-foreground/70">
                {unidades} unidades · {order.length} referencias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {order.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">
                No hay artículos en el pedido. Agrega variantes desde los resultados.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {order.map((it) => (
                <div
                  key={it.sku}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
                        {it.referencia}
                      </span>
                      <span className="text-xs font-semibold text-foreground capitalize">
                        {it.color}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · Talla {it.talla}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {it.descripcion}
                    </p>
                    <p className="mt-1 text-xs font-bold text-primary">
                      {formatCurrency(it.pvm)} <span className="font-normal text-muted-foreground">c/u</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setOrderQty(it.sku, it.cantidad - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={it.saldo}
                      value={it.cantidad}
                      onChange={(e) => {
                        const targetVal = Number(e.target.value) || 0;
                        const res = setOrderQty(it.sku, targetVal);
                        if (res.clamped && targetVal > it.saldo) {
                          toast.error(
                            `Solo hay ${it.saldo} unidades disponibles de esta variante.`,
                            { id: `limit-${it.sku}` }
                          );
                        }
                      }}
                      className="w-12 rounded-lg border border-border bg-background py-1 text-center text-sm font-bold outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => {
                        const res = setOrderQty(it.sku, it.cantidad + 1);
                        if (res.clamped) {
                          toast.error(
                            `Solo hay ${it.saldo} unidades disponibles de esta variante.`,
                            { id: `limit-${it.sku}` }
                          );
                        }
                      }}
                      disabled={it.cantidad >= it.saldo}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeOrderItem(it.sku)}
                      className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/30 px-5 py-4">
          {order.length > 0 && (
            <div className="mb-4">
              <label htmlFor="customerName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Nombre del Cliente
              </label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ingresa el nombre del cliente para guardar el pedido"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold outline-none focus:border-accent"
                disabled={isSaving}
              />
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">
              Total mayorista
            </span>
            <span className="text-xl font-extrabold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (order.length === 0) return;
                  if (confirm("¿Vaciar el pedido?")) clearOrder();
                }}
                disabled={order.length === 0 || isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                Vaciar
              </button>
              <button
                onClick={handleDownloadOnly}
                disabled={order.length === 0 || isSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-accent/20 disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Descargar Excel (.xls)
              </button>
            </div>
            <button
              onClick={handleSaveToDb}
              disabled={order.length === 0 || isSaving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground shadow-sm transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar Pedido en Base de Datos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
  renderOption,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  renderOption?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const count = selected.size;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-accent"
      >
        <span>
          {label}
          {count > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-border bg-card p-2 shadow-md">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {count > 0 && (
              <button
                onClick={() => {
                  onClear();
                }}
                className="text-[10px] font-semibold text-accent hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto pr-1">
            {options.map((option) => {
              const active = selected.has(option);
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onToggle(option)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="capitalize">
                    {renderOption ? renderOption(option) : option}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
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

function ReferenceCard({
  group,
  allGroups,
  onPreviewImage,
}: {
  group: ReferenceGroup;
  allGroups?: ReferenceGroup[];
  onPreviewImage?: (img: {
    src: string;
    alt: string;
    description: string;
    refCode: string;
    shopifyUrl?: string;
  }) => void;
}) {
  // Query Shopify search suggestion API to fetch product image in live mode
  const { data: shopifyProduct, isLoading } = useQuery({
    queryKey: ["shopifyProduct", group.referencia],
    queryFn: () => getShopifyProductImage({ data: group.referencia }),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    enabled: !group.imageUrl, // Only fetch if we don't have a custom image URL in inventory data
  });

  const [localBodega, setLocalBodega] = useState<string | null>(null);

  const imageUrl = group.imageUrl || shopifyProduct?.imageUrl;
  const shopifyUrl = shopifyProduct?.shopifyUrl;

  // Group variants by color
  const variantsByColor = useMemo(() => {
    const grouped: Record<string, InventoryRow[]> = {};
    for (const v of group.variantes) {
      let activeSaldo = v.saldo;
      if (localBodega && v.saldosPorBodega) {
        activeSaldo = v.saldosPorBodega[localBodega] || 0;
      }
      
      if (activeSaldo <= 0) continue;
      
      const vCopy = { ...v, saldo: activeSaldo };
      const color = vCopy.color || "Sin color";
      
      if (!grouped[color]) grouped[color] = [];
      grouped[color].push(vCopy);
    }
    // Sort colors alphabetically
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [group.variantes, localBodega]);

  // Completa el Look logic
  const crossSellSuggestions = useMemo(() => {
    if (!allGroups) return [];
    
    // Check if this is a pant (lines T, B, P, R)
    const isPant = ["T", "B", "P", "R"].includes(group.referencia.charAt(0).toUpperCase());
    if (!isPant) return [];

    // Get all colors of this pant that are currently in stock
    const availableColors = new Set(variantsByColor.map(([color]) => color.toUpperCase()));
    if (availableColors.size === 0) return [];

    // Find tops (not pants, matching color)
    const tops = allGroups.filter((g) => {
      if (g.referencia === group.referencia) return false;
      
      // M is for Muestras/fake items.
      const firstChar = g.referencia.charAt(0).toUpperCase();
      if (firstChar === "M") return false;

      const desc = (g.descripcion || "").toUpperCase();
      const isRealTopGarment = 
        desc.includes("BLUSA") ||
        desc.includes("CHAQUETA") ||
        desc.includes("CAMISETA") ||
        desc.includes("BODY") ||
        desc.includes("CROP") ||
        desc.includes("TOP") ||
        desc.includes("CHALECO") ||
        desc.includes("BUSO") ||
        desc.includes("CAMISERO") ||
        desc.includes("SUETER");

      if (!isRealTopGarment) return false;

      // Check if top has any color matching the pant's colors
      return g.variantes.some((v) => {
        const topColor = (v.color || "Sin color").toUpperCase();
        return availableColors.has(topColor) && v.saldo > 0;
      });
    });

    // Sort by stock descending and take top 5
    tops.sort((a, b) => b.totalSaldo - a.totalSaldo);
    return tops.slice(0, 5);
  }, [allGroups, group.referencia, variantsByColor]);

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
          <button
            onClick={() => {
              if (onPreviewImage) {
                onPreviewImage({
                  src: imageUrl,
                  alt: group.descripcion,
                  description: group.descripcion,
                  refCode: group.referencia,
                  shopifyUrl: shopifyUrl || undefined,
                });
              }
            }}
            className="block h-full w-full group relative cursor-zoom-in overflow-hidden"
            title="Click para ampliar imagen"
          >
            <img
              src={imageUrl}
              alt={group.descripcion}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md transition-transform duration-300 scale-90 group-hover:scale-100">
                <Eye className="h-5 w-5" />
              </div>
            </div>
          </button>
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
                {localBodega ? (group.saldosPorBodega[localBodega] || 0) : group.totalSaldo} unidades
              </span>
              {Object.entries(group.saldosPorBodega).map(([bodega, saldo]) => {
                const isSelected = localBodega === bodega;
                return (
                  <button 
                    key={bodega}
                    onClick={() => setLocalBodega(isSelected ? null : bodega)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer ${
                      isSelected 
                        ? "bg-accent text-accent-foreground border-accent hover:bg-accent/90" 
                        : "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
                    }`}
                    title={`Ver stock solo en ${bodega}`}
                  >
                    {bodega}: {saldo}
                  </button>
                );
              })}
            </div>
            <h2 className="mt-2 text-xl font-bold text-foreground tracking-tight">
              {group.descripcion}
            </h2>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className={`px-5 pb-4 grid grid-cols-1 ${group.precioUsd && group.precioUsd > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
          <PriceBlock
            label="Precio Detal (PVP)"
            value={formatCurrency(group.pvp)}
            highlight
          />
          <PriceBlock
            label="Precio Mayorista (PVM) - IVA incluido"
            value={formatCurrency(group.pvm)}
            badge="Mayorista"
          />
          {group.precioUsd !== undefined && group.precioUsd > 0 && (
            <PriceBlock
              label="Precio Dólares (USD)"
              value={formatUsd(group.precioUsd)}
              badge="USD"
            />
          )}
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
                    <div key={v.sku} className="inline-flex items-stretch">
                      <button
                        disabled={!hasStock}
                        onClick={() => copySku(v.sku, v.talla, color)}
                        className={`inline-flex items-center gap-2 border px-3 py-1.5 ${hasStock ? "rounded-l-xl border-r-0" : "rounded-xl"} text-xs font-bold transition-all duration-150 group relative ${badgeColor}`}
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
                      {hasStock && (
                        <button
                          onClick={() => {
                            const result = addOrderItem({
                              sku: v.sku,
                              referencia: group.referencia,
                              descripcion: group.descripcion,
                              talla: v.talla,
                              color,
                              codColor: v.codColor,
                              pvm: group.pvm || v.pvm,
                              saldo: v.saldo,
                            });
                            if (result.success) {
                              if (result.isLimit) {
                                toast.warning(
                                  `Añadido: ${group.referencia} ${color} T${v.talla} (${result.currentQty} uds. - Límite de stock alcanzado)`,
                                  { duration: 2500 }
                                );
                              } else {
                                toast.success(
                                  `Añadido: ${group.referencia} ${color} T${v.talla} (Total: ${result.currentQty} uds.)`,
                                  { duration: 1500 }
                                );
                              }
                            } else {
                              toast.error(
                                `No se pueden añadir más unidades de ${group.referencia} (Talla ${v.talla}). Stock máximo disponible en inventario: ${v.saldo}`,
                                { duration: 3000 }
                              );
                            }
                          }}
                          className="inline-flex items-center rounded-r-xl border border-accent bg-accent px-2 text-accent-foreground transition-colors hover:bg-accent/90"
                          title="Añadir al pedido"
                          aria-label="Añadir al pedido"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Completa el Look Section */}
        {crossSellSuggestions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">✨</span>
              <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                ¡Sugiere al cliente complementar su pedido!
              </h4>
              <div className="flex-1" />
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                Opciones para combinar
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {crossSellSuggestions.map((suggestion) => (
                <div 
                  key={suggestion.referencia}
                  className="flex gap-3 p-3 rounded-xl border border-border bg-card/50 hover:bg-accent/5 hover:border-accent/30 transition-all cursor-pointer group"
                  onClick={() => {
                    // Quick scroll to top or trigger search if needed, but for now we just show details
                    if (onPreviewImage && suggestion.imageUrl) {
                      onPreviewImage({
                        src: suggestion.imageUrl,
                        alt: suggestion.descripcion,
                        description: `Combinación: ${suggestion.descripcion}`,
                        refCode: suggestion.referencia
                      });
                    } else {
                      toast.info(`Busca la referencia ${suggestion.referencia} para ver tallas disponibles.`);
                    }
                  }}
                >
                  <div className="w-16 h-20 shrink-0 bg-muted/30 rounded-lg overflow-hidden relative">
                    {suggestion.imageUrl ? (
                      <img 
                        src={suggestion.imageUrl} 
                        alt={suggestion.referencia}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 bg-accent/5">
                        <Shirt className="h-6 w-6 mb-1" />
                        <span className="text-[9px] font-medium tracking-wider">SIN FOTO</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <div className="text-xs font-bold text-foreground truncate">
                      {suggestion.referencia}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mb-1" title={suggestion.descripcion}>
                      {suggestion.descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-auto">
                      <span className="text-xs font-extrabold text-primary">
                        {formatCurrency(suggestion.pvm)}
                      </span>
                      <span className="text-[10px] bg-accent/10 text-accent-foreground px-1.5 py-0.5 rounded-md font-medium">
                        Stock: {suggestion.totalSaldo}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </article>
  );
}

function PriceBlock({
  label,
  value,
  highlight,
  badge,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: string;
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
        {badge ? (
          <span className="text-[9px] font-extrabold bg-accent/25 text-primary px-1.5 py-0.5 rounded-md uppercase tracking-wider select-none">
            {badge}
          </span>
        ) : (
          !highlight && (
            <span className="text-[9px] font-extrabold bg-accent/25 text-primary px-1.5 py-0.5 rounded-md uppercase tracking-wider select-none animate-pulse-slow">
              Mayorista
            </span>
          )
        )}
      </div>
    </div>
  );
}

function OrderHistory({ onOrderDeleted }: { onOrderDeleted?: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");

  const fetchOrdersList = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          customer_name,
          total_amount,
          created_at,
          order_items (
            cantidad
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      toast.error(`Error al cargar el historial: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdersList();
  }, [fetchOrdersList]);

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar el pedido de "${name}"? Esto liberará las unidades reservadas en el inventario.`
      )
    ) {
      return;
    }

    try {
      toast.loading("Eliminando pedido…", { id: "delete-order" });
      await deleteOrderFromDb(id);
      toast.success("Pedido eliminado y stock liberado.", { id: "delete-order" });
      fetchOrdersList();
      onOrderDeleted?.();
    } catch (err: any) {
      toast.error(`No se pudo eliminar: ${err.message}`, { id: "delete-order" });
    }
  };

  const filteredOrders = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => o.customer_name.toLowerCase().includes(q));
  }, [orders, searchName]);

  if (loading && orders.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent mb-3" />
        <p className="text-sm">Cargando historial de pedidos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search client name */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Buscar pedidos por nombre del cliente..."
          className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-base shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">
          <Clock className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-semibold">No se encontraron pedidos</p>
          <p className="text-xs text-muted-foreground/75 mt-1">
            {searchName ? "Prueba con otro nombre o término." : "Los pedidos guardados aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredOrders.map((o) => {
            const unitsCount =
              o.order_items?.reduce((s: number, i: any) => s + (i.cantidad || 0), 0) || 0;
            return (
              <div
                key={o.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-accent/30 transition-all duration-150"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-foreground truncate">
                      {o.customer_name}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent dark:bg-accent/20">
                      {unitsCount} {unitsCount === 1 ? "unidad" : "unidades"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Pedido: {o.id.substring(0, 8).toUpperCase()}</span>
                    <span>•</span>
                    <span>{formatDateTime(o.created_at)}</span>
                  </div>
                  <p className="text-sm font-extrabold text-primary">
                    Total: {formatCurrency(o.total_amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => downloadSavedOrder(o.id, o.customer_name)}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground shadow-sm transition-transform hover:scale-105"
                  >
                    <Download className="h-4 w-4" />
                    <span>Descargar (.xls)</span>
                  </button>
                  <button
                    onClick={() => handleDelete(o.id, o.customer_name)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Eliminar pedido y liberar stock"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ImageModal({
  image,
  onClose,
}: {
  image: { src: string; alt: string; description: string; refCode: string; shopifyUrl?: string };
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-black/40 p-2.5 text-white/80 hover:bg-black/60 transition-colors hover:text-white"
        aria-label="Cerrar vista"
      >
        <X className="h-6 w-6" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
      >
        {/* Image wrapper */}
        <div className="relative flex-1 overflow-hidden bg-muted/20 flex items-center justify-center">
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-[65vh] w-full object-contain"
          />
        </div>

        {/* Info footer */}
        <div className="bg-card border-t border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground tracking-wide">
                  {image.refCode}
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground leading-tight truncate" title={image.description}>
                {image.description}
              </h3>
            </div>
            {image.shopifyUrl && (
              <a
                href={image.shopifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
              >
                <span>Ver tienda</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

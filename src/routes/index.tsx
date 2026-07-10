import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Upload,
  Clock,
  PackageSearch,
  Tag,
  Boxes,
  FileWarning,
  CheckCircle2,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import {
  formatCurrency,
  formatDateTime,
  groupByReferencia,
  loadInventory,
  parseInventoryCsv,
  saveInventory,
  searchReferences,
  type InventoryRow,
  type ReferenceGroup,
} from "@/lib/inventory";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { rows, updatedAt } = loadInventory();
    setRows(rows);
    setUpdatedAt(updatedAt);
    setHydrated(true);
  }, []);

  const groups = useMemo(() => groupByReferencia(rows), [rows]);
  const results = useMemo(
    () => searchReferences(groups, query),
    [groups, query],
  );

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseInventoryCsv(text);
      if (parsed.length === 0) {
        toast.error("El archivo no contiene referencias válidas.");
        return;
      }
      const savedAt = saveInventory(parsed);
      setRows(parsed);
      setUpdatedAt(savedAt);
      toast.success(
        `Inventario actualizado: ${parsed.length} registros cargados.`,
      );
    } catch {
      toast.error("No se pudo leer el archivo. Verifica que sea un CSV.");
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

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

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onInputChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Cargar inventario
            </button>
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
            placeholder="Buscar por referencia (ej: B01020061)"
            className="w-full rounded-2xl border border-border bg-card py-4 pl-12 pr-4 text-base shadow-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            autoFocus
          />
        </div>

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
                title="Escribe una referencia"
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

          {results.map((group) => (
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
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Card header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-sm font-semibold text-primary-foreground">
            {group.referencia}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" />
            {group.totalSaldo} unidades
          </span>
        </div>
        <h2 className="mt-2 text-xl font-bold text-foreground">
          {group.descripcion}
        </h2>
      </div>

      {/* Prices */}
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
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

      {/* Variants table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-semibold">Talla</th>
              <th className="px-5 py-3 font-semibold">Color</th>
              <th className="px-5 py-3 text-right font-semibold">Saldo</th>
              <th className="px-5 py-3 font-semibold">SKU</th>
            </tr>
          </thead>
          <tbody>
            {group.variantes.map((v, i) => (
              <tr
                key={v.sku || i}
                className="border-b border-border last:border-0"
              >
                <td className="px-5 py-3 font-medium">{v.talla || "—"}</td>
                <td className="px-5 py-3">{v.color || "—"}</td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={
                      v.saldo > 0
                        ? "inline-flex items-center gap-1 font-semibold text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {v.saldo > 0 && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                    )}
                    {v.saldo}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                  {v.sku || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className={highlight ? "bg-accent/10 px-5 py-4" : "bg-card px-5 py-4"}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Tag className="h-3.5 w-3.5" />
        {label}
      </div>
      <div
        className={
          highlight
            ? "mt-1 text-2xl font-bold text-foreground"
            : "mt-1 text-2xl font-bold text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

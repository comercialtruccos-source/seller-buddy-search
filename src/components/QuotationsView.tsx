import React, { useState, useMemo } from "react";
import {
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Clock,
  Search,
  X,
  Trash2,
  Eye,
  Calendar,
  DollarSign,
  Boxes,
  Plus,
  AlertCircle,
  Building,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  useQuotations,
  type SavedQuotation,
  approveQuotation,
  downloadQuotationHgi,
  downloadSavedQuotationPdf,
  downloadSavedQuotationExcel,
  deleteQuotation,
} from "@/lib/quotationsStore";
import { formatCurrency, formatUsd, type InventoryRow } from "@/lib/inventory";
import { QuotationDetailModal } from "./QuotationDetailModal";

interface QuotationsViewProps {
  onGoToCatalog: () => void;
  inventory?: InventoryRow[];
  onOpenCotizador?: () => void;
}

export function QuotationsView({
  onGoToCatalog,
  inventory = [],
  onOpenCotizador,
}: QuotationsViewProps) {
  const quotations = useQuotations();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "pendiente" | "aprobada">("todas");
  const [selectedQuotation, setSelectedQuotation] = useState<SavedQuotation | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Fast inventory lookup
  const inventoryLookup = useMemo(() => {
    const map: Record<string, InventoryRow> = {};
    for (const r of inventory) {
      if (r.sku) map[r.sku] = r;
    }
    return map;
  }, [inventory]);

  // Statistics
  const stats = useMemo(() => {
    const total = quotations.length;
    const pending = quotations.filter((q) => q.status === "pendiente").length;
    const approved = quotations.filter((q) => q.status === "aprobada").length;
    const totalValueCop = quotations
      .filter((q) => q.currency === "COP")
      .reduce((sum, q) => sum + (q.totalAmount || 0), 0);
    return { total, pending, approved, totalValueCop };
  }, [quotations]);

  // Filtering
  const filteredQuotations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return quotations.filter((item) => {
      // Status filter
      if (statusFilter !== "todas" && item.status !== statusFilter) {
        return false;
      }
      // Text search
      if (!q) return true;
      const matchNumber = item.quotationNumber?.toLowerCase().includes(q);
      const matchCustomer = item.customerName?.toLowerCase().includes(q);
      const matchAdvisor = item.advisorName?.toLowerCase().includes(q);
      const matchRefs = item.items?.some(
        (it) =>
          it.referencia?.toLowerCase().includes(q) ||
          it.descripcion?.toLowerCase().includes(q)
      );
      return matchNumber || matchCustomer || matchAdvisor || matchRefs;
    });
  }, [quotations, searchTerm, statusFilter]);

  const handleApprove = async (quote: SavedQuotation) => {
    try {
      setApprovingId(quote.id);
      toast.loading(`Aprobando cotización ${quote.quotationNumber}…`, { id: "approve-card" });
      const { quotation: updated } = await approveQuotation(quote.id, {
        downloadHgi: true,
        registerInOrders: true,
      });
      toast.success(
        `¡Cotización ${updated.quotationNumber} aprobada! Se descargó el archivo HGI (.xls) para subir pedidos.`,
        { id: "approve-card", duration: 5000 }
      );
    } catch (err: any) {
      console.error("Error approving quotation:", err);
      toast.error(`No se pudo aprobar: ${err?.message || "error desconocido"}`, {
        id: "approve-card",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleDownloadHgi = (quote: SavedQuotation) => {
    try {
      downloadQuotationHgi(quote);
      toast.success("Archivo de pedidos HGI (.xls) descargado con éxito.", { duration: 3500 });
    } catch (err: any) {
      console.error("Error downloading HGI:", err);
      toast.error(`Error al generar HGI: ${err?.message || "error desconocido"}`);
    }
  };

  const handleDownloadPdf = (quote: SavedQuotation) => {
    try {
      downloadSavedQuotationPdf(quote, inventoryLookup);
      toast.success("Archivo PDF descargado con éxito.");
    } catch (err: any) {
      console.error("Error downloading PDF:", err);
      toast.error("No se pudo generar el PDF.");
    }
  };

  const handleDownloadExcel = (quote: SavedQuotation) => {
    try {
      downloadSavedQuotationExcel(quote, inventoryLookup);
      toast.success("Archivo Excel descargado con éxito.");
    } catch (err: any) {
      console.error("Error downloading Excel:", err);
      toast.error("No se pudo generar el Excel.");
    }
  };

  const handleDelete = async (quote: SavedQuotation) => {
    if (confirm(`¿Estás seguro de eliminar la cotización ${quote.quotationNumber} de ${quote.customerName}?`)) {
      try {
        await deleteQuotation(quote.id);
        toast.success("Cotización eliminada del sistema.");
      } catch (err: any) {
        toast.error(`Error al eliminar: ${err?.message || "error desconocido"}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Total Cotizaciones</span>
            <FileText className="h-4 w-4" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{stats.total}</p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <span>Pendientes</span>
            <Clock className="h-4 w-4" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-2">
            {stats.pending}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Aprobadas (HGI)</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
            {stats.approved}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Total Cotizado (COP)</span>
            <DollarSign className="h-4 w-4" />
          </div>
          <p className="text-lg sm:text-xl font-black text-foreground mt-2 truncate">
            {formatCurrency(stats.totalValueCop)}
          </p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, folio (COT-...), asesor o referencia..."
            className="w-full rounded-2xl border border-border bg-card py-3 pl-11 pr-10 text-sm shadow-xs outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-lg"
              title="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl border border-border bg-card self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("todas")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "todas"
                ? "bg-foreground text-background shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pendiente")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "pendiente"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pendientes ({stats.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("aprobada")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "aprobada"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aprobadas ({stats.approved})
          </button>
        </div>
      </div>

      {/* Quotations List */}
      {filteredQuotations.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {searchTerm || statusFilter !== "todas"
              ? "No se encontraron cotizaciones"
              : "No hay cotizaciones guardadas aún"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {searchTerm || statusFilter !== "todas"
              ? "Prueba cambiando el término de búsqueda o el filtro de estado."
              : "Crea una cotización desde el catálogo o tu pedido para guardarla en el sistema y exportarla a HGI cuando sea aprobada."}
          </p>
          {!searchTerm && statusFilter === "todas" && (
            <button
              type="button"
              onClick={onGoToCatalog}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground shadow-sm hover:scale-105 active:scale-95 transition-all"
            >
              <Boxes className="h-4 w-4" />
              <span>Explorar Catálogo e Iniciar Cotización</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredQuotations.map((quote) => {
            const isApproved = quote.status === "aprobada";
            const isUsd = quote.currency === "USD";
            const formatMoney = (val: number) => (isUsd ? formatUsd(val) : formatCurrency(val));

            return (
              <div
                key={quote.id}
                className="group relative rounded-2xl border border-border bg-card p-5 shadow-xs hover:border-accent/40 hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Identifiers, Client & Status */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black tracking-wide text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-lg">
                        {quote.quotationNumber}
                      </span>

                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Aprobada para HGI
                        </span>
                      ) : quote.status === "rechazada" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                          <AlertCircle className="h-3 w-3" />
                          Rechazada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <Clock className="h-3 w-3" />
                          Pendiente de Aprobación
                        </span>
                      )}

                      <span className="text-xs text-muted-foreground">
                        {new Date(quote.createdAt).toLocaleDateString("es-CO", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-foreground truncate">
                        {quote.customerName}
                      </h4>
                      {quote.advisorName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Asesor: <strong className="text-foreground">{quote.advisorName}</strong>
                        </p>
                      )}
                    </div>

                    {/* Previews and badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <Boxes className="h-3 w-3" />
                        {quote.totalUnits} prendas · {quote.totalReferences} refs
                      </span>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {quote.currency}
                      </span>
                      {quote.tierBadge && (
                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 text-[11px] font-bold">
                          {quote.tierBadge}
                        </span>
                      )}
                    </div>

                    {/* Items snippet */}
                    {quote.items && quote.items.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
                        <span className="font-semibold text-foreground">Prendas:</span>
                        {quote.items.slice(0, 3).map((it, idx) => (
                          <span
                            key={idx}
                            className="bg-muted/50 rounded px-1.5 py-0.5 text-[10px] font-mono"
                          >
                            {it.referencia} ({it.cantidad}u)
                          </span>
                        ))}
                        {quote.items.length > 3 && (
                          <span className="text-[10px] text-muted-foreground italic">
                            +{quote.items.length - 3} más...
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Totals */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 border-border pt-3 lg:pt-0">
                    <div className="text-left lg:text-right space-y-0.5">
                      <div className="text-[11px] text-muted-foreground">
                        Sin IVA: {formatMoney(quote.subtotalSinIva)} · IVA 19%:{" "}
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">
                          {formatMoney(quote.totalIva)}
                        </span>
                      </div>
                      <div className="text-lg lg:text-xl font-black text-foreground">
                        {formatMoney(quote.totalAmount)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Total Cotización ({quote.currency})
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 border-t lg:border-t-0 border-border pt-3 lg:pt-0">
                    {/* Primary HGI Approval/Download Action */}
                    {isApproved ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadHgi(quote)}
                        className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs active:scale-95 transition-all"
                        title="Descargar archivo en formato HGI (.xls) para subir pedidos"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Descargar HGI (.xls)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApprove(quote)}
                        disabled={approvingId === quote.id}
                        className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50"
                        title="Aprobar cotización y descargar archivo en formato HGI"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{approvingId === quote.id ? "Aprobando…" : "Aprobar y HGI"}</span>
                      </button>
                    )}

                    {/* Quick Downloads */}
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(quote)}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-xl border border-border bg-card hover:bg-muted transition-colors"
                      title="Descargar PDF formal de la cotización"
                    >
                      <FileText className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadExcel(quote)}
                      className="p-2 text-emerald-600 hover:text-emerald-700 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
                      title="Descargar Excel formal de la cotización (.xlsx)"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </button>

                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setSelectedQuotation(quote)}
                      className="p-2 text-muted-foreground hover:text-foreground rounded-xl border border-border bg-card hover:bg-muted transition-colors"
                      title="Ver detalle completo de la cotización"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(quote)}
                      className="p-2 text-muted-foreground hover:text-destructive rounded-xl border border-border hover:bg-destructive/10 transition-colors"
                      title="Eliminar cotización"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedQuotation && (
        <QuotationDetailModal
          quotation={selectedQuotation}
          open={!!selectedQuotation}
          onClose={() => setSelectedQuotation(null)}
          inventoryLookup={inventoryLookup}
          onOpenCotizador={onOpenCotizador}
        />
      )}
    </div>
  );
}

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  Trash2,
  Plus,
  Minus,
  DollarSign,
  Calculator,
  User,
  Building,
  Sparkles,
  Info,
  CheckCircle2,
  Boxes,
  MessageSquareText,
  Save,
  Download,
  Clock,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  type QuotationCurrency,
  type CopPriceType,
  buildQuotationData,
  downloadQuotationExcel,
  downloadQuotationPdf,
  openQuotationPrintView,
} from "@/lib/quotation";
import {
  saveQuotation,
  approveQuotation,
  downloadQuotationHgi,
} from "@/lib/quotationsStore";
import {
  useOrder,
  setOrderQty,
  removeOrderItem,
  clearOrder,
  type OrderItem,
} from "@/lib/order";
import {
  formatCurrency,
  formatUsd,
  type InventoryRow,
  exportQuotationUbicacionesBodega1001,
  exportQuotationUbicacionesBodega1001Csv,
} from "@/lib/inventory";

interface CotizadorModalProps {
  open: boolean;
  onClose: () => void;
  inventory?: InventoryRow[];
  initialCustomerName?: string;
}

export function CotizadorModal({
  open,
  onClose,
  inventory = [],
  initialCustomerName = "",
}: CotizadorModalProps) {
  const order = useOrder();

  // Currency & calculation state
  const [currency, setCurrency] = useState<QuotationCurrency>("COP");
  const [copPriceType, setCopPriceType] = useState<CopPriceType>("PVM");

  // Metadata state
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [advisorName, setAdvisorName] = useState("");
  const [notes, setNotes] = useState(
    "Cotización válida por 15 días calendario. Sujeta a disponibilidad de inventario físico."
  );
  const [savedQuotationId, setSavedQuotationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialCustomerName) {
      setCustomerName(initialCustomerName);
    }
  }, [initialCustomerName, open]);

  // Fast lookup dictionary for inventory rows
  const inventoryLookup = useMemo(() => {
    const map: Record<string, InventoryRow> = {};
    for (const row of inventory) {
      if (row.sku) {
        map[row.sku] = row;
      }
    }
    return map;
  }, [inventory]);

  // Real-time calculation of quotation data
  const quotation = useMemo(() => {
    return buildQuotationData(
      order,
      {
        currency,
        copPriceType,
        customerName,
        advisorName,
        notes,
      },
      inventoryLookup
    );
  }, [order, currency, copPriceType, customerName, advisorName, notes, inventoryLookup]);

  if (!open) return null;

  const handleSaveQuotation = async () => {
    if (quotation.items.length === 0) {
      toast.error("Debes seleccionar al menos una prenda para guardar la cotización.");
      return;
    }
    try {
      setIsSaving(true);
      const saved = await saveQuotation(quotation, "pendiente");
      setSavedQuotationId(saved.id);
      toast.success(
        `¡Cotización ${saved.quotationNumber} guardada en el sistema como Pendiente!`,
        { duration: 4000 }
      );
      return saved;
    } catch (err: any) {
      console.error("Error saving quotation:", err);
      toast.error(`Error al guardar cotización: ${err?.message || "error desconocido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndDownloadHgi = async () => {
    if (quotation.items.length === 0) {
      toast.error("Debes seleccionar al menos una prenda para aprobar la cotización.");
      return;
    }
    try {
      setIsSaving(true);
      toast.loading("Guardando cotización, aprobando y generando archivo HGI…", {
        id: "modal-approve-hgi",
      });
      const saved = await saveQuotation(quotation, "pendiente");
      const { quotation: approved } = await approveQuotation(saved.id, {
        downloadHgi: true,
        registerInOrders: true,
      });
      setSavedQuotationId(approved.id);
      toast.success(
        `¡Cotización ${approved.quotationNumber} aprobada! Se descargó el archivo HGI (.xls) para subir pedidos.`,
        { id: "modal-approve-hgi", duration: 5500 }
      );
    } catch (err: any) {
      console.error("Error approving quotation in modal:", err);
      toast.error(`Error al aprobar cotización: ${err?.message || "error desconocido"}`, {
        id: "modal-approve-hgi",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (quotation.items.length === 0) {
      toast.error("Debes seleccionar al menos una prenda para generar la cotización.");
      return;
    }
    // Auto-save so the quotation is never lost
    try {
      const saved = await saveQuotation(quotation, "pendiente");
      setSavedQuotationId(saved.id);
    } catch (err) {
      console.warn("Auto-save quotation notice:", err);
    }
    try {
      downloadQuotationPdf(quotation);
      toast.success("Archivo PDF descargado y cotización guardada en el sistema.", {
        duration: 3500,
      });
    } catch (err: any) {
      console.error("Error generating PDF:", err);
      toast.error(`No se pudo generar el PDF: ${err?.message || "error desconocido"}. Intenta con Imprimir o Excel.`);
    }
  };

  const handleDownloadExcel = async () => {
    if (quotation.items.length === 0) {
      toast.error("Debes seleccionar al menos una prenda para generar la cotización.");
      return;
    }
    // Auto-save so the quotation is never lost
    try {
      const saved = await saveQuotation(quotation, "pendiente");
      setSavedQuotationId(saved.id);
    } catch (err) {
      console.warn("Auto-save quotation notice:", err);
    }
    try {
      downloadQuotationExcel(quotation);
      toast.success("Archivo Excel descargado y cotización guardada en el sistema.", {
        duration: 3500,
      });
    } catch (err: any) {
      console.error("Error generating Excel:", err);
      toast.error("Error al exportar a Excel.");
    }
  };

  const handleExportUbicaciones1001 = (format: "xlsx" | "csv" = "xlsx") => {
    if (quotation.items.length === 0) {
      toast.error("Debes seleccionar al menos una prenda en la cotización.");
      return;
    }
    try {
      const options = {
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customerName,
        advisorName: quotation.advisorName,
        inventory: inventoryLookup,
      };
      if (format === "xlsx") {
        exportQuotationUbicacionesBodega1001(quotation.items, options);
        toast.success(`Ubicaciones de ${quotation.totalReferences} referencias cotizadas exportadas en Excel (.xlsx)`);
      } else {
        exportQuotationUbicacionesBodega1001Csv(quotation.items, options);
        toast.success(`Ubicaciones de ${quotation.totalReferences} referencias cotizadas exportadas en CSV`);
      }
    } catch (err: any) {
      console.error("Error exporting quotation locations:", err);
      toast.error(err?.message || "Error al exportar ubicaciones de la cotización.");
    }
  };

  const handlePrint = () => {
    if (quotation.items.length === 0) {
      toast.error("Debes seleccionar al menos una prenda para generar la cotización.");
      return;
    }
    openQuotationPrintView(quotation);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-card border border-border shadow-2xl sm:rounded-2xl sm:max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-neutral-950 via-neutral-900 to-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700/30 border border-slate-600/40 text-slate-200">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Cotizador Comercial</h2>
                <span className="font-mono text-xs font-bold bg-white/10 border border-white/20 px-2 py-0.5 rounded text-white">
                  {quotation.quotationNumber}
                </span>
                {savedQuotationId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Guardada en Sistema
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
                    <Clock className="h-2.5 w-2.5" />
                    Borrador
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Selecciona prendas y cotiza en Pesos Colombianos (COP) o Dólares (USD)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar Cotizador"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* STEP 1: Currency Selection Prompt */}
          <div className="rounded-2xl border-2 border-slate-300/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                  1. ¿En qué moneda deseas la cotización?
                </h3>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Los precios se multiplican automáticamente por las unidades
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option: Pesos Colombianos (COP) */}
              <div
                onClick={() => setCurrency("COP")}
                className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all flex flex-col justify-between ${
                  currency === "COP"
                    ? "border-slate-800 dark:border-slate-200 bg-card shadow-md ring-2 ring-slate-400/20"
                    : "border-border bg-card/60 hover:border-slate-400/50 hover:bg-card"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇨🇴</span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Pesos Colombianos (COP)</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Precios oficiales en moneda local colombiana
                      </p>
                    </div>
                  </div>
                  {currency === "COP" && (
                    <CheckCircle2 className="h-5 w-5 text-slate-800 dark:text-slate-200 shrink-0" />
                  )}
                </div>

                {currency === "COP" && (
                  <div className="mt-3 pt-2.5 border-t border-border flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      Escala aplicada:
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide ${
                      quotation.tierInfo.tier === "detal"
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25"
                        : quotation.tierInfo.tier === "descuento_30"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                        : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    }`}>
                      {quotation.tierInfo.label} ({quotation.tierInfo.badge})
                    </span>
                  </div>
                )}
              </div>

              {/* Option: Dólares Americanos (USD) */}
              <div
                onClick={() => setCurrency("USD")}
                className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all flex flex-col justify-between ${
                  currency === "USD"
                    ? "border-slate-800 dark:border-slate-200 bg-card shadow-md ring-2 ring-slate-400/20"
                    : "border-border bg-card/60 hover:border-slate-400/50 hover:bg-card"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇺🇸</span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Dólares Americanos (USD)</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Precio USD internacional configurado en la plataforma
                      </p>
                    </div>
                  </div>
                  {currency === "USD" && (
                    <CheckCircle2 className="h-5 w-5 text-slate-800 dark:text-slate-200 shrink-0" />
                  )}
                </div>

                {currency === "USD" && (
                  <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      ✓ Precios en dólares asignados a cada prenda
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      USD ($) · Tarifa fija sin descuentos
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Commercial Volume Scale Banner */}
          {currency === "COP" && quotation.items.length > 0 && (
            <div className={`rounded-2xl border p-4 transition-colors ${
              quotation.tierInfo.tier === "detal"
                ? "bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-200"
                : quotation.tierInfo.tier === "descuento_30"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-200"
                : "bg-primary/10 border-primary/20 text-primary"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide ${
                    quotation.tierInfo.tier === "detal"
                      ? "bg-amber-500/20 text-amber-900 dark:text-amber-300"
                      : quotation.tierInfo.tier === "descuento_30"
                      ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : "bg-primary/20 text-primary"
                  }`}>
                    {quotation.tierInfo.badge}
                  </span>
                  <span className="text-xs font-semibold">
                    {quotation.tierInfo.tier === "detal" && "Escala Detal (Menos de 12 uds: sin descuento)"}
                    {quotation.tierInfo.tier === "descuento_30" && "30% Descuento Detal aplicado (12 a 23 unidades)"}
                    {quotation.tierInfo.tier === "mayorista" && "Tarifa Mayorista Plena activada (24 o más unidades)"}
                  </span>
                </div>
                <span className="text-xs font-bold whitespace-nowrap">
                  {quotation.totalUnits} uds totales
                </span>
              </div>

              {quotation.tierInfo.nextTierPrompt && (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-foreground/90">
                    💡 {quotation.tierInfo.nextTierPrompt}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className={`h-full transition-all duration-300 ${
                        quotation.tierInfo.tier === "detal" ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${quotation.tierInfo.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Optional Client & Advisor Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                Nombre del Cliente o Empresa
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej. Boutique Bella Moda / María Pérez"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nombre del Asesor Comercial
              </label>
              <input
                type="text"
                value={advisorName}
                onChange={(e) => setAdvisorName(e.target.value)}
                placeholder="Ej. Asesor de Ventas Trucco's"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-semibold outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* STEP 3: Observaciones y Comentarios de la Cotización */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                Observaciones y Comentarios de la Cotización
              </label>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Se incluirán en el PDF, Excel y vista de impresión
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej: Cotización válida por 15 días calendario. Sujeta a disponibilidad de inventario físico en bodega. Entrega en 3 días hábiles."
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-medium text-foreground outline-none focus:border-accent resize-none placeholder:text-muted-foreground/60 transition-colors"
            />
          </div>

          {/* STEP 4: Garments List & Calculation Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-primary" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                  Prendas Seleccionadas para la Cotización ({quotation.items.length})
                </h3>
              </div>
              {quotation.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("¿Deseas vaciar todas las prendas de la cotización?")) {
                      clearOrder();
                    }
                  }}
                  className="text-xs text-destructive hover:underline font-semibold flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Vaciar lista
                </button>
              )}
            </div>

            {quotation.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-12 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                  <Boxes className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">No has seleccionado prendas aún</h4>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Para cotizar, regresa al catálogo y agrega las prendas haciendo clic en las tallas disponibles de cada referencia.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Ir al catálogo a seleccionar prendas
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="py-2.5 px-3">Ref / Prenda</th>
                        <th className="py-2.5 px-3">Color / Talla</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">
                          {quotation.basePriceColumnLabel}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          Precio Sin IVA
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          Valor IVA (19%)
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          P. Unit. IVA Incluido
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          Total ({currency})
                        </th>
                        <th className="py-2.5 px-3 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {quotation.items.map((it) => (
                        <tr key={it.sku} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-foreground bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {it.referencia}
                              </span>
                              <span className="font-medium text-foreground truncate max-w-[160px]" title={it.descripcion}>
                                {it.descripcion}
                              </span>
                            </div>
                            {it.ubicacion && it.ubicacion !== "SIN UBICACIÓN" && (
                              <div className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center gap-1 font-mono">
                                <span className="font-semibold text-primary">📍 Ubic. 1001:</span>
                                <span className="font-bold text-foreground">{it.ubicacion}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            <span className="capitalize">{it.color}</span> · Talla {it.talla}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setOrderQty(it.sku, it.cantidad - 1)}
                                className="h-6 w-6 rounded border border-border bg-background flex items-center justify-center hover:bg-muted text-muted-foreground"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-7 text-center font-bold text-foreground text-xs">
                                {it.cantidad}
                              </span>
                              <button
                                type="button"
                                onClick={() => setOrderQty(it.sku, it.cantidad + 1)}
                                className="h-6 w-6 rounded border border-border bg-background flex items-center justify-center hover:bg-muted text-muted-foreground"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-muted-foreground">
                            {it.formattedPrecioBaseCatalogo}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-foreground">
                            {it.formattedPrecioSinIva}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-sky-600 dark:text-sky-400">
                            {it.formattedValorIva}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                            {currency === "COP" && it.unitDiscount && it.unitDiscount > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] line-through text-muted-foreground">
                                  {formatCurrency(it.basePvp || 0)}
                                </span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {it.formattedPrecioUnitConIva}
                                </span>
                              </div>
                            ) : (
                              it.formattedPrecioUnitConIva
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            {it.formattedTotalPrice}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeOrderItem(it.sku)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                              title="Quitar prenda"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subtotal & Summary footer of the table */}
                <div className="bg-muted/40 p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      Total: <strong>{quotation.totalUnits}</strong> prendas de{" "}
                      <strong>{quotation.totalReferences}</strong> referencias
                    </div>
                    {currency === "COP" && quotation.totalDiscount > 0 && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Ahorro total aplicado ({quotation.tierInfo.badge}): -{quotation.formattedTotalDiscount}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 text-right">
                    <div className="text-xs text-muted-foreground">
                      <span>{quotation.isMayorista ? "Subtotal Mayorista: " : "Subtotal Detal: "}</span>
                      <span className="font-semibold text-foreground">{quotation.formattedSubtotalCatalogo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>Subtotal Sin IVA: </span>
                      <span className="font-semibold text-foreground">{quotation.formattedSubtotalSinIva}</span>
                    </div>
                    <div className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-1 rounded border border-sky-200 dark:border-sky-800">
                      <span>Total IVA (19%): </span>
                      <span>{quotation.formattedTotalIva}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Total Cotización ({currency}):
                      </span>
                      <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                        {quotation.formattedTotalWithIva}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border bg-muted/20 px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground border border-border rounded-xl bg-card transition-colors"
            >
              Seguir seleccionando
            </button>

            <button
              type="button"
              onClick={handleSaveQuotation}
              disabled={quotation.items.length === 0 || isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary transition-colors disabled:opacity-40"
              title="Guardar esta cotización en el sistema"
            >
              <Save className="h-4 w-4" />
              <span>{savedQuotationId ? "Actualizar en Sistema" : "Guardar Cotización"}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={quotation.items.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              title="Vista previa e impresión"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Imprimir</span>
            </button>

            <div className="inline-flex rounded-xl shadow-xs overflow-hidden border border-primary/30 bg-primary/5 text-primary">
              <button
                type="button"
                onClick={() => handleExportUbicaciones1001("xlsx")}
                disabled={quotation.items.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40"
                title="Exportar archivo Excel (.xlsx) con las referencias cotizadas y su ubicación en Bodega 1001"
              >
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Ubicaciones 1001</span>
                <span className="sm:hidden">Ubicaciones</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportUbicaciones1001("csv")}
                disabled={quotation.items.length === 0}
                className="inline-flex items-center px-2 py-2.5 text-xs font-bold border-l border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40"
                title="Exportar en formato CSV"
              >
                .CSV
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={quotation.items.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all shadow-xs disabled:opacity-40"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={quotation.items.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all shadow-xs disabled:opacity-40"
            >
              <FileText className="h-4 w-4" />
              <span>PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleApproveAndDownloadHgi}
              disabled={quotation.items.length === 0 || isSaving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-md active:scale-95 transition-all disabled:opacity-40"
              title="Aprobar directamente la cotización y descargar el archivo HGI para pedidos"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Aprobar y Pedido HGI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

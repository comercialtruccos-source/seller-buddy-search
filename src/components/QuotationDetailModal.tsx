import React, { useState } from "react";
import {
  X,
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  User,
  Building,
  Calendar,
  AlertCircle,
  ShoppingCart,
  Boxes,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  type SavedQuotation,
  approveQuotation,
  downloadQuotationHgi,
  downloadSavedQuotationPdf,
  downloadSavedQuotationExcel,
  downloadQuotationUbicaciones,
} from "@/lib/quotationsStore";
import { formatCurrency, formatUsd, type InventoryRow } from "@/lib/inventory";
import { addOrderItem, clearOrder } from "@/lib/order";

interface QuotationDetailModalProps {
  quotation: SavedQuotation | null;
  open: boolean;
  onClose: () => void;
  inventoryLookup?: Record<string, InventoryRow>;
  onOpenCotizador?: () => void;
}

export function QuotationDetailModal({
  quotation,
  open,
  onClose,
  inventoryLookup = {},
  onOpenCotizador,
}: QuotationDetailModalProps) {
  const [isApproving, setIsApproving] = useState(false);

  if (!open || !quotation) return null;

  const isUsd = quotation.currency === "USD";
  const formatMoney = (val: number) => (isUsd ? formatUsd(val) : formatCurrency(val));

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      toast.loading("Aprobando cotización y generando archivo HGI…", { id: "approve-quote" });
      const { quotation: updated } = await approveQuotation(quotation.id, {
        downloadHgi: true,
        registerInOrders: true,
      });
      toast.success(
        `¡Cotización ${updated.quotationNumber} aprobada! Se descargó el archivo HGI (.xls) para cargar en el sistema.`,
        { id: "approve-quote", duration: 5000 }
      );
    } catch (err: any) {
      console.error("Error approving quotation:", err);
      toast.error(`No se pudo aprobar: ${err?.message || "error desconocido"}`, {
        id: "approve-quote",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDownloadHgi = () => {
    try {
      downloadQuotationHgi(quotation);
      toast.success("Archivo de pedidos HGI (.xls) descargado con éxito.", { duration: 3500 });
    } catch (err: any) {
      console.error("Error downloading HGI file:", err);
      toast.error(`Error al descargar formato HGI: ${err?.message || "error desconocido"}`);
    }
  };

  const handleDownloadPdf = () => {
    try {
      downloadSavedQuotationPdf(quotation, inventoryLookup);
      toast.success("Archivo PDF de la cotización descargado con éxito.");
    } catch (err: any) {
      console.error("Error downloading PDF:", err);
      toast.error(`Error al generar PDF: ${err?.message || "error desconocido"}`);
    }
  };

  const handleDownloadExcel = () => {
    try {
      downloadSavedQuotationExcel(quotation, inventoryLookup);
      toast.success("Archivo Excel de la cotización descargado con éxito.");
    } catch (err: any) {
      console.error("Error downloading Excel:", err);
      toast.error(`Error al generar Excel: ${err?.message || "error desconocido"}`);
    }
  };

  const handleDownloadUbicaciones = () => {
    try {
      downloadQuotationUbicaciones(quotation, inventoryLookup, "xlsx");
      toast.success(
        `Ubicaciones de Bodega 1001 para la cotización ${quotation.quotationNumber} descargadas en Excel (.xlsx)`,
        { duration: 4000 }
      );
    } catch (err: any) {
      console.error("Error downloading quotation locations:", err);
      toast.error(err?.message || "Error al descargar ubicaciones de la cotización.");
    }
  };

  const handleLoadIntoActiveOrder = () => {
    if (confirm("¿Deseas reemplazar el pedido actual con las prendas de esta cotización?")) {
      clearOrder();
      for (const it of quotation.items) {
        addOrderItem(
          {
            sku: it.sku,
            referencia: it.referencia,
            descripcion: it.descripcion,
            talla: it.talla,
            color: it.color,
            codColor: it.codColor,
            pvm: it.precioMayorista || it.unitPrice,
            pvp: it.precioDetal || it.unitPrice,
            saldo: 99999,
          },
          it.cantidad
        );
      }
      toast.success("Prendas cargadas en tu pedido actual.");
      onClose();
      onOpenCotizador?.();
    }
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
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">{quotation.quotationNumber}</h2>
                {quotation.status === "aprobada" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 className="h-3 w-3" />
                    Aprobada para HGI
                  </span>
                ) : quotation.status === "rechazada" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-300 border border-rose-500/40">
                    <AlertCircle className="h-3 w-3" />
                    Rechazada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/40">
                    <Clock className="h-3 w-3" />
                    Pendiente de Aprobación
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {quotation.customerName} · {new Date(quotation.createdAt).toLocaleString("es-CO")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Cliente
              </span>
              <p className="text-sm font-bold text-foreground truncate">{quotation.customerName}</p>
              {quotation.advisorName && (
                <p className="text-xs text-muted-foreground">Asesor: {quotation.advisorName}</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" /> Condiciones Comerciales
              </span>
              <p className="text-sm font-bold text-foreground">
                {quotation.currency} · {quotation.tierBadge || "Tarifa Estándar"}
              </p>
              <p className="text-xs text-muted-foreground">
                {quotation.totalUnits} prendas · {quotation.totalReferences} referencias
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Fechas y Estado
              </span>
              <p className="text-xs text-foreground font-semibold">
                Creada: {new Date(quotation.createdAt).toLocaleDateString("es-CO")}
              </p>
              {quotation.approvedAt && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Aprobada: {new Date(quotation.approvedAt).toLocaleDateString("es-CO")}
                </p>
              )}
            </div>
          </div>

          {quotation.notes && (
            <div className="rounded-xl border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Notas comerciales: </strong>
              {quotation.notes}
            </div>
          )}

          {/* Table of items */}
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">REF</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3">Color</th>
                    <th className="py-2.5 px-3 text-center">Talla</th>
                    <th className="py-2.5 px-3 text-center">Cant</th>
                    <th className="py-2.5 px-3 text-right">P. Unit C/IVA</th>
                    <th className="py-2.5 px-3 text-right">P. Sin IVA</th>
                    <th className="py-2.5 px-3 text-right">Valor IVA</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotation.items.map((it, idx) => (
                    <tr key={`${it.sku}-${idx}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-foreground">{it.referencia}</td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[180px]">
                        <span className="truncate block">{it.descripcion}</span>
                        {it.ubicacion && it.ubicacion !== "SIN UBICACIÓN" && (
                          <span className="text-[10px] font-mono font-bold text-primary block mt-0.5">
                            📍 Ubic. 1001: {it.ubicacion}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{it.color} {it.codColor ? `(${it.codColor})` : ""}</td>
                      <td className="py-2 px-3 text-center font-bold text-foreground">{it.talla}</td>
                      <td className="py-2 px-3 text-center font-bold text-foreground">{it.cantidad}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{formatMoney(it.unitPrice)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{formatMoney(it.precioSinIva)}</td>
                      <td className="py-2 px-3 text-right text-sky-600 dark:text-sky-400 font-medium">{formatMoney(it.valorIva)}</td>
                      <td className="py-2 px-3 text-right font-bold text-foreground">{formatMoney(it.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Footer */}
            <div className="bg-muted/40 p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Total prendas: <strong>{quotation.totalUnits}</strong> · Referencias:{" "}
                <strong>{quotation.totalReferences}</strong>
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 sm:gap-5 text-right">
                <div className="text-xs text-muted-foreground">
                  <span>Subtotal Sin IVA: </span>
                  <span className="font-semibold text-foreground">{formatMoney(quotation.subtotalSinIva)}</span>
                </div>
                <div className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded border border-sky-200 dark:border-sky-800">
                  <span>Total IVA (19%): </span>
                  <span>{formatMoney(quotation.totalIva)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Total Cotización:
                  </span>
                  <span className="text-lg font-black text-foreground">
                    {formatMoney(quotation.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border bg-muted/20 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleLoadIntoActiveOrder}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              title="Cargar prendas en el pedido actual"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Cargar en Pedido</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadUbicaciones}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary transition-all shadow-xs"
              title="Descargar archivo Excel con las referencias de esta cotización y su ubicación física en Bodega 1001 (.xlsx)"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Ubicaciones Bodega 1001</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span>PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>

            {quotation.status === "aprobada" ? (
              <button
                type="button"
                onClick={handleDownloadHgi}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>Descargar Pedido HGI (.xls)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isApproving ? "Aprobando…" : "Aprobar y Descargar HGI (.xls)"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

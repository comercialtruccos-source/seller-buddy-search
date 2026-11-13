import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  type QuotationCurrency,
  type CopPriceType,
  type QuotationData,
  buildQuotationData,
  downloadQuotationPdf,
  downloadQuotationExcel,
} from "./quotation";
import { downloadOrderXls, saveOrderToDb, type OrderItem } from "./order";
import {
  type InventoryRow,
  exportQuotationUbicacionesBodega1001,
  exportQuotationUbicacionesBodega1001Csv,
} from "./inventory";

export type QuotationStatus = "pendiente" | "aprobada" | "rechazada";

export interface SavedQuotationItem {
  sku: string;
  referencia: string;
  descripcion: string;
  color: string;
  codColor: string;
  talla: string;
  cantidad: number;
  ubicacion?: string;
  unitPrice: number;
  precioDetal: number;
  precioMayorista: number;
  precioBaseCatalogo: number;
  precioSinIva: number;
  valorIva: number;
  totalPrice: number;
  precioUsd?: number;
}

export interface SavedQuotation {
  id: string;
  quotationNumber: string;
  customerName: string;
  advisorName: string;
  notes: string;
  currency: QuotationCurrency;
  copPriceType: CopPriceType;
  totalUnits: number;
  totalReferences: number;
  subtotalCatalogo: number;
  subtotalSinIva: number;
  totalIva: number;
  totalAmount: number;
  totalDiscount: number;
  tierBadge: string;
  status: QuotationStatus;
  items: SavedQuotationItem[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  orderId?: string | null;
}

const STORAGE_KEY = "truccos_quotations_v1";

let quotations: SavedQuotation[] = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): SavedQuotation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error loading quotations from storage:", err);
    return [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(quotations));
  } catch (err) {
    console.error("Error saving quotations to storage:", err);
  }
}

function emit() {
  persist();
  for (const l of listeners) {
    try {
      l();
    } catch (e) {
      console.error("Error in quotation listener:", e);
    }
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useQuotations(): SavedQuotation[] {
  return useSyncExternalStore(
    subscribe,
    () => quotations,
    () => quotations
  );
}

export function useHydrateQuotations() {
  useEffect(() => {
    quotations = loadFromStorage();
    emit();
    // Background sync with Supabase
    syncQuotationsWithSupabase().catch((err) => {
      console.warn("[QuotationsStore] Supabase sync notice:", err?.message || err);
    });
  }, []);
}

/** Syncs quotations between local storage and Supabase quotations table if available. */
export async function syncQuotationsWithSupabase(): Promise<void> {
  try {
    const { data, error } = await (supabase as any)
      .from("quotations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Table may not exist yet or offline, ignore gracefully
      return;
    }

    if (Array.isArray(data) && data.length > 0) {
      const remoteMap = new Map<string, SavedQuotation>();
      for (const row of data) {
        remoteMap.set(row.id, {
          id: row.id,
          quotationNumber: row.quotation_number || `COT-${row.id.substring(0, 8).toUpperCase()}`,
          customerName: row.customer_name || "Cliente Comercial",
          advisorName: row.advisor_name || "",
          notes: row.notes || "",
          currency: (row.currency as QuotationCurrency) || "COP",
          copPriceType: (row.cop_price_type as CopPriceType) || "PVM",
          totalUnits: Number(row.total_units) || 0,
          totalReferences: Number(row.total_references) || 0,
          subtotalCatalogo: Number(row.subtotal_catalogo) || 0,
          subtotalSinIva: Number(row.subtotal_sin_iva) || 0,
          totalIva: Number(row.total_iva) || 0,
          totalAmount: Number(row.total_amount) || 0,
          totalDiscount: Number(row.total_discount) || 0,
          tierBadge: row.tier_badge || "",
          status: (row.status as QuotationStatus) || "pendiente",
          items: Array.isArray(row.items) ? row.items : [],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
          approvedAt: row.approved_at,
          approvedBy: row.approved_by,
          orderId: row.order_id,
        });
      }

      // Merge: Keep newer records
      const merged: SavedQuotation[] = [...remoteMap.values()];
      for (const local of quotations) {
        if (!remoteMap.has(local.id)) {
          merged.push(local);
        }
      }

      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      quotations = merged;
      emit();
    }
  } catch (err) {
    // Non-blocking sync error
    console.warn("[QuotationsStore] Sync warning:", err);
  }
}

/** Converts QuotationItemSummary to SavedQuotationItem */
function mapQuotationItems(items: QuotationData["items"]): SavedQuotationItem[] {
  return items.map((it) => ({
    sku: it.sku,
    referencia: it.referencia,
    descripcion: it.descripcion,
    color: it.color,
    codColor: it.codColor || "",
    talla: it.talla,
    cantidad: it.cantidad,
    ubicacion: it.ubicacion || "",
    unitPrice: it.precioUnitConIva,
    precioDetal: it.precioDetal,
    precioMayorista: it.precioMayorista,
    precioBaseCatalogo: it.precioBaseCatalogo,
    precioSinIva: it.precioSinIva,
    valorIva: it.valorIva,
    totalPrice: it.totalPrice,
  }));
}

/**
 * Saves a quotation into the system.
 * Persists locally and synchronizes with Supabase.
 */
export async function saveQuotation(
  quotation: QuotationData,
  status: QuotationStatus = "pendiente"
): Promise<SavedQuotation> {
  const now = new Date().toISOString();
  const id = quotation.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  const savedItem: SavedQuotation = {
    id,
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customerName.trim() || "Cliente Comercial",
    advisorName: quotation.advisorName.trim(),
    notes: quotation.notes,
    currency: quotation.currency,
    copPriceType: quotation.copPriceType,
    totalUnits: quotation.totalUnits,
    totalReferences: quotation.totalReferences,
    subtotalCatalogo: quotation.subtotalCatalogo,
    subtotalSinIva: quotation.subtotalSinIva,
    totalIva: quotation.totalIva,
    totalAmount: quotation.totalWithIva,
    totalDiscount: quotation.totalDiscount,
    tierBadge: quotation.tierInfo.badge,
    status: quotation.status || status,
    items: mapQuotationItems(quotation.items),
    createdAt: quotation.date ? quotation.date.toISOString() : now,
    updatedAt: now,
    approvedAt: quotation.approvedAt,
    approvedBy: quotation.approvedBy,
    orderId: quotation.orderId,
  };

  // Upsert in local array
  const existingIdx = quotations.findIndex((q) => q.id === id || q.quotationNumber === quotation.quotationNumber);
  if (existingIdx >= 0) {
    quotations = [
      ...quotations.slice(0, existingIdx),
      { ...quotations[existingIdx], ...savedItem },
      ...quotations.slice(existingIdx + 1),
    ];
  } else {
    quotations = [savedItem, ...quotations];
  }
  emit();

  // Background attempt to persist in Supabase
  try {
    await (supabase as any).from("quotations").upsert({
      id: savedItem.id,
      quotation_number: savedItem.quotationNumber,
      customer_name: savedItem.customerName,
      advisor_name: savedItem.advisorName,
      notes: savedItem.notes,
      currency: savedItem.currency,
      cop_price_type: savedItem.copPriceType,
      total_units: savedItem.totalUnits,
      total_references: savedItem.totalReferences,
      subtotal_catalogo: savedItem.subtotalCatalogo,
      subtotal_sin_iva: savedItem.subtotalSinIva,
      total_iva: savedItem.totalIva,
      total_amount: savedItem.totalAmount,
      total_discount: savedItem.totalDiscount,
      tier_badge: savedItem.tierBadge,
      status: savedItem.status,
      items: savedItem.items,
      approved_at: savedItem.approvedAt || null,
      approved_by: savedItem.approvedBy || null,
      order_id: savedItem.orderId || null,
      created_at: savedItem.createdAt,
      updated_at: savedItem.updatedAt,
    });
  } catch (err) {
    console.warn("[QuotationsStore] Could not persist to remote Supabase, saved locally:", err);
  }

  return savedItem;
}

/** Updates quotation status */
export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus,
  extra: { approvedBy?: string; approvedAt?: string } = {}
): Promise<SavedQuotation> {
  const idx = quotations.findIndex((q) => q.id === id);
  if (idx < 0) {
    throw new Error(`No se encontró la cotización con ID: ${id}`);
  }

  const now = new Date().toISOString();
  const updated: SavedQuotation = {
    ...quotations[idx],
    status,
    updatedAt: now,
    ...(status === "aprobada"
      ? {
          approvedAt: extra.approvedAt || now,
          approvedBy: extra.approvedBy || "Sistema Trucco's",
        }
      : {}),
  };

  quotations = [...quotations.slice(0, idx), updated, ...quotations.slice(idx + 1)];
  emit();

  // Try updating in Supabase
  try {
    await (supabase as any)
      .from("quotations")
      .update({
        status,
        updated_at: now,
        ...(status === "aprobada"
          ? {
              approved_at: updated.approvedAt,
              approved_by: updated.approvedBy,
            }
          : {}),
      })
      .eq("id", id);
  } catch (err) {
    console.warn("[QuotationsStore] Supabase status update notice:", err);
  }

  return updated;
}

/**
 * Approves a quotation:
 * 1. Changes status to 'aprobada'.
 * 2. Downloads the order file in HGI format (CARGA_PEDIDOS...xls).
 * 3. Optionally registers into Supabase 'orders' and 'order_items' to reserve stock.
 */
export async function approveQuotation(
  id: string,
  options: { downloadHgi?: boolean; registerInOrders?: boolean } = { downloadHgi: true, registerInOrders: true }
): Promise<{ quotation: SavedQuotation; orderId?: string }> {
  const quotation = quotations.find((q) => q.id === id);
  if (!quotation) {
    throw new Error("Cotización no encontrada");
  }

  const updated = await updateQuotationStatus(id, "aprobada");

  // Automatically trigger HGI file download
  if (options.downloadHgi !== false) {
    try {
      downloadQuotationHgi(updated);
    } catch (err: any) {
      console.error("Error generating HGI file on approval:", err);
      toast.error(`Error al generar formato HGI: ${err?.message || "error desconocido"}`);
    }
  }

  let orderId: string | undefined;

  // Try registering in orders table so stock is reserved and it appears in order history
  if (options.registerInOrders !== false) {
    try {
      const orderItems: OrderItem[] = updated.items.map((it) => ({
        sku: it.sku,
        referencia: it.referencia,
        descripcion: it.descripcion,
        talla: it.talla,
        color: it.color,
        codColor: it.codColor,
        pvm: it.unitPrice,
        pvp: it.precioDetal || it.unitPrice,
        unitPrice: it.unitPrice,
        saldo: 99999,
        cantidad: it.cantidad,
      }));

      orderId = await saveOrderToDb(
        `${updated.customerName} [${updated.quotationNumber}]`,
        orderItems
      );

      // Link orderId to quotation
      const idx = quotations.findIndex((q) => q.id === id);
      if (idx >= 0) {
        quotations[idx].orderId = orderId;
        emit();
        await (supabase as any)
          .from("quotations")
          .update({ order_id: orderId })
          .eq("id", id);
      }
    } catch (orderErr: any) {
      console.warn("[QuotationsStore] Order registration note:", orderErr?.message || orderErr);
      // We don't block approval if inventory check or orders insert encounters an issue;
      // we still approved the quotation and downloaded HGI.
    }
  }

  return { quotation: updated, orderId };
}

/**
 * Downloads a quotation in the HGI order format:
 * File: CARGA_PEDIDOS_[CLIENTE]_[FECHA].xls
 * Sheet: TblDetalleDocumentos
 * Columns: StrProducto, IntCantidaddoc, IntvalorUnitario, IntBodega, StrLote, StrColor
 */
export function downloadQuotationHgi(quotation: SavedQuotation | QuotationData): void {
  if (!quotation.items || quotation.items.length === 0) {
    throw new Error("La cotización no contiene artículos para exportar a HGI.");
  }

  const orderItems: OrderItem[] = quotation.items.map((it) => ({
    sku: it.sku,
    referencia: it.referencia,
    descripcion: it.descripcion,
    talla: it.talla,
    color: it.color,
    codColor: (it as any).codColor || "",
    pvm: it.unitPrice,
    pvp: (it as any).precioDetal || it.unitPrice,
    unitPrice: it.unitPrice,
    saldo: 99999,
    cantidad: it.cantidad,
  }));

  downloadOrderXls(orderItems, quotation.customerName, true);
}

/** Converts a SavedQuotation into QuotationData to use in PDF/Excel downloads */
export function savedQuotationToQuotationData(
  saved: SavedQuotation,
  inventoryLookup: Record<string, InventoryRow> = {}
): QuotationData {
  const orderItems: OrderItem[] = saved.items.map((it) => ({
    sku: it.sku,
    referencia: it.referencia,
    descripcion: it.descripcion,
    talla: it.talla,
    color: it.color,
    codColor: it.codColor,
    pvm: it.precioMayorista || it.unitPrice,
    pvp: it.precioDetal || it.unitPrice,
    unitPrice: it.unitPrice,
    saldo: 99999,
    cantidad: it.cantidad,
  }));

  const qData = buildQuotationData(
    orderItems,
    {
      currency: saved.currency,
      copPriceType: saved.copPriceType,
      customerName: saved.customerName,
      advisorName: saved.advisorName,
      notes: saved.notes,
    },
    inventoryLookup
  );

  qData.id = saved.id;
  qData.quotationNumber = saved.quotationNumber;
  qData.status = saved.status;
  qData.approvedAt = saved.approvedAt || undefined;
  qData.orderId = saved.orderId || undefined;
  if (saved.createdAt) {
    qData.date = new Date(saved.createdAt);
  }

  return qData;
}

/** Downloads formal PDF for a SavedQuotation */
export function downloadSavedQuotationPdf(
  saved: SavedQuotation,
  inventoryLookup: Record<string, InventoryRow> = {}
): void {
  const qData = savedQuotationToQuotationData(saved, inventoryLookup);
  downloadQuotationPdf(qData);
}

/** Downloads formal Excel for a SavedQuotation */
export function downloadSavedQuotationExcel(
  saved: SavedQuotation,
  inventoryLookup: Record<string, InventoryRow> = {}
): void {
  const qData = savedQuotationToQuotationData(saved, inventoryLookup);
  downloadQuotationExcel(qData);
}

/**
 * Downloads warehouse locations file in Bodega 1001 for references in a SavedQuotation or QuotationData.
 */
export function downloadQuotationUbicaciones(
  quotation: SavedQuotation | QuotationData,
  inventoryLookup?: Record<string, InventoryRow> | InventoryRow[],
  format: "xlsx" | "csv" = "xlsx"
): void {
  const items = quotation.items || [];
  if (items.length === 0) {
    throw new Error("La cotización no tiene prendas para exportar ubicaciones.");
  }
  const options = {
    quotationNumber: quotation.quotationNumber,
    customerName: quotation.customerName,
    advisorName: quotation.advisorName,
    inventory: inventoryLookup,
  };

  if (format === "xlsx") {
    exportQuotationUbicacionesBodega1001(items, options);
  } else {
    exportQuotationUbicacionesBodega1001Csv(items, options);
  }
}

/** Deletes a quotation from the system */
export async function deleteQuotation(id: string): Promise<void> {
  quotations = quotations.filter((q) => q.id !== id);
  emit();

  try {
    await (supabase as any).from("quotations").delete().eq("id", id);
  } catch (err) {
    console.warn("[QuotationsStore] Supabase delete note:", err);
  }
}

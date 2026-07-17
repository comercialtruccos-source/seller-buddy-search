import { useEffect, useSyncExternalStore } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OrderItem {
  sku: string;
  referencia: string;
  descripcion: string;
  talla: string;
  color: string;
  codColor: string;
  pvm: number;
  saldo: number;
  cantidad: number;
}

const STORAGE_KEY = "pedido_actual_v1";

let items: OrderItem[] = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): OrderItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useOrder() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
  return snapshot;
}

/** Hydrate from localStorage after mount (avoid SSR/CSR mismatch). */
export function useHydrateOrder() {
  useEffect(() => {
    items = loadFromStorage();
    emit();
  }, []);
}

export function addOrderItem(
  item: Omit<OrderItem, "cantidad">,
  qty = 1
): { success: boolean; isLimit: boolean; currentQty: number } {
  const idx = items.findIndex((i) => i.sku === item.sku);
  if (idx >= 0) {
    const currentQty = items[idx].cantidad;
    if (currentQty >= item.saldo) {
      return { success: false, isLimit: true, currentQty };
    }
    const nextQty = Math.min(item.saldo, currentQty + qty);
    const next = { ...items[idx], cantidad: nextQty };
    items = [...items.slice(0, idx), next, ...items.slice(idx + 1)];
    emit();
    return { success: true, isLimit: nextQty === item.saldo, currentQty: nextQty };
  } else {
    const nextQty = Math.min(item.saldo, qty);
    items = [...items, { ...item, cantidad: nextQty }];
    emit();
    return { success: true, isLimit: nextQty === item.saldo, currentQty: nextQty };
  }
}

export function setOrderQty(sku: string, cantidad: number): { clamped: boolean; nextQty: number } {
  const idx = items.findIndex((i) => i.sku === sku);
  if (idx < 0) return { clamped: false, nextQty: 0 };
  const target = Math.floor(cantidad);
  const clampedVal = Math.max(0, Math.min(items[idx].saldo, target));
  const clamped = target > items[idx].saldo || target < 0;

  if (clampedVal === 0) {
    items = items.filter((i) => i.sku !== sku);
  } else {
    const next = { ...items[idx], cantidad: clampedVal };
    items = [...items.slice(0, idx), next, ...items.slice(idx + 1)];
  }
  emit();
  return { clamped, nextQty: clampedVal };
}

export function removeOrderItem(sku: string) {
  items = items.filter((i) => i.sku !== sku);
  emit();
}

export function clearOrder() {
  items = [];
  emit();
}

export function downloadOrderXls(order: OrderItem[], customerName?: string) {
  const aoa: (string | number)[][] = [
    [
      "StrProducto",
      "IntCantidaddoc",
      "IntvalorUnitario",
      "IntBodega",
      "StrLote",
      "StrColor",
    ],
  ];

  const formatNumeric = (val: string): string => {
    const trimmed = (val || "").trim();
    if (/^\d+$/.test(trimmed)) {
      return trimmed.padStart(2, "0");
    }
    return trimmed;
  };

  for (const it of order) {
    if (it.cantidad <= 0) continue;
    aoa.push([
      it.referencia,
      it.cantidad,
      it.pvm,
      "01",
      formatNumeric(it.talla),
      formatNumeric(it.codColor),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Force columns D, E, F to be treated as string type ('s') to preserve leading zeros in Excel
  for (let r = 1; r < aoa.length; r++) {
    // Column D (index 3): IntBodega
    const cellD = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (cellD) {
      cellD.t = "s";
    }
    // Column E (index 4): StrLote (talla)
    const cellE = ws[XLSX.utils.encode_cell({ r, c: 4 })];
    if (cellE) {
      cellE.t = "s";
    }
    // Column F (index 5): StrColor (codColor)
    const cellF = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (cellF) {
      cellF.t = "s";
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TblDetalleDocumentos");
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const suffix = customerName ? `_${customerName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : "";
  const fname = `CARGA_PEDIDOS${suffix}_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.xls`;
  XLSX.writeFile(wb, fname, { bookType: "biff8" });
}

export async function saveOrderToDb(customerName: string, items: OrderItem[]): Promise<string> {
  const skus = items.map((it) => it.sku);

  // 1. Fetch current inventory for these SKUs to check original stock
  const { data: invData, error: invError } = await supabase
    .from("inventory")
    .select("sku, referencia, talla, color, saldo")
    .in("sku", skus);
  if (invError) throw new Error(`Error al verificar inventario: ${invError.message}`);

  // 2. Fetch current ordered quantities for these SKUs
  const { data: orderedData, error: orderedError } = await supabase
    .from("order_items")
    .select("sku, cantidad")
    .in("sku", skus);
  if (orderedError) throw new Error(`Error al verificar pedidos existentes: ${orderedError.message}`);

  const orderedMap: Record<string, number> = {};
  if (orderedData) {
    for (const ord of orderedData) {
      orderedMap[ord.sku] = (orderedMap[ord.sku] || 0) + ord.cantidad;
    }
  }

  // 3. Check stock availability
  const errors: string[] = [];
  for (const it of items) {
    const inv = invData?.find((i) => i.sku === it.sku);
    if (!inv) {
      errors.push(`La referencia ${it.referencia} (Talla ${it.talla}, SKU ${it.sku}) no existe en el inventario.`);
      continue;
    }
    const reserved = orderedMap[it.sku] || 0;
    const available = Math.max(0, inv.saldo - reserved);
    if (it.cantidad > available) {
      errors.push(
        `${it.referencia} - T${it.talla} (${it.color}): Solicitado ${it.cantidad}, Disponible real: ${available} (ya reservado en otros pedidos).`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  // 4. Insert order header
  const totalAmount = items.reduce((s, i) => s + i.pvm * i.cantidad, 0);
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: customerName.trim(),
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // 5. Insert order items
  const itemsToInsert = items.map((it) => ({
    order_id: orderData.id,
    sku: it.sku,
    referencia: it.referencia,
    descripcion: it.descripcion,
    talla: it.talla,
    color: it.color,
    cod_color: it.codColor,
    pvm: it.pvm,
    cantidad: it.cantidad,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsToInsert);

  if (itemsError) {
    // Cleanup parent order on failure
    await supabase.from("orders").delete().eq("id", orderData.id);
    throw itemsError;
  }

  return orderData.id;
}

export async function downloadSavedOrder(orderId: string, customerName: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (error) {
    toast.error(`Error al obtener los detalles del pedido: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    toast.error("El pedido no contiene artículos.");
    return;
  }

  const orderItems: OrderItem[] = data.map((item) => ({
    sku: item.sku,
    referencia: item.referencia,
    descripcion: item.descripcion,
    talla: item.talla,
    color: item.color,
    codColor: item.cod_color,
    pvm: Number(item.pvm),
    saldo: 99999, // dummy stock value for export
    cantidad: item.cantidad,
  }));

  downloadOrderXls(orderItems, customerName);
}

export async function deleteOrderFromDb(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (error) throw error;
}

import { useEffect, useSyncExternalStore } from "react";
import * as XLSX from "xlsx";

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

/** Build & download the CARGA_PEDIDOS .xls file with the exact format required. */
export function downloadOrderXls(order: OrderItem[]) {
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
  const fname = `CARGA_PEDIDOS_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.xls`;
  XLSX.writeFile(wb, fname, { bookType: "biff8" });
}

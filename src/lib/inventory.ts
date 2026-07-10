export interface InventoryRow {
  referencia: string;
  descripcion: string;
  tallaLote: string;
  color: string;
  saldo: number;
  talla: string;
  codColor: string;
  sku: string;
  pvm: number; // precio mayorista (PVM UNIT)
  pvp: number; // precio detal (PVP UNIT)
}

export interface ReferenceGroup {
  referencia: string;
  descripcion: string;
  pvm: number;
  pvp: number;
  totalSaldo: number;
  variantes: InventoryRow[];
}

export const STORAGE_DATA_KEY = "inventario_data";
export const STORAGE_UPDATED_KEY = "inventario_actualizado";

/** Parse a single CSV line respecting quoted fields. */
function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

function toNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse the inventory CSV. Expected headers:
 * Referencia, Descripción, Talla - Lote, Color, Saldo, Talla, CodColor, SKU, PVM UNIT, PVP UNIT
 */
export function parseInventoryCsv(text: string): InventoryRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  // Skip header row.
  const dataLines = lines.slice(1);
  const rows: InventoryRow[] = [];

  for (const line of dataLines) {
    const cols = parseLine(line);
    if (cols.length < 10) continue;
    const referencia = cols[0];
    if (!referencia) continue;
    rows.push({
      referencia,
      descripcion: cols[1] ?? "",
      tallaLote: cols[2] ?? "",
      color: cols[3] ?? "",
      saldo: toNumber(cols[4]),
      talla: cols[5] ?? "",
      codColor: cols[6] ?? "",
      sku: cols[7] ?? "",
      pvm: toNumber(cols[8]),
      pvp: toNumber(cols[9]),
    });
  }

  return rows;
}

/** Group rows by Referencia to build a reference card. */
export function groupByReferencia(rows: InventoryRow[]): ReferenceGroup[] {
  const map = new Map<string, ReferenceGroup>();
  for (const row of rows) {
    const existing = map.get(row.referencia);
    if (existing) {
      existing.variantes.push(row);
      existing.totalSaldo += row.saldo;
      // Keep the max known prices in case of inconsistencies.
      existing.pvm = existing.pvm || row.pvm;
      existing.pvp = existing.pvp || row.pvp;
    } else {
      map.set(row.referencia, {
        referencia: row.referencia,
        descripcion: row.descripcion,
        pvm: row.pvm,
        pvp: row.pvp,
        totalSaldo: row.saldo,
        variantes: [row],
      });
    }
  }
  return Array.from(map.values());
}

export function searchReferences(
  groups: ReferenceGroup[],
  query: string,
): ReferenceGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return groups.filter((g) => g.referencia.toLowerCase().includes(q));
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormatter.format(date);
}

import { supabase } from "@/integrations/supabase/client";

interface InventoryDbRow {
  referencia: string;
  descripcion: string;
  talla_lote: string;
  color: string;
  saldo: number;
  talla: string;
  cod_color: string;
  sku: string;
  pvm: number;
  pvp: number;
  created_at?: string;
}

function fromDb(row: InventoryDbRow): InventoryRow {
  return {
    referencia: row.referencia,
    descripcion: row.descripcion,
    tallaLote: row.talla_lote,
    color: row.color,
    saldo: row.saldo,
    talla: row.talla,
    codColor: row.cod_color,
    sku: row.sku,
    pvm: row.pvm,
    pvp: row.pvp,
  };
}

function toDb(row: InventoryRow): InventoryDbRow {
  return {
    referencia: row.referencia,
    descripcion: row.descripcion,
    talla_lote: row.tallaLote,
    color: row.color,
    saldo: row.saldo,
    talla: row.talla,
    cod_color: row.codColor,
    sku: row.sku,
    pvm: row.pvm,
    pvp: row.pvp,
  };
}

/** Load the shared inventory from the database. */
export async function loadInventory(): Promise<{
  rows: InventoryRow[];
  updatedAt: string | null;
}> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("referencia", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []).map(fromDb);
  const updatedAt = (data ?? []).reduce<string | null>((latest, row) => {
    const created = (row as InventoryDbRow).created_at ?? null;
    if (!created) return latest;
    if (!latest || created > latest) return created;
    return latest;
  }, null);

  return { rows, updatedAt };
}

/** Replace the entire shared inventory with a new dataset. */
export async function saveInventory(rows: InventoryRow[]): Promise<string> {
  // Clear existing inventory.
  const { error: deleteError } = await supabase
    .from("inventory")
    .delete()
    .not("id", "is", null);
  if (deleteError) throw deleteError;

  // Insert new records in batches.
  const payload = rows.map(toDb);
  const batchSize = 500;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from("inventory")
      .insert(batch);
    if (insertError) throw insertError;
  }

  // Read back the latest timestamp for an accurate "last updated" value.
  const { data } = await supabase
    .from("inventory")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0]?.created_at ?? new Date().toISOString();
}

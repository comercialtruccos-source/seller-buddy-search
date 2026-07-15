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
  imageUrl?: string;
}

export interface ReferenceGroup {
  referencia: string;
  descripcion: string;
  pvm: number;
  pvp: number;
  totalSaldo: number;
  variantes: InventoryRow[];
  imageUrl?: string;
}

export const STORAGE_DATA_KEY = "inventario_data";
export const STORAGE_UPDATED_KEY = "inventario_actualizado";

/** Parse a single CSV line respecting quoted fields and dynamic separator. */
function parseLine(line: string, separator: string = ","): string[] {
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
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

/** Robust number parsing supporting both Spanish (dots/commas thousands) and standard numbers. */
function toNumber(value: string): number {
  if (!value) return 0;
  
  // Clean spaces, dollar signs
  let cleaned = value.trim().replace(/[\$\s]/g, "");
  
  // Check if it's formatted in Spanish (e.g., 98.651,00 or 98.651)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastCommaIdx = cleaned.lastIndexOf(",");
    const lastDotIdx = cleaned.lastIndexOf(".");
    if (lastCommaIdx > lastDotIdx) {
      // Dot is thousands, comma is decimal (Spanish format)
      cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // Comma is thousands, dot is decimal (English format)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    // Only commas: could be thousands (e.g. 98,651) or decimal (e.g. 98,65)
    // If comma is followed by exactly 3 digits, it is likely a thousands separator.
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/,/g, ".");
    }
  } else if (cleaned.includes(".")) {
    // Only dots: could be thousands (e.g. 98.651) or decimal (e.g. 98.65)
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }
  
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Decode a CSV file trying UTF-8 first and falling back to Windows-1252 when
 * the file was exported with the Spanish/Latin-1 encoding used by Excel on
 * Windows. This prevents tildes and "ñ" from becoming the "�" replacement
 * character.
 */
export async function readCsvFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/**
 * Parse the inventory CSV. Expected headers:
 * Referencia, Descripción, Talla - Lote, Color, Saldo, Talla, CodColor, SKU, PVM UNIT, PVP UNIT
 */
function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  if (
    u === "" ||
    u === "#n/d" ||
    u === "#n/a" ||
    u === "#ref!" ||
    u === "#value!" ||
    u === "#valor!" ||
    u === "n/a" ||
    u === "n/d" ||
    u === "null" ||
    u === "undefined"
  ) {
    return false;
  }
  // Ignore values that don't look like URLs or paths (must contain a dot or slash)
  return u.includes(".") || u.includes("/");
}

export function parseInventoryCsv(text: string): InventoryRow[] {
  // Remove UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.startsWith("\ufeff")) {
    cleanText = cleanText.substring(1);
  }

  const lines = cleanText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  // Dynamically detect separator: count commas vs semicolons on the header line
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const separator = semicolonCount > commaCount ? ";" : ",";

  // Parse headers using the detected separator
  const headers = parseLine(lines[0], separator).map((h) => h.toLowerCase());
  const photoIdx = headers.findIndex(
    (h) => h.includes("foto") || h.includes("imagen") || h.includes("image")
  );

  const dataLines = lines.slice(1);
  const rows: InventoryRow[] = [];

  for (const line of dataLines) {
    const cols = parseLine(line, separator);
    const referencia = cols[0];
    if (!referencia) continue;

    const row: InventoryRow = {
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
    };

    let rawImgUrl = "";
    if (photoIdx !== -1 && cols[photoIdx]) {
      rawImgUrl = cols[photoIdx];
    } else if (cols[10]) {
      rawImgUrl = cols[10];
    }

    if (isValidImageUrl(rawImgUrl)) {
      row.imageUrl = rawImgUrl.trim();
    } else {
      row.imageUrl = "";
    }

    rows.push(row);
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
      if (!existing.imageUrl && row.imageUrl) {
        existing.imageUrl = row.imageUrl;
      }
    } else {
      map.set(row.referencia, {
        referencia: row.referencia,
        descripcion: row.descripcion,
        pvm: row.pvm,
        pvp: row.pvp,
        totalSaldo: row.saldo,
        variantes: [row],
        imageUrl: row.imageUrl,
      });
    }
  }
  return Array.from(map.values());
}

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeCode(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
}

export function searchReferences(
  groups: ReferenceGroup[],
  query: string,
): ReferenceGroup[] {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Normalize query words for text search
  const words = normalizeText(cleanQuery).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Code-based query (remove spaces, hyphens, dots, etc.)
  const queryCode = normalizeCode(cleanQuery);

  return groups.filter((group) => {
    const normRef = normalizeText(group.referencia);
    const normRefCode = normalizeCode(group.referencia);
    const normDesc = normalizeText(group.descripcion);

    // 1. Direct code search (Reference code or SKU exact/prefix match)
    if (queryCode.length >= 3 && normRefCode.includes(queryCode)) {
      return true;
    }

    if (queryCode.length >= 3) {
      const matchesSku = group.variantes.some((v) => {
        const normSku = normalizeCode(v.sku);
        return normSku.includes(queryCode);
      });
      if (matchesSku) return true;
    }

    // 2. Word-by-word search (AND logic across Reference, Description, Color, SKU)
    return words.every((word) => {
      // Word matches reference
      if (normRef.includes(word)) return true;
      // Word matches description
      if (normDesc.includes(word)) return true;
      // Word matches color in any variant
      const matchesColor = group.variantes.some((v) =>
        normalizeText(v.color).includes(word)
      );
      if (matchesColor) return true;
      // Word matches SKU in any variant
      const matchesSku = group.variantes.some((v) =>
        normalizeText(v.sku).includes(word)
      );
      if (matchesSku) return true;

      return false;
    });
  });
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
  image_url?: string;
  created_at?: string;
}

/**
 * Fix common mojibake produced when a Windows-1252 / Latin-1 CSV is decoded as
 * UTF-8. Once the bad decode happens, the original byte is replaced by U+FFFD
 * ("�") and information is lost, so we map known Spanish words back by hand.
 */
const MOJIBAKE_WORD_MAP: Array<[RegExp, string]> = [
  [/Champa\uFFFDa/gi, "Champaña"],
  [/Casta\uFFFDo/gi, "Castaño"],
  [/Casta\uFFFDa/gi, "Castaña"],
  [/Ma\uFFFDana/gi, "Mañana"],
  [/Pi\uFFFDa/gi, "Piña"],
  [/A\uFFFDil/gi, "Añil"],
  [/Se\uFFFDora/gi, "Señora"],
  [/Caf\uFFFD/gi, "Café"],
  [/Marr\uFFFDn/gi, "Marrón"],
  [/Lim\uFFFDn/gi, "Limón"],
  [/Melocot\uFFFDn/gi, "Melocotón"],
  [/Salm\uFFFDn/gi, "Salmón"],
  [/Turqu\uFFFDs/gi, "Turquesa"],
  [/P\uFFFDrpura/gi, "Púrpura"],
  [/N\uFFFDcar/gi, "Nácar"],
  [/Fucs\uFFFDa/gi, "Fucsia"],
  [/Rub\uFFFD/gi, "Rubí"],
];

export function fixMojibake(input: string): string {
  if (!input || !input.includes("\uFFFD")) return input;
  let out = input;
  for (const [re, replacement] of MOJIBAKE_WORD_MAP) {
    out = out.replace(re, (match) =>
      match === match.toUpperCase() ? replacement.toUpperCase() : replacement,
    );
  }
  // Preserve original casing of the corrected word; leftover � is unrecoverable.
  return out;
}

function fromDb(row: InventoryDbRow): InventoryRow {
  return {
    referencia: row.referencia,
    descripcion: fixMojibake(row.descripcion),
    tallaLote: row.talla_lote,
    color: fixMojibake(row.color),
    saldo: row.saldo,
    talla: row.talla,
    codColor: row.cod_color,
    sku: row.sku,
    pvm: row.pvm,
    pvp: row.pvp,
    imageUrl: row.image_url ?? "",
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
    image_url: row.imageUrl ?? "",
  };
}

/** Load the shared inventory from the database. */
export async function loadInventory(): Promise<{
  rows: InventoryRow[];
  updatedAt: string | null;
}> {
  const pageSize = 1000;
  let from = 0;
  const all: InventoryDbRow[] = [];
  // Paginate to bypass PostgREST's default 1000-row cap.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("referencia", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as InventoryDbRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  const data = all;

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

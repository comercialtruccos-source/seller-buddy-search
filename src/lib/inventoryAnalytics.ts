import type { InventoryRow } from "./inventory";

// ─── Size Extraction & Normalization ───────────────────────────────
export function extractNormalizedSize(row: {
  talla?: string;
  tallaLote?: string;
  sku?: string;
}): string {
  let raw = (row.talla || "").trim().toUpperCase();

  // If talla is empty or single dash/generic placeholder, try tallaLote
  if (!raw || raw === "-" || raw === "--" || raw === "0" || raw === "00") {
    if (row.tallaLote) {
      const parts = row.tallaLote.trim().split(/[-_\s/]+/);
      const ext = parts[0]?.trim().toUpperCase();
      if (ext && ext !== "0" && ext !== "00") {
        raw = ext;
      }
    }
  }

  // If still empty, try extracting from SKU (often ends with size like ...-S, ...-04, ...-32)
  if (!raw && row.sku) {
    const skuParts = row.sku.trim().split(/[-_]+/);
    if (skuParts.length >= 2) {
      const last = skuParts[skuParts.length - 1].trim().toUpperCase();
      if (last.length <= 4) {
        raw = last;
      }
    }
  }

  if (!raw) return "U";

  // Normalize "UNICA", "ÚNICA", "TU", "UNI" to "U"
  if (raw === "UNICA" || raw === "ÚNICA" || raw === "TU" || raw === "UNI" || raw === "STD") {
    return "U";
  }

  // Normalize numeric sizes like "2" -> "02", "4" -> "04", "6" -> "06", "8" -> "08"
  if (/^\d+$/.test(raw)) {
    const num = parseInt(raw, 10);
    // If it's a small number <= 20, pad to 2 digits (e.g. 02, 04, 06, 08, 10, 12, 14, 16)
    if (num <= 20) {
      return String(num).padStart(2, "0");
    }
    // If it's 28, 30, 32, 34, 36, 38, etc.
    return String(num);
  }

  // Normalize letter sizes
  if (raw === "EXTRA SMALL" || raw === "X-SMALL") return "XS";
  if (raw === "SMALL") return "S";
  if (raw === "MEDIUM" || raw === "MED") return "M";
  if (raw === "LARGE") return "L";
  if (raw === "EXTRA LARGE" || raw === "X-LARGE") return "XL";
  if (raw === "XXL" || raw === "2X" || raw === "2XL") return "2XL";
  if (raw === "XXXL" || raw === "3X" || raw === "3XL") return "3XL";

  return raw;
}

// ─── Filter State ───────────────────────────────────────────────────
export interface AnalyticsFilterState {
  searchQuery: string;
  selectedBodegas: string[];
  selectedTallas: string[];
  selectedColors: string[];
  healthTiers: HealthTier[];
  priceRange: [number, number] | null;
  preset: AnalyticsPreset | null;
}

export type HealthTier = "oos" | "low" | "healthy" | "overstock";
export type AnalyticsPreset =
  | "broken-sizes"
  | "overstock"
  | "low-stock"
  | "orphans"
  | null;

export const EMPTY_FILTERS: AnalyticsFilterState = {
  searchQuery: "",
  selectedBodegas: [],
  selectedTallas: [],
  selectedColors: [],
  healthTiers: [],
  priceRange: null,
  preset: null,
};

// ─── Health Tier Thresholds ────────────────────────────────────────
const LOW_STOCK_MAX = 3;
const HEALTHY_MAX = 30;

export function getHealthTier(saldo: number): HealthTier {
  if (saldo === 0) return "oos";
  if (saldo <= LOW_STOCK_MAX) return "low";
  if (saldo <= HEALTHY_MAX) return "healthy";
  return "overstock";
}

// ─── Computed Analytics Result ─────────────────────────────────────
export interface AnalyticsKpis {
  totalUnits: number;
  totalSkus: number;
  uniqueReferences: number;
  totalCostValue: number;
  totalRetailValue: number;
  totalUsdValue: number;
  theoreticalMarginPct: number;
  brokenSizeRate: number;
  orphanSkuRatio: number;
  healthyStockPct: number;
  weightedAupRetail: number;
  weightedAupCost: number;
  overstockCapitalValue: number;
}

export interface HealthBreakdown {
  oos: number;
  low: number;
  healthy: number;
  overstock: number;
  orphan: number;
}

export interface BodegaEntry {
  name: string;
  units: number;
  costValue: number;
  retailValue: number;
}

export interface SizeCurveEntry {
  size: string;
  units: number;
}

export interface ColorEntry {
  color: string;
  units: number;
}

// ─── Custom Manufacturing Costs Mapping ──────────────────────────────
export const CUSTOM_MANUFACTURING_COSTS: Record<string, number> = {
  B03024835: 30165,
  B03025833: 30999,
  B03033836: 18889,
  B05025401: 25988,
  B07025785: 44602,
  B29133051: 48529,
  B29144047: 42803,
  B29144048: 43726,
  B39045019: 28240,
  B43037065: 70451,
  B45037277: 78242,
  B45037282: 76045,
  P01097015: 55029,
  P01097020: 41641,
  P03025834: 26320,
  P07025784: 43175,
  P09024193: 27804,
  P22036054: 59797,
  P22077035: 60082,
  P22125073: 62562,
  P29107045: 50253,
  P32097146: 45369,
  P43037063: 73052,
  P43037064: 72473,
  R09084044: 35334,
  R09114043: 36315,
  R09114045: 41170,
  R22084050: 54488,
  R22133090: 55526,
  R22141092: 63784,
  T01097021: 45201,
  T12057149: 67183,
  T17057200: 61364,
  T17057201: 48025,
  T17060202: 61253,
  T22036011: 58744,
  T22077071: 59209,
  T22092066: 57550,
  T22107116: 54936,
  T22107140: 51594,
  T22107142: 57805,
  T22107143: 58639,
  T22107145: 58587,
  T22107205: 55164,
  T22107206: 63246,
  T22107207: 55105,
  T22133064: 52430,
  T22144058: 54411,
  T29107049: 59702,
  T32097147: 39127,
  T32097148: 42401,
  T35035165: 52518,
  T35057164: 61934,
  T45037278: 93171,
  T45037279: 76177,
};

export function getManufacturingCost(referencia: string): number | undefined {
  if (!referencia) return undefined;
  const normRef = referencia.trim().toUpperCase();
  return CUSTOM_MANUFACTURING_COSTS[normRef];
}

export interface ReferenceAnalytics {
  referencia: string;
  descripcion: string;
  totalStock: number;
  totalCostValue: number;
  totalRetailValue: number;
  sizes: Map<string, number>;
  colors: Set<string>;
  bodegas: Set<string>;
  pvm: number;
  pvp: number;
  costoFabricacion?: number;
  isBrokenSizeRun: boolean;
}

export interface SizeHeatmapRow {
  referencia: string;
  descripcion: string;
  color: string;
  sizes: Record<string, number>;
  totalStock: number;
  pvm: number;
  pvp: number;
  costoFabricacion?: number;
}

export interface AnalyticsResult {
  kpis: AnalyticsKpis;
  healthBreakdown: HealthBreakdown;
  bodegaDistribution: BodegaEntry[];
  sizeCurve: SizeCurveEntry[];
  colorDistribution: ColorEntry[];
  topOverstock: ReferenceAnalytics[];
  topUnderstock: ReferenceAnalytics[];
  sizeHeatmap: SizeHeatmapRow[];
  allSizes: string[];
  availableBodegas: string[];
  availableTallas: string[];
  availableColors: string[];
  maxPvp: number;
}

// ─── Standardized size order ───────────────────────────────────────
export const STANDARD_LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "U"];
export const STANDARD_NUMERIC_SIZES = ["02", "04", "06", "08", "10", "12", "14", "16", "18", "20"];
export const STANDARD_PANT_SIZES = ["28", "30", "32", "34", "36", "38", "40", "42"];
export const STANDARD_UNICA_SIZES = ["U"];

const SIZE_ORDER: Record<string, number> = {
  XXS: 1,
  XS: 2,
  S: 3,
  M: 4,
  L: 5,
  XL: 6,
  "2XL": 7,
  XXL: 7,
  "3XL": 8,
  XXXL: 8,
  "4XL": 9,
  "5XL": 10,
  "02": 11,
  "04": 12,
  "06": 13,
  "08": 14,
  "10": 15,
  "12": 16,
  "14": 17,
  "16": 18,
  "18": 19,
  "20": 20,
  "24": 24,
  "26": 26,
  "28": 28,
  "30": 30,
  "32": 32,
  "34": 34,
  "36": 36,
  "38": 38,
  "40": 40,
  "42": 42,
  U: 99,
  UNICA: 99,
};

export function sizeSort(a: string, b: string): number {
  const aUp = a.toUpperCase();
  const bUp = b.toUpperCase();
  const aOrd = SIZE_ORDER[aUp];
  const bOrd = SIZE_ORDER[bUp];
  if (aOrd !== undefined && bOrd !== undefined) return aOrd - bOrd;
  if (aOrd !== undefined) return -1;
  if (bOrd !== undefined) return 1;
  const aNum = parseInt(aUp, 10);
  const bNum = parseInt(bUp, 10);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return aUp.localeCompare(bUp);
}

// ─── Filter Application ───────────────────────────────────────────
export function applyFilters(
  rows: InventoryRow[],
  filters: AnalyticsFilterState
): InventoryRow[] {
  return rows.filter((r) => {
    const s = extractNormalizedSize(r);
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matches =
        r.referencia.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.color.toLowerCase().includes(q) ||
        s.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (
      filters.selectedBodegas.length > 0 &&
      !filters.selectedBodegas.includes(r.bodega || "PRINCIPAL 1004")
    ) {
      return false;
    }
    if (
      filters.selectedTallas.length > 0 &&
      !filters.selectedTallas.includes(s) &&
      !filters.selectedTallas.includes(r.talla)
    ) {
      return false;
    }
    if (
      filters.selectedColors.length > 0 &&
      !filters.selectedColors.includes(r.color)
    ) {
      return false;
    }
    if (filters.healthTiers.length > 0) {
      const tier = getHealthTier(r.saldo);
      if (!filters.healthTiers.includes(tier)) return false;
    }
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (r.pvp < min || r.pvp > max) return false;
    }
    return true;
  });
}

// ─── Main Computation ──────────────────────────────────────────────
export function computeInventoryAnalytics(
  allRows: InventoryRow[],
  filteredRows?: InventoryRow[]
): AnalyticsResult {
  const data = filteredRows || allRows;

  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalUsdValue = 0;

  const bodegaMap = new Map<
    string,
    { units: number; costValue: number; retailValue: number }
  >();
  const sizeMap = new Map<string, number>();
  const colorMap = new Map<string, number>();
  const refMap = new Map<string, ReferenceAnalytics>();
  const heatmapMap = new Map<string, SizeHeatmapRow>();

  const healthCounts: HealthBreakdown = {
    oos: 0,
    low: 0,
    healthy: 0,
    overstock: 0,
    orphan: 0,
  };

  // Available filter options from ALL data (not filtered)
  const allBodegas = new Set<string>();
  const allTallas = new Set<string>();
  const allColors = new Set<string>();
  let maxPvp = 0;

  for (const item of allRows) {
    const s = extractNormalizedSize(item);
    allBodegas.add(item.bodega || "PRINCIPAL 1004");
    allTallas.add(s);
    allColors.add(item.color);
    if (item.pvp > maxPvp) maxPvp = item.pvp;
  }

  // Process filtered data for KPIs
  for (const item of data) {
    const saldo = item.saldo;
    const pvm = item.pvm || 0;
    const pvp = item.pvp || 0;
    const usd = item.precioUsd || 0;
    const s = extractNormalizedSize(item);

    totalUnits += saldo;
    totalCostValue += saldo * pvm;
    totalRetailValue += saldo * pvp;
    totalUsdValue += saldo * usd;

    // Health buckets
    if (saldo === 0) healthCounts.oos++;
    else if (saldo === 1) {
      healthCounts.orphan++;
      healthCounts.low++;
    } else if (saldo <= LOW_STOCK_MAX) healthCounts.low++;
    else if (saldo <= HEALTHY_MAX) healthCounts.healthy++;
    else healthCounts.overstock++;

    // Bodega
    const b = item.bodega || "PRINCIPAL 1004";
    if (!bodegaMap.has(b))
      bodegaMap.set(b, { units: 0, costValue: 0, retailValue: 0 });
    const bEntry = bodegaMap.get(b)!;
    bEntry.units += saldo;
    bEntry.costValue += saldo * pvm;
    bEntry.retailValue += saldo * pvp;

    // Size
    sizeMap.set(s, (sizeMap.get(s) || 0) + saldo);

    // Color
    const c = item.color || "Único";
    colorMap.set(c, (colorMap.get(c) || 0) + saldo);

    // Reference grouping
    const refKey = item.referencia;
    const fabCost = getManufacturingCost(item.referencia);
    if (!refMap.has(refKey)) {
      refMap.set(refKey, {
        referencia: item.referencia,
        descripcion: item.descripcion,
        totalStock: 0,
        totalCostValue: 0,
        totalRetailValue: 0,
        sizes: new Map(),
        colors: new Set(),
        bodegas: new Set(),
        pvm,
        pvp,
        costoFabricacion: fabCost,
        isBrokenSizeRun: false,
      });
    }
    const rEntry = refMap.get(refKey)!;
    rEntry.totalStock += saldo;
    rEntry.totalCostValue += saldo * pvm;
    rEntry.totalRetailValue += saldo * pvp;
    rEntry.sizes.set(s, (rEntry.sizes.get(s) || 0) + saldo);
    rEntry.colors.add(item.color);
    rEntry.bodegas.add(b);

    // Heatmap: referencia + color -> sizes
    const heatKey = `${item.referencia}||${item.color}`;
    if (!heatmapMap.has(heatKey)) {
      heatmapMap.set(heatKey, {
        referencia: item.referencia,
        descripcion: item.descripcion,
        color: item.color,
        sizes: {},
        totalStock: 0,
        pvm: item.pvm || 0,
        pvp: item.pvp || 0,
        costoFabricacion: fabCost,
      });
    }
    const hEntry = heatmapMap.get(heatKey)!;
    hEntry.sizes[s] = (hEntry.sizes[s] || 0) + saldo;
    hEntry.totalStock += saldo;
  }

  // Broken size run calculation
  let brokenRefsCount = 0;
  refMap.forEach((ref) => {
    if (ref.totalStock > 0 && ref.sizes.size > 1) {
      const hasZero = Array.from(ref.sizes.values()).some((qty) => qty === 0);
      if (hasZero) {
        ref.isBrokenSizeRun = true;
        brokenRefsCount++;
      }
    }
  });

  const totalSKUs = data.length;
  const activeSKUs = data.filter((r) => r.saldo > 0).length;
  const theoreticalMarginPct =
    totalRetailValue > 0
      ? ((totalRetailValue - totalCostValue) / totalRetailValue) * 100
      : 0;
  const brokenSizeRate =
    refMap.size > 0 ? (brokenRefsCount / refMap.size) * 100 : 0;
  const orphanSkuRatio =
    activeSKUs > 0 ? (healthCounts.orphan / activeSKUs) * 100 : 0;
  const healthyTotal = healthCounts.healthy + healthCounts.overstock;
  const healthyStockPct =
    activeSKUs > 0 ? (healthyTotal / activeSKUs) * 100 : 0;

  const overstockCapitalValue = data
    .filter((r) => r.saldo > HEALTHY_MAX)
    .reduce((acc, r) => acc + r.saldo * r.pvm, 0);

  // Sort references for top overstock/understock
  const refsArray = Array.from(refMap.values());
  const topOverstock = refsArray
    .filter((r) => r.totalStock > HEALTHY_MAX)
    .sort((a, b) => b.totalCostValue - a.totalCostValue)
    .slice(0, 10);
  const topUnderstock = refsArray
    .filter((r) => r.totalStock > 0 && r.totalStock <= LOW_STOCK_MAX)
    .sort((a, b) => a.totalStock - b.totalStock)
    .slice(0, 10);

  // Sort size curve naturally
  const sizeCurve = Array.from(sizeMap.entries())
    .map(([size, units]) => ({ size, units }))
    .sort((a, b) => sizeSort(a.size, b.size));

  // Collect ALL sizes across the entire catalog
  const allSizes = Array.from(allTallas).sort(sizeSort);

  // Color distribution sorted by units desc
  const colorDistribution = Array.from(colorMap.entries())
    .map(([color, units]) => ({ color, units }))
    .sort((a, b) => b.units - a.units);

  // Bodega distribution sorted by units desc
  const bodegaDistribution = Array.from(bodegaMap.entries())
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.units - a.units);

  // Heatmap rows sorted by total stock desc
  const sizeHeatmap = Array.from(heatmapMap.values())
    .sort((a, b) => b.totalStock - a.totalStock);

  return {
    kpis: {
      totalUnits,
      totalSkus: totalSKUs,
      uniqueReferences: refMap.size,
      totalCostValue,
      totalRetailValue,
      totalUsdValue,
      theoreticalMarginPct,
      brokenSizeRate,
      orphanSkuRatio,
      healthyStockPct,
      weightedAupRetail: totalUnits > 0 ? totalRetailValue / totalUnits : 0,
      weightedAupCost: totalUnits > 0 ? totalCostValue / totalUnits : 0,
      overstockCapitalValue,
    },
    healthBreakdown: healthCounts,
    bodegaDistribution,
    sizeCurve,
    colorDistribution,
    topOverstock,
    topUnderstock,
    sizeHeatmap,
    allSizes,
    availableBodegas: Array.from(allBodegas).sort(),
    availableTallas: Array.from(allTallas).sort(sizeSort),
    availableColors: Array.from(allColors).sort(),
    maxPvp,
  };
}

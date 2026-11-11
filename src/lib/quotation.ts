import * as XLSX from "xlsx";
import { formatCurrency, formatUsd, type InventoryRow } from "./inventory";
import type { OrderItem } from "./order";
import {
  TRUCCOS_BRAND_INFO,
  TRUCCOS_LOGO_WIDTH,
  TRUCCOS_LOGO_HEIGHT,
  TRUCCOS_LOGO_JPEG_BASE64,
  base64ToUint8Array,
} from "./brandAssets";

export type QuotationCurrency = "COP" | "USD";
export type CopPriceType = "AUTO" | "PVM" | "PVP";

export type QuotationTier = "detal" | "descuento_30" | "mayorista";

export interface QuotationTierInfo {
  tier: QuotationTier;
  label: string;
  badge: string;
  discountPercentage: number;
  description: string;
  nextTierPrompt?: string;
  unitsToNextTier?: number;
  progressPercent: number;
}

export function getQuotationTier(totalUnits: number): QuotationTierInfo {
  if (totalUnits < 12) {
    const unitsToNextTier = 12 - totalUnits;
    return {
      tier: "detal",
      label: "Precio Detal (Sin Descuento)",
      badge: "Detal",
      discountPercentage: 0,
      description: "Menos de 12 unidades: aplica precio detal sin descuento.",
      unitsToNextTier,
      nextTierPrompt: `Agrega ${unitsToNextTier} ${
        unitsToNextTier === 1 ? "unidad más" : "unidades más"
      } para activar 30% de descuento sobre detal.`,
      progressPercent: Math.max(0, Math.min(100, Math.round((totalUnits / 12) * 100))),
    };
  }

  if (totalUnits <= 23) {
    const unitsToNextTier = 24 - totalUnits;
    return {
      tier: "descuento_30",
      label: "30% Descuento sobre Detal",
      badge: "-30% Dto",
      discountPercentage: 30,
      description: "De 12 a 23 unidades: 30% de descuento sobre el precio detal.",
      unitsToNextTier,
      nextTierPrompt: `Agrega ${unitsToNextTier} ${
        unitsToNextTier === 1 ? "unidad más" : "unidades más"
      } para alcanzar Precio Mayorista.`,
      progressPercent: Math.max(
        0,
        Math.min(100, Math.round(((totalUnits - 12) / (24 - 12)) * 100))
      ),
    };
  }

  return {
    tier: "mayorista",
    label: "Precio Mayorista (PVM)",
    badge: "Mayorista",
    discountPercentage: 0,
    description: "24 o más unidades: las prendas quedan con precio mayorista.",
    unitsToNextTier: 0,
    nextTierPrompt: undefined,
    progressPercent: 100,
  };
}

export function calculateItemUnitPrice(
  item: { pvm: number; pvp?: number; precioUsd?: number },
  totalUnits: number
): number {
  const pvm = Number(item.pvm) || 0;
  const pvp = Number(item.pvp) || pvm;

  if (totalUnits < 12) {
    return pvp > 0 ? pvp : pvm;
  }
  if (totalUnits <= 23) {
    const baseDetal = pvp > 0 ? pvp : pvm;
    const discount = Math.round(baseDetal * 0.3);
    return Math.max(0, baseDetal - discount);
  }
  return pvm > 0 ? pvm : pvp;
}

export function getItemUsdPrice(item: { precioUsd?: number }): number {
  return Number(item.precioUsd) || 0;
}

export interface QuotationItemSummary {
  sku: string;
  referencia: string;
  descripcion: string;
  color: string;
  talla: string;
  cantidad: number;
  basePvp?: number;
  basePvm?: number;
  unitDiscount?: number;
  discountPercentage?: number;
  unitPrice: number; // Precio unitario antes de IVA
  precioAntesIva: number; // Alias explícito: Precio antes de IVA
  precioUnitIvaInc: number; // Precio unitario con IVA incluido (unitPrice * 1.19)
  totalPrice: number; // Subtotal neto antes de IVA (cantidad * unitPrice)
  ivaRate: number; // Tasa de IVA (0.19)
  unitIva: number; // IVA por unidad
  lineIva: number; // IVA total de la fila (cantidad * unitIva)
  totalPriceWithIva: number; // Total de la fila con IVA incluido (cantidad * precioUnitIvaInc)
  currency: QuotationCurrency;
  formattedUnitPrice: string;
  formattedPrecioAntesIva: string; // Formato: Precio antes de IVA
  formattedPrecioUnitIvaInc: string; // Formato: Precio unitario IVA incluido
  formattedTotalPrice: string; // Subtotal neto formateado
  formattedIva: string; // IVA de la fila formateado
  formattedTotalPriceWithIva: string; // Total con IVA formateado
}

export interface QuotationConfig {
  currency: QuotationCurrency;
  copPriceType?: CopPriceType;
  customerName?: string;
  advisorName?: string;
  notes?: string;
}

export interface QuotationData {
  quotationNumber: string;
  date: Date;
  dateFormatted: string;
  customerName: string;
  advisorName: string;
  notes: string;
  currency: QuotationCurrency;
  copPriceType: CopPriceType;
  tierInfo: QuotationTierInfo;
  items: QuotationItemSummary[];
  totalUnits: number;
  totalReferences: number;
  subtotalDetal: number;
  totalDiscount: number;
  subtotalBase: number; // Suma de todos los subtotales netos de prendas antes de IVA
  subtotalAntesIva: number; // Alias explícito: Subtotal antes de IVA
  totalIva: number; // Suma de todas las cantidades del IVA (19%)
  totalWithIva: number; // Total general con IVA incluido (subtotalBase + totalIva)
  totalAmount: number; // Total general
  formattedSubtotalDetal: string;
  formattedTotalDiscount: string;
  formattedSubtotalBase: string;
  formattedSubtotalAntesIva: string;
  formattedTotalIva: string; // Celda donde se suman todas las cantidades del IVA
  formattedTotalWithIva: string;
  formattedTotal: string;
}

export function calculateQuotationSummary(
  items: Array<{
    pvm: number;
    pvp?: number;
    precioUsd?: number;
    cantidad: number;
    sku?: string;
    referencia?: string;
  }>
) {
  const activeItems = items.filter((it) => (Number(it.cantidad) || 0) > 0);
  const totalUnits = activeItems.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
  const tierInfo = getQuotationTier(totalUnits);

  let subtotalDetal = 0;
  let subtotalMayorista = 0;
  let totalAmount = 0;
  let totalUsd = 0;
  let hasUsdPrices = false;

  const itemPrices = items.map((item) => {
    const qty = Number(item.cantidad) || 0;
    const pvm = Number(item.pvm) || 0;
    const pvp = Number(item.pvp) || pvm;
    const usd = getItemUsdPrice(item);

    if (usd > 0) hasUsdPrices = true;

    const unitPriceCop = calculateItemUnitPrice(item, totalUnits);
    const unitDiscountCop = Math.max(0, pvp - unitPriceCop);
    const lineTotalCop = unitPriceCop * qty;
    const lineTotalUsd = usd * qty;

    subtotalDetal += pvp * qty;
    subtotalMayorista += pvm * qty;
    totalAmount += lineTotalCop;
    totalUsd += lineTotalUsd;

    return {
      sku: item.sku || "",
      referencia: item.referencia || "",
      cantidad: qty,
      basePvp: pvp,
      basePvm: pvm,
      unitPriceCop,
      unitDiscountCop,
      lineTotalCop,
      unitPriceUsd: usd,
      lineTotalUsd,
    };
  });

  const totalSavings = Math.max(0, subtotalDetal - totalAmount);

  return {
    totalUnits,
    tierInfo,
    subtotalDetal,
    subtotalMayorista,
    totalAmount,
    totalSavings,
    totalUsd,
    hasUsdPrices,
    itemPrices,
  };
}

/**
 * Calculates item and total prices based on the commercial quotation rules:
 * - < 12 units: Detal price (PVP) without discount.
 * - 12 - 23 units: 30% discount applied solely to retail price (PVP).
 * - >= 24 units: Wholesale price (PVM).
 * - USD currency: completely untouched, no discounts applied.
 */
export function buildQuotationData(
  items: OrderItem[],
  config: QuotationConfig,
  inventoryLookup?: Record<string, InventoryRow>
): QuotationData {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const dateFormatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const quotationNumber = `COT-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${randomSuffix}`;

  const isUsd = config.currency === "USD";
  const trmFallback = 4000;

  const activeItems = items.filter((it) => it.cantidad > 0);
  const totalUnits = activeItems.reduce((sum, it) => sum + it.cantidad, 0);
  const tierInfo = getQuotationTier(totalUnits);

  const itemSummaries: QuotationItemSummary[] = activeItems.map((it) => {
    const invRow = inventoryLookup?.[it.sku];
    const basePvp = it.pvp ?? invRow?.pvp ?? it.pvm ?? invRow?.pvm ?? 0;
    const basePvm = it.pvm ?? invRow?.pvm ?? 0;
    let unitPrice = 0;
    let unitDiscount = 0;
    let discountPercentage = 0;

    if (isUsd) {
      // Regla: No tocar precios en dólares. Se mantienen fijos sin descuentos.
      if (it.precioUsd && it.precioUsd > 0) {
        unitPrice = it.precioUsd;
      } else if (invRow?.precioUsd && invRow.precioUsd > 0) {
        unitPrice = invRow.precioUsd;
      } else {
        unitPrice = Math.ceil(((basePvm / 1.19 + 1000) / trmFallback) * 100) / 100;
      }
    } else {
      // En COP aplican las condiciones de cotización:
      // - < 12 unidades: sin descuento (PVP detal)
      // - 12 a 23 unidades: 30% descuento sobre detal
      // - >= 24 unidades: precio mayorista (PVM)
      if (totalUnits < 12) {
        unitPrice = basePvp > 0 ? basePvp : basePvm;
        unitDiscount = 0;
        discountPercentage = 0;
      } else if (totalUnits <= 23) {
        const pvpRef = basePvp > 0 ? basePvp : basePvm;
        unitDiscount = Math.round(pvpRef * 0.3);
        unitPrice = Math.max(0, pvpRef - unitDiscount);
        discountPercentage = 30;
      } else {
        unitPrice = basePvm > 0 ? basePvm : basePvp;
        unitDiscount = Math.max(0, basePvp - basePvm);
        discountPercentage = 0;
      }
    }

    // Calculation required: units * price
    const subtotalLine = it.cantidad * unitPrice;
    const ivaRate = 0.19;
    const precioUnitIvaInc = isUsd
      ? Math.round(unitPrice * 1.19 * 100) / 100
      : Math.round(unitPrice * 1.19);
    const totalPriceWithIva = isUsd
      ? Math.round(it.cantidad * precioUnitIvaInc * 100) / 100
      : Math.round(it.cantidad * precioUnitIvaInc);
    const lineIva = totalPriceWithIva - subtotalLine;
    const unitIva = precioUnitIvaInc - unitPrice;

    return {
      sku: it.sku,
      referencia: it.referencia,
      descripcion: it.descripcion,
      color: it.color,
      talla: it.talla,
      cantidad: it.cantidad,
      basePvp,
      basePvm,
      unitDiscount,
      discountPercentage,
      unitPrice,
      precioAntesIva: unitPrice,
      precioUnitIvaInc,
      totalPrice: subtotalLine,
      ivaRate,
      unitIva,
      lineIva,
      totalPriceWithIva,
      currency: config.currency,
      formattedUnitPrice: isUsd ? formatUsd(unitPrice) : formatCurrency(unitPrice),
      formattedPrecioAntesIva: isUsd ? formatUsd(unitPrice) : formatCurrency(unitPrice),
      formattedPrecioUnitIvaInc: isUsd ? formatUsd(precioUnitIvaInc) : formatCurrency(precioUnitIvaInc),
      formattedTotalPrice: isUsd ? formatUsd(subtotalLine) : formatCurrency(subtotalLine),
      formattedIva: isUsd ? formatUsd(lineIva) : formatCurrency(lineIva),
      formattedTotalPriceWithIva: isUsd ? formatUsd(totalPriceWithIva) : formatCurrency(totalPriceWithIva),
    };
  });

  const subtotalBase = itemSummaries.reduce((sum, it) => sum + it.totalPrice, 0);
  const totalIva = itemSummaries.reduce((sum, it) => sum + it.lineIva, 0);
  const totalWithIva = subtotalBase + totalIva;
  const subtotalDetal = itemSummaries.reduce(
    (sum, it) => sum + (it.basePvp || it.unitPrice) * it.cantidad,
    0
  );
  const totalDiscount = isUsd ? 0 : Math.max(0, subtotalDetal - subtotalBase);
  const distinctRefs = new Set(itemSummaries.map((it) => it.referencia)).size;

  return {
    quotationNumber,
    date: now,
    dateFormatted,
    customerName: (config.customerName || "").trim() || "Cliente Comercial",
    advisorName: (config.advisorName || "").trim() || "Asesor Trucco's Jeans",
    notes: (config.notes || "").trim() || "Cotización comercial sujeta a disponibilidad de inventario.",
    currency: config.currency,
    copPriceType: config.copPriceType || "AUTO",
    tierInfo,
    items: itemSummaries,
    totalUnits,
    totalReferences: distinctRefs,
    subtotalDetal,
    totalDiscount,
    subtotalBase,
    subtotalAntesIva: subtotalBase,
    totalIva,
    totalWithIva,
    totalAmount: totalWithIva,
    formattedSubtotalDetal: formatCurrency(subtotalDetal),
    formattedTotalDiscount: formatCurrency(totalDiscount),
    formattedSubtotalBase: isUsd ? formatUsd(subtotalBase) : formatCurrency(subtotalBase),
    formattedSubtotalAntesIva: isUsd ? formatUsd(subtotalBase) : formatCurrency(subtotalBase),
    formattedTotalIva: isUsd ? formatUsd(totalIva) : formatCurrency(totalIva),
    formattedTotalWithIva: isUsd ? formatUsd(totalWithIva) : formatCurrency(totalWithIva),
    formattedTotal: isUsd ? formatUsd(totalWithIva) : formatCurrency(totalWithIva),
  };
}

/**
 * Generates and downloads a clean, formatted Excel spreadsheet (.xlsx).
 */
export function downloadQuotationExcel(quotation: QuotationData): void {
  const isUsd = quotation.currency === "USD";
  const currencyLabel = isUsd
    ? "Dólares Americanos (USD) - Tarifa fija internacional"
    : `Pesos Colombianos (COP) - Escala: ${quotation.tierInfo.label}`;

  const aoa: (string | number)[][] = [
    ["TRUCCO'S JEANS - COMERCIAL TRUCCOS S.A.S. (NIT 900.228.614-1)"],
    ["COTIZACIÓN COMERCIAL"],
    ["Cra 56 # 46-49 Ed. Pompano Of. 901, Medellín - Colombia | www.truccos.com.co"],
    [],
    ["N° Cotización:", quotation.quotationNumber, "", "Fecha:", quotation.dateFormatted],
    ["Asesor Comercial:", quotation.advisorName, "", "Moneda:", currencyLabel],
    ["Cliente:", quotation.customerName],
    ["Condiciones:", quotation.notes],
    [],
    [
      "#",
      "REF",
      "DESCRIPCION",
      "COLOR",
      "TALLA",
      "CANTIDAD",
      `PRECIO ANTES DE IVA (${quotation.currency})`,
      `PRECIO UNITARIO IVA INCLUIDO (${quotation.currency})`,
      `TOTAL (${quotation.currency})`,
    ],
  ];

  quotation.items.forEach((it, idx) => {
    aoa.push([
      idx + 1,
      it.referencia,
      it.descripcion,
      it.color,
      it.talla,
      it.cantidad,
      it.unitPrice,
      it.precioUnitIvaInc,
      it.totalPriceWithIva,
    ]);
  });

  aoa.push([]);
  if (!isUsd && quotation.totalDiscount > 0) {
    aoa.push([
      "",
      "",
      "",
      "",
      "Subtotal Detal:",
      "",
      "",
      "",
      quotation.subtotalDetal,
    ]);
    aoa.push([
      "",
      "",
      "",
      "",
      `Descuento aplicado (${quotation.tierInfo.badge}):`,
      "",
      "",
      "",
      -quotation.totalDiscount,
    ]);
  }
  aoa.push([
    "",
    "",
    "",
    "",
    "SUBTOTAL ANTES DE IVA:",
    "",
    "",
    "",
    quotation.subtotalAntesIva,
  ]);
  aoa.push([
    "",
    "",
    "",
    "",
    "TOTAL IVA (19%):",
    "",
    "",
    "",
    quotation.totalIva,
  ]);
  aoa.push([
    "",
    "",
    "",
    "",
    "TOTAL UNIDADES:",
    quotation.totalUnits,
    "",
    `TOTAL COTIZACIÓN (${quotation.currency}):`,
    quotation.totalWithIva,
  ]);
  aoa.push([]);
  aoa.push(["* Precios calculados con el 19% del IVA agregado según formato comercial."]);
  aoa.push(["* Cotización válida por 15 días calendario. Sujeta a rotación de inventario."]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set explicit column widths for readability
  ws["!cols"] = [
    { wch: 5 },  // #
    { wch: 16 }, // REF
    { wch: 34 }, // DESCRIPCION
    { wch: 16 }, // COLOR
    { wch: 10 }, // TALLA
    { wch: 14 }, // CANTIDAD
    { wch: 24 }, // PRECIO ANTES DE IVA
    { wch: 28 }, // PRECIO UNITARIO IVA INCLUIDO
    { wch: 22 }, // TOTAL
  ];

  // Force string format on Referencia and Talla columns
  for (let r = 9; r < 9 + quotation.items.length; r++) {
    const cellRef = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cellRef) cellRef.t = "s";
    const cellTalla = ws[XLSX.utils.encode_cell({ r, c: 4 })];
    if (cellTalla) cellTalla.t = "s";
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotización");

  const cleanName = quotation.customerName.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const filename = `COTIZACION_${cleanName}_${quotation.currency}_${quotation.quotationNumber}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Cleans text for PDF output:
 * - Replaces '@' with 'A' (e.g. CLASIC@ -> CLASICA)
 * - Normalizes accents and diacritics to basic ASCII for standard Helvetica
 * - Strips unprintable control characters
 */
function cleanText(str: string): string {
  if (!str) return "";
  return str
    .replace(/@/g, "A")
    .replace(/[áàäâã]/gi, "a")
    .replace(/[éèëê]/gi, "e")
    .replace(/[íìïî]/gi, "i")
    .replace(/[óòöôõ]/gi, "o")
    .replace(/[úùüû]/gi, "u")
    .replace(/ñ/gi, "N")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Escapes characters for PDF stream strings.
 */
function escapePdf(str: string): string {
  return cleanText(str)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Wraps text into lines with at most maxCharsPerLine, preserving whole words.
 */
function wrapTextToLines(text: string, maxCharsPerLine: number = 74): string[] {
  if (!text) return [];
  const rawParagraphs = text.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];
  for (const para of rawParagraphs) {
    const cleaned = cleanText(para);
    if (!cleaned) continue;
    const words = cleaned.split(" ").filter(Boolean);
    let currentLine = "";
    for (const w of words) {
      if ((currentLine + " " + w).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + " " + w).trim();
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Pure TypeScript PDF 1.4 Vector Generator.
 * Produces an authentic, high-end fashion brand quotation PDF using official
 * Trucco's Jeans (https://truccos.com.co/) brand colors and embedded vector logo.
 */
export function generateQuotationPdfBlob(quotation: QuotationData): Blob {
  const pageWidth = 612; // Letter width
  const pageHeight = 792; // Letter height
  const marginLeft = 36;
  const marginRight = 576; // 612 - 36
  const usableWidth = marginRight - marginLeft; // 540 pt

  const isUsd = quotation.currency === "USD";
  const currencyBadgeText = isUsd
    ? "DOLARES (USD)"
    : `COP - ${quotation.tierInfo.badge.toUpperCase()}`;

  // Pagination planning
  const rowsPerPageFirst = 16;
  const rowsPerPageNext = 24;

  const totalItems = quotation.items.length;
  let totalPages = 1;
  if (totalItems > rowsPerPageFirst) {
    totalPages = 1 + Math.ceil((totalItems - rowsPerPageFirst) / rowsPerPageNext);
  }

  // Decode official brand logo JPEG into binary buffer
  const jpegBuffer = base64ToUint8Array(TRUCCOS_LOGO_JPEG_BASE64);

  const pageStreams: string[] = [];
  let itemIndex = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const isLastPage = pageNum === totalPages;
    let s = "";

    // 1. Top Brand Accent Line (Slate Gray #475569)
    s += "q\n";
    s += "0.30 0.35 0.42 rg\n";
    s += `${marginLeft} ${pageHeight - 34} ${usableWidth} 3.5 re f\n`;
    s += "Q\n";

    // 2. Modern Header with Official Logo and Brand Identity
    s += "q\n";
    // Draw Logo on the left: 62 pt width, 35 pt height
    const logoW = 62;
    const logoH = 35;
    const logoX = marginLeft;
    const logoY = pageHeight - 82;
    s += `${logoW} 0 0 ${logoH} ${logoX} ${logoY} cm\n`;
    s += "/ImLogo Do\n";
    s += "Q\n";

    // Text right of logo
    const textStartX = marginLeft + 72;
    s += "q\n";
    s += "0.04 0.04 0.04 rg\n"; // Deep Noir #0B0B0B
    s += `BT /F2 17 Tf ${textStartX} ${pageHeight - 56} Td (TRUCCO'S JEANS) Tj ET\n`;

    s += "0.35 0.40 0.48 rg\n"; // Slate Gray Subtitle
    s += `BT /F2 7.5 Tf ${textStartX} ${pageHeight - 69} Td (COMERCIAL TRUCCOS S.A.S.  |  NIT 900.228.614-1) Tj ET\n`;

    s += "0.45 0.45 0.50 rg\n"; // Address and web
    s += `BT /F1 7 Tf ${textStartX} ${pageHeight - 80} Td (Cra 56 # 46-49 Ed. Pompano Of. 901 Medellin  *  www.truccos.com.co) Tj ET\n`;

    // Right Header Badge Card (Folio & Date)
    const badgeX = 390;
    const badgeW = 186;
    const badgeH = 48;
    const badgeY = pageHeight - 85;

    s += "0.98 0.98 0.99 rg\n"; // Soft off-white
    s += "0.85 0.85 0.88 RG 0.6 w\n";
    s += `${badgeX} ${badgeY} ${badgeW} ${badgeH} re b\n`;

    // Slate Gray Accent Stripe on card
    s += "0.30 0.35 0.42 rg\n";
    s += `${badgeX} ${badgeY + badgeH - 3} ${badgeW} 3 re f\n`;

    s += "0.04 0.04 0.04 rg\n";
    s += `BT /F2 9.5 Tf ${badgeX + 10} ${badgeY + 30} Td (COTIZACION COMERCIAL) Tj ET\n`;
    s += "0.45 0.45 0.50 rg\n";
    s += `BT /F1 7.5 Tf ${badgeX + 10} ${badgeY + 17} Td (Folio:) Tj ET\n`;
    s += "0.04 0.04 0.04 rg\n";
    s += `BT /F2 8 Tf ${badgeX + 38} ${badgeY + 17} Td (${escapePdf(quotation.quotationNumber)}) Tj ET\n`;
    s += "0.45 0.45 0.50 rg\n";
    s += `BT /F1 7.5 Tf ${badgeX + 10} ${badgeY + 6} Td (Fecha:) Tj ET\n`;
    s += "0.20 0.20 0.25 rg\n";
    s += `BT /F2 7.5 Tf ${badgeX + 44} ${badgeY + 6} Td (${escapePdf(quotation.dateFormatted)}) Tj ET\n`;
    s += "Q\n";

    // Divider rule
    s += "q\n";
    s += "0.88 0.88 0.90 RG 0.5 w\n";
    s += `${marginLeft} ${pageHeight - 95} m ${marginRight} ${pageHeight - 95} l S\n`;
    s += "Q\n";

    let currentY = pageHeight - 105;

    // 3. Info Cards (First page only)
    if (isFirstPage) {
      const cardH = 50;
      const leftW = 296;
      const rightX = 344;
      const rightW = 232;

      s += "q\n";
      // Left Card: Customer & Advisor Info
      s += "0.98 0.98 0.99 rg\n";
      s += "0.86 0.86 0.89 RG 0.6 w\n";
      s += `${marginLeft} ${currentY - cardH} ${leftW} ${cardH} re b\n`;

      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.5 Tf ${marginLeft + 10} ${currentY - 14} Td (INFORMACION DEL CLIENTE) Tj ET\n`;

      s += "0.45 0.45 0.50 rg\n";
      s += `BT /F1 7.5 Tf ${marginLeft + 10} ${currentY - 28} Td (Cliente:) Tj ET\n`;
      s += "0.04 0.04 0.04 rg\n";
      const customerText = escapePdf(quotation.customerName);
      const displayCustomer = customerText.length > 34 ? customerText.substring(0, 32) + ".." : customerText;
      s += `BT /F2 8.5 Tf ${marginLeft + 46} ${currentY - 28} Td (${displayCustomer}) Tj ET\n`;

      s += "0.45 0.45 0.50 rg\n";
      s += `BT /F1 7.5 Tf ${marginLeft + 10} ${currentY - 42} Td (Asesor:) Tj ET\n`;
      s += "0.20 0.20 0.25 rg\n";
      const advisorText = escapePdf(quotation.advisorName);
      const displayAdvisor = advisorText.length > 34 ? advisorText.substring(0, 32) + ".." : advisorText;
      s += `BT /F2 8 Tf ${marginLeft + 46} ${currentY - 42} Td (${displayAdvisor}) Tj ET\n`;

      // Right Card: Commercial Conditions (Sophisticated Gray Accent)
      s += "0.965 0.972 0.982 rg\n"; // Soft clean gray background
      s += "0.80 0.83 0.88 RG 0.6 w\n"; // Sleek gray border
      s += `${rightX} ${currentY - cardH} ${rightW} ${cardH} re b\n`;

      s += "0.20 0.25 0.35 rg\n"; // Dark Slate Gray Title
      s += `BT /F2 7.5 Tf ${rightX + 10} ${currentY - 14} Td (CONDICIONES COMERCIALES) Tj ET\n`;

      s += "0.40 0.40 0.45 rg\n";
      s += `BT /F1 7.5 Tf ${rightX + 10} ${currentY - 28} Td (Moneda:) Tj ET\n`;
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 8 Tf ${rightX + 50} ${currentY - 28} Td (${escapePdf(currencyBadgeText)}) Tj ET\n`;

      s += "0.40 0.40 0.45 rg\n";
      s += `BT /F1 7.5 Tf ${rightX + 10} ${currentY - 42} Td (Resumen:) Tj ET\n`;
      s += "0.20 0.25 0.35 rg\n";
      s += `BT /F2 8 Tf ${rightX + 50} ${currentY - 42} Td (${quotation.totalReferences} refs  *  ${quotation.totalUnits} unidades en total) Tj ET\n`;
      s += "Q\n";

      currentY -= cardH + 12;
    }

    // 4. Products Table Headers (Formato oficial Trucco's: REF, DESCRIPCION, COLOR, TALLA, CANTIDAD, PRECIO ANTES DE IVA, PRECIO UNITARIO IVA INCLUIDO, TOTAL)
    const colX = {
      num: 36, // w: 16 -> 52
      ref: 52, // w: 56 -> 108
      desc: 108, // w: 122 -> 230
      col: 230, // w: 50 -> 280
      talla: 280, // w: 24 -> 304
      cant: 304, // w: 26 -> 330
      precioAntesIva: 330, // w: 74 -> 404
      precioUnitIvaInc: 404, // w: 84 -> 488
      tot: 488, // w: 88 -> 576
    };

    const headerH = 19;
    s += "q\n";
    s += "0.05 0.05 0.06 rg\n"; // Deep Noir #0D0D10
    s += `${marginLeft} ${currentY - headerH} ${usableWidth} ${headerH} re f\n`;

    // Slate Gray accent line under table header
    s += "0.35 0.40 0.48 rg\n";
    s += `${marginLeft} ${currentY - headerH} ${usableWidth} 1.5 re f\n`;

    s += "1 1 1 rg\n";
    s += `BT /F2 6.5 Tf ${colX.num + 4} ${currentY - 13} Td (#) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${colX.ref + 3} ${currentY - 13} Td (REF) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${colX.desc + 3} ${currentY - 13} Td (DESCRIPCION) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${colX.col + 3} ${currentY - 13} Td (COLOR) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${colX.talla + 3} ${currentY - 13} Td (TALLA) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${colX.cant + 3} ${currentY - 13} Td (CANT) Tj ET\n`;
    s += `BT /F2 5.8 Tf ${colX.precioAntesIva + 6} ${currentY - 13} Td (PRECIO ANTES IVA) Tj ET\n`;
    s += `BT /F2 5.8 Tf ${colX.precioUnitIvaInc + 4} ${currentY - 13} Td (P. UNIT. IVA INCLUIDO) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${colX.tot + 26} ${currentY - 13} Td (TOTAL) Tj ET\n`;
    s += "Q\n";

    currentY -= headerH;

    // 5. Table Rows
    const rowsThisPage = isFirstPage ? rowsPerPageFirst : rowsPerPageNext;
    const pageItemEnd = Math.min(totalItems, itemIndex + rowsThisPage);
    const rowH = 17;

    for (let i = itemIndex; i < pageItemEnd; i++) {
      const it = quotation.items[i];
      const isZebra = i % 2 === 1;

      s += "q\n";
      if (isZebra) {
        s += "0.975 0.978 0.985 rg\n"; // Subtle stripe
        s += `${marginLeft} ${currentY - rowH} ${usableWidth} ${rowH} re f\n`;
      }

      // Hairline row separator
      s += "0.90 0.90 0.92 RG 0.4 w\n";
      s += `${marginLeft} ${currentY - rowH} m ${marginRight} ${currentY - rowH} l S\n`;

      // Index (#)
      s += "0.50 0.50 0.55 rg\n";
      s += `BT /F1 7 Tf ${colX.num + 4} ${currentY - 11.5} Td (${i + 1}) Tj ET\n`;

      // Reference (REF)
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.2 Tf ${colX.ref + 3} ${currentY - 11.5} Td (${escapePdf(it.referencia)}) Tj ET\n`;

      // Description (DESCRIPCION)
      const descClean = it.descripcion.length > 25 ? it.descripcion.substring(0, 23) + ".." : it.descripcion;
      s += "0.15 0.15 0.18 rg\n";
      s += `BT /F1 7.2 Tf ${colX.desc + 3} ${currentY - 11.5} Td (${escapePdf(descClean)}) Tj ET\n`;

      // Color (COLOR)
      const colClean = it.color.length > 13 ? it.color.substring(0, 11) + ".." : it.color;
      s += "0.25 0.25 0.30 rg\n";
      s += `BT /F1 7.2 Tf ${colX.col + 3} ${currentY - 11.5} Td (${escapePdf(colClean)}) Tj ET\n`;

      // Talla (TALLA)
      s += "0.04 0.04 0.04 rg\n";
      const tallaStr = escapePdf(it.talla);
      const tallaX = colX.talla + 12 - tallaStr.length * 2.2;
      s += `BT /F2 7.2 Tf ${tallaX} ${currentY - 11.5} Td (${tallaStr}) Tj ET\n`;

      // Cantidad (CANTIDAD)
      const cantStr = String(it.cantidad);
      const cantX = colX.cant + 13 - cantStr.length * 2.5;
      s += `BT /F2 7.5 Tf ${cantX} ${currentY - 11.5} Td (${cantStr}) Tj ET\n`;

      // PRECIO ANTES DE IVA (Right-aligned at 400)
      const pAntesStr = escapePdf(it.formattedPrecioAntesIva);
      const pAntesX = 400 - pAntesStr.length * 4.2;
      s += "0.30 0.30 0.35 rg\n";
      s += `BT /F1 7.2 Tf ${pAntesX} ${currentY - 11.5} Td (${pAntesStr}) Tj ET\n`;

      // PRECIO UNITARIO IVA INCLUIDO (Right-aligned at 484)
      const pUnitIvaStr = escapePdf(it.formattedPrecioUnitIvaInc);
      const pUnitIvaX = 484 - pUnitIvaStr.length * 4.2;
      s += "0.15 0.25 0.35 rg\n";
      s += `BT /F2 7.2 Tf ${pUnitIvaX} ${currentY - 11.5} Td (${pUnitIvaStr}) Tj ET\n`;

      // TOTAL (Right-aligned at 572, bold noir)
      const totStr = escapePdf(it.formattedTotalPriceWithIva);
      const totX = 572 - totStr.length * 4.4;
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.5 Tf ${totX} ${currentY - 11.5} Td (${totStr}) Tj ET\n`;
      s += "Q\n";

      currentY -= rowH;
    }

    itemIndex = pageItemEnd;

    // 6. Summary Totals Cards (Last page only - STRICT SEPARATION, ZERO OVERLAPPING)
    if (isLastPage) {
      // Table Totals Row right below the rows
      const totBarH = 17;
      s += "q\n";
      s += "0.93 0.94 0.96 rg\n"; // Elegant light slate background
      s += `${marginLeft} ${currentY - totBarH} ${usableWidth} ${totBarH} re f\n`;
      s += "0.75 0.78 0.84 RG 0.7 w\n";
      s += `${marginLeft} ${currentY - totBarH} m ${marginRight} ${currentY - totBarH} l S\n`;
      s += `${marginLeft} ${currentY} m ${marginRight} ${currentY} l S\n`;

      s += "0.15 0.20 0.28 rg\n";
      s += `BT /F2 7 Tf ${colX.desc + 3} ${currentY - 11.5} Td (TOTALES TABLA:) Tj ET\n`;

      // Total units in cant column
      const totalUnitsStr = String(quotation.totalUnits);
      const totCantX = colX.cant + 13 - totalUnitsStr.length * 2.5;
      s += `BT /F2 7.5 Tf ${totCantX} ${currentY - 11.5} Td (${totalUnitsStr}) Tj ET\n`;

      // Sum of Subtotal Antes de IVA
      const subAntesStr = escapePdf(quotation.formattedSubtotalAntesIva);
      const subAntesX = 400 - subAntesStr.length * 4.2;
      s += "0.20 0.25 0.30 rg\n";
      s += `BT /F2 7.2 Tf ${subAntesX} ${currentY - 11.5} Td (${subAntesStr}) Tj ET\n`;

      // Sum of Total in Total column
      const totColStr = escapePdf(quotation.formattedTotalWithIva);
      const totColX = 572 - totColStr.length * 4.4;
      s += "0.04 0.04 0.04 rg\n";
      s += `BT /F2 7.5 Tf ${totColX} ${currentY - 11.5} Td (${totColStr}) Tj ET\n`;
      s += "Q\n";
      currentY -= totBarH;

      currentY -= 14;
      const sumH = 96;
      const rightW = 210;
      const leftW = usableWidth - rightW - 12; // 540 - 210 - 12 = 318 pt
      const rightX = marginLeft + leftW + 12; // 366 pt

      s += "q\n";
      // Left Card: Observaciones & Términos
      s += "0.98 0.98 0.99 rg\n";
      s += "0.84 0.85 0.88 RG 0.6 w\n";
      s += `${marginLeft} ${currentY - sumH} ${leftW} ${sumH} re b\n`;

      s += "0.20 0.25 0.35 rg\n";
      s += `BT /F2 7.2 Tf ${marginLeft + 10} ${currentY - 14} Td (OBSERVACIONES Y CONDICIONES COMERCIALES) Tj ET\n`;

      s += "0.42 0.44 0.48 rg\n";
      const noteLines = wrapTextToLines(quotation.notes, 70);
      let lineY = currentY - 26;
      const stepY = 11;
      let linesDrawn = 0;
      const maxLines = 6;

      // Render user notes / comments without truncating
      if (noteLines.length > 0) {
        for (let i = 0; i < noteLines.length && linesDrawn < 2; i++) {
          const prefix = i === 0 ? "* " : "  ";
          const safeLine = escapePdf(noteLines[i]);
          s += `BT /F1 6.8 Tf ${marginLeft + 10} ${lineY} Td (${prefix}${safeLine}) Tj ET\n`;
          lineY -= stepY;
          linesDrawn++;
        }
      }

      s += `BT /F1 6.8 Tf ${marginLeft + 10} ${lineY} Td (* Precios calculados con el 19% del IVA agregado y discriminado.) Tj ET\n`;
      lineY -= stepY;
      linesDrawn++;

      // Standard calendar validity
      if (linesDrawn < maxLines) {
        s += `BT /F1 6.8 Tf ${marginLeft + 10} ${lineY} Td (* Cotizacion valida por 15 dias calendario a partir de su emision.) Tj ET\n`;
        lineY -= stepY;
        linesDrawn++;
      }

      // Standard inventory condition
      if (linesDrawn < maxLines) {
        s += `BT /F1 6.8 Tf ${marginLeft + 10} ${lineY} Td (* Precios y unidades sujetos a rotacion fisica de inventario.) Tj ET\n`;
        lineY -= stepY;
        linesDrawn++;
      }

      // Right Card: Luxury Noir Card (#0D0D10) with Slate Gray Accent
      s += "0.05 0.05 0.06 rg\n";
      s += `${rightX} ${currentY - sumH} ${rightW} ${sumH} re f\n`;

      // Top Slate Gray Stripe on total card
      s += "0.45 0.50 0.58 rg\n";
      s += `${rightX} ${currentY - 3} ${rightW} 3 re f\n`;

      // Row 1: Unidades
      s += "0.75 0.75 0.80 rg\n";
      s += `BT /F1 7.2 Tf ${rightX + 12} ${currentY - 16} Td (UNIDADES SELECCIONADAS:) Tj ET\n`;
      s += "1 1 1 rg\n";
      const unitsStr = `${quotation.totalUnits} uds. (${quotation.totalReferences} refs)`;
      const unitsX = rightX + rightW - 12 - unitsStr.length * 4.6;
      s += `BT /F2 8 Tf ${unitsX} ${currentY - 16} Td (${unitsStr}) Tj ET\n`;

      // Row 2: Subtotal Neto (antes de IVA)
      s += "0.75 0.75 0.80 rg\n";
      s += `BT /F1 7.2 Tf ${rightX + 12} ${currentY - 29} Td (SUBTOTAL NETO:) Tj ET\n`;
      s += "1 1 1 rg\n";
      const subNetoStr = escapePdf(quotation.formattedSubtotalBase);
      const subNetoX = rightX + rightW - 12 - subNetoStr.length * 4.8;
      s += `BT /F2 8.5 Tf ${subNetoX} ${currentY - 29} Td (${subNetoStr}) Tj ET\n`;

      // Row 3: TOTAL IVA (19%) - CELDA DONDE SE SUMEN TODAS LAS CANTIDADES DEL IVA
      s += "0.65 0.80 0.95 rg\n"; // Light slate cyan highlight
      s += `BT /F2 7.5 Tf ${rightX + 12} ${currentY - 43} Td (TOTAL IVA (19%):) Tj ET\n`;
      s += "0.68 0.85 1.0 rg\n"; // Highlighted crisp color for IVA total
      const totIvaStr = escapePdf(quotation.formattedTotalIva);
      const totIvaX = rightX + rightW - 12 - totIvaStr.length * 5.0;
      s += `BT /F2 9 Tf ${totIvaX} ${currentY - 43} Td (${totIvaStr}) Tj ET\n`;

      // Hairline divider in card
      s += "0.22 0.22 0.28 RG 0.5 w\n";
      s += `${rightX + 12} ${currentY - 54} m ${rightX + rightW - 12} ${currentY - 54} l S\n`;

      // Row 4: Grand Total Cotización (con IVA incluido)
      s += "0.90 0.90 0.95 rg\n";
      s += `BT /F2 8 Tf ${rightX + 12} ${currentY - 73} Td (TOTAL COTIZACION:) Tj ET\n`;

      s += "1 1 1 rg\n"; // Crisp pure white amount
      const totGrandStr = escapePdf(quotation.formattedTotalWithIva);
      const totGrandX = rightX + rightW - 12 - totGrandStr.length * 7.5;
      s += `BT /F2 13.5 Tf ${totGrandX} ${currentY - 74} Td (${totGrandStr}) Tj ET\n`;
      s += "Q\n";
    }

    // 7. Footer
    s += "q\n";
    s += "0.88 0.88 0.90 RG 0.5 w\n";
    s += `${marginLeft} 45 m ${marginRight} 45 l S\n`;
    s += "0.50 0.50 0.55 rg\n";
    s += `BT /F1 6.5 Tf ${marginLeft} 33 Td (Trucco's Jeans  *  Comercial Truccos S.A.S.  *  NIT 900.228.614-1  *  Medellin, Colombia  *  www.truccos.com.co) Tj ET\n`;
    s += `BT /F2 6.5 Tf ${marginRight - 65} 33 Td (Pagina ${pageNum} de ${totalPages}) Tj ET\n`;
    s += "Q\n";

    pageStreams.push(s);
  }

  // Build PDF document objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5: Image XObject (ImLogo)
  // 6.. : Page and Stream objects

  const catalogObjIndex = 1;
  const pagesObjIndex = 2;
  const fontF1ObjIndex = 3;
  const fontF2ObjIndex = 4;
  const imageObjIndex = 5;

  const fontF1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  const fontF2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  const pageObjectIndices: number[] = [];
  const streamObjectIndices: number[] = [];

  let nextObjIndex = 6;
  for (let i = 0; i < totalPages; i++) {
    pageObjectIndices.push(nextObjIndex++);
    streamObjectIndices.push(nextObjIndex++);
  }

  const pagesKids = pageObjectIndices.map((idx) => `${idx} 0 R`).join(" ");
  const pagesObj = `<< /Type /Pages /Kids [${pagesKids}] /Count ${totalPages} >>`;
  const catalogObj = `<< /Type /Catalog /Pages ${pagesObjIndex} 0 R >>`;

  // Image XObject header and stream
  const imageHeader = `<< /Type /XObject /Subtype /Image /Width ${TRUCCOS_LOGO_WIDTH} /Height ${TRUCCOS_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`;

  const objBuffers: Uint8Array[] = [];

  function setStringObj(index: number, content: string) {
    objBuffers[index - 1] = stringToUint8Array(`${index} 0 obj\n${content}\nendobj\n`);
  }

  setStringObj(catalogObjIndex, catalogObj);
  setStringObj(pagesObjIndex, pagesObj);
  setStringObj(fontF1ObjIndex, fontF1);
  setStringObj(fontF2ObjIndex, fontF2);

  // Store Image Object as binary Uint8Array
  objBuffers[imageObjIndex - 1] = concatUint8Arrays([
    stringToUint8Array(`${imageObjIndex} 0 obj\n${imageHeader}`),
    jpegBuffer,
    stringToUint8Array("\nendstream\nendobj\n"),
  ]);

  for (let i = 0; i < totalPages; i++) {
    const pageObjIdx = pageObjectIndices[i];
    const streamObjIdx = streamObjectIndices[i];
    const streamContent = pageStreams[i];
    const streamBytes = stringToUint8Array(streamContent).length;

    const pageObj = `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontF1ObjIndex} 0 R /F2 ${fontF2ObjIndex} 0 R >> /XObject << /ImLogo ${imageObjIndex} 0 R >> >> /Contents ${streamObjIdx} 0 R >>`;
    const streamObj = `<< /Length ${streamBytes} >>\nstream\n${streamContent}\nendstream`;

    setStringObj(pageObjIdx, pageObj);
    setStringObj(streamObjIdx, streamObj);
  }

  // Assemble full PDF with binary offsets
  const headerBuf = stringToUint8Array("%PDF-1.4\n");
  const offsets: number[] = [];
  let currentOffset = headerBuf.length;

  for (let i = 0; i < objBuffers.length; i++) {
    offsets.push(currentOffset);
    currentOffset += objBuffers[i].length;
  }

  const startxref = currentOffset;
  let xref = `xref\n0 ${objBuffers.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer\n<< /Size ${objBuffers.length + 1} /Root ${catalogObjIndex} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  const trailerBuf = stringToUint8Array(xref + trailer);

  const finalPdfArray = concatUint8Arrays([headerBuf, ...objBuffers, trailerBuf]);
  return new Blob([finalPdfArray.buffer as ArrayBuffer], { type: "application/pdf" });
}

/**
 * Generates and triggers browser download of the PDF file.
 */
export function downloadQuotationPdf(quotation: QuotationData): void {
  const blob = generateQuotationPdfBlob(quotation);
  const cleanName = (quotation.customerName || "CLIENTE").replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
  const cleanNumber = (quotation.quotationNumber || "COTIZACION").replace(/[^A-Za-z0-9]/g, "_");
  const filename = `COTIZACION_${cleanName}_${quotation.currency}_${cleanNumber}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 60000);
}

/**
 * Opens a print-friendly HTML window for instant printing or browser PDF export.
 */
export function openQuotationPrintView(quotation: QuotationData): void {
  const isUsd = quotation.currency === "USD";
  const currencyBadge = isUsd
    ? "DÓLARES AMERICANOS (USD) - TARIFA FIJA"
    : `PESOS COLOMBIANOS (COP) - ${quotation.tierInfo.label.toUpperCase()}`;

  const rowsHtml = quotation.items
    .map(
      (it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? "background-color: #f8fafc;" : ""}">
      <td style="padding: 7px 8px; font-size: 11px; text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="padding: 7px 8px; font-size: 11px; font-weight: bold; font-family: monospace; color: #0f172a;">${it.referencia}</td>
      <td style="padding: 7px 8px; font-size: 11px; color: #1e293b;">${it.descripcion}</td>
      <td style="padding: 7px 8px; font-size: 11px; color: #334155;">${it.color}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: center; font-weight: 600; color: #0f172a;">${it.talla}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: center; font-weight: bold; color: #0f172a;">${it.cantidad}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: right; color: #475569;">${it.formattedPrecioAntesIva}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: right; color: #0284c7; font-weight: 600;">${it.formattedPrecioUnitIvaInc}</td>
      <td style="padding: 7px 8px; font-size: 11px; text-align: right; font-weight: bold; color: #0f172a;">${it.formattedTotalPriceWithIva}</td>
    </tr>
  `
    )
    .join("");

  const printHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cotización ${quotation.quotationNumber} - Trucco's Jeans</title>
    <style>
      @page { size: letter; margin: 10mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #0b0b0b;
        margin: 0;
        padding: 24px;
        background-color: #ffffff;
      }
      .brand-accent {
        height: 4px;
        background: #475569;
        border-radius: 2px;
        margin-bottom: 16px;
      }
      .header-wrap {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 16px;
        border-bottom: 1px solid #e5e7eb;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .brand-logo-img {
        height: 44px;
        width: auto;
        object-fit: contain;
      }
      .brand-title h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
        letter-spacing: -0.5px;
        color: #0b0b0b;
      }
      .brand-title .subtitle {
        margin: 3px 0 2px 0;
        font-size: 11px;
        font-weight: 700;
        color: #475569;
        letter-spacing: 0.5px;
      }
      .brand-title .address {
        margin: 0;
        font-size: 10px;
        color: #6b7280;
      }
      .folio-card {
        border: 1px solid #e5e7eb;
        border-top: 3px solid #475569;
        border-radius: 6px;
        padding: 10px 14px;
        background: #f8f9fa;
        min-width: 200px;
        text-align: right;
      }
      .folio-card h2 {
        margin: 0 0 6px 0;
        font-size: 12px;
        font-weight: 800;
        color: #0b0b0b;
        letter-spacing: 0.5px;
      }
      .folio-card p {
        margin: 2px 0;
        font-size: 11px;
        color: #4b5563;
      }
      .folio-card strong {
        color: #0b0b0b;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 16px;
        margin: 16px 0 20px 0;
      }
      .info-box {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px 16px;
        background: #f8f9fa;
      }
      .info-box.highlight {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .info-box h3 {
        margin: 0 0 8px 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #0b0b0b;
      }
      .info-box.highlight h3 {
        color: #334155;
      }
      .info-box p {
        margin: 3px 0;
        font-size: 11.5px;
        color: #374151;
      }
      .info-box p strong {
        color: #0b0b0b;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th {
        background: #0b0b0b;
        color: #ffffff;
        padding: 8px 10px;
        font-size: 10.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #475569;
      }
      .summary-wrap {
        margin-top: 20px;
        display: grid;
        grid-template-columns: 1.65fr 1fr;
        gap: 16px;
        align-items: stretch;
      }
      .obs-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 14px 18px;
        background: #f8f9fa;
      }
      .obs-card h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: #374151;
        letter-spacing: 0.5px;
      }
      .obs-card p {
        margin: 4px 0;
        font-size: 10.5px;
        color: #4b5563;
        line-height: 1.45;
        white-space: pre-wrap;
      }
      .total-card {
        background: #0b0b0b;
        border-top: 3px solid #64748b;
        color: #ffffff;
        padding: 14px 18px;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .total-card .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        font-size: 11px;
        color: #9ca3af;
      }
      .total-card .row strong {
        color: #ffffff;
      }
      .total-card .divider {
        height: 1px;
        background: #1f2937;
        margin: 6px 0 8px 0;
      }
      .total-card .grand-total-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .total-card .grand-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #e5e7eb;
      }
      .total-card .grand-amount {
        font-size: 22px;
        font-weight: 800;
        color: #ffffff;
      }
      .footer-note {
        margin-top: 28px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        font-size: 9.5px;
        color: #9ca3af;
        display: flex;
        justify-content: space-between;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="margin-bottom: 20px; display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: #0f172a; color: white; border: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
        🖨️ Imprimir Cotización
      </button>
      <button onclick="window.close()" style="background: #f3f4f6; color: #1f2937; border: 1px solid #d1d5db; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
        Cerrar
      </button>
    </div>

    <div class="brand-accent"></div>

    <div class="header-wrap">
      <div class="brand-title">
        <img class="brand-logo-img" src="data:image/jpeg;base64,${TRUCCOS_LOGO_JPEG_BASE64}" alt="Trucco's Jeans" />
        <div>
          <h1>TRUCCO'S JEANS</h1>
          <div class="subtitle">COMERCIAL TRUCCOS S.A.S. &nbsp;|&nbsp; NIT 900.228.614-1</div>
          <p class="address">Cra 56 # 46-49 Ed. Pompano Of. 901, Medellín · PBX: (+57) 314 865 1454 · www.truccos.com.co</p>
        </div>
      </div>
      <div class="folio-card">
        <h2>COTIZACIÓN COMERCIAL</h2>
        <p>Folio: <strong>${quotation.quotationNumber}</strong></p>
        <p>Fecha: <strong>${quotation.dateFormatted}</strong></p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>Información del Cliente</h3>
        <p><strong>Cliente:</strong> ${quotation.customerName}</p>
        <p><strong>Asesor Comercial:</strong> ${quotation.advisorName}</p>
        <p><strong>Vigencia:</strong> 15 días calendario</p>
      </div>
      <div class="info-box highlight">
        <h3>Condiciones Comerciales</h3>
        <p><strong>Moneda:</strong> ${currencyBadge}</p>
        <p><strong>Resumen:</strong> ${quotation.totalReferences} modelos &nbsp;·&nbsp; ${quotation.totalUnits} prendas totales</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 24px; text-align: center;">#</th>
          <th style="text-align: left; width: 75px;">REF</th>
          <th style="text-align: left;">DESCRIPCIÓN</th>
          <th style="text-align: left; width: 95px;">COLOR</th>
          <th style="text-align: center; width: 40px;">TALLA</th>
          <th style="text-align: center; width: 45px;">CANT</th>
          <th style="text-align: right; width: 110px;">PRECIO ANTES IVA</th>
          <th style="text-align: right; width: 130px;">P. UNIT. IVA INCLUIDO</th>
          <th style="text-align: right; width: 95px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="summary-wrap">
      <div class="obs-card">
        <h4>Observaciones y Condiciones Comerciales</h4>
        <p>• ${quotation.notes}</p>
        <p>• Formato con IVA del 19%: Precio antes de IVA, Precio unitario con IVA incluido y Total.</p>
        <p>• Precios y disponibilidad física de prendas sujetos a confirmación en bodega al momento de la orden.</p>
      </div>
      <div class="total-card">
        <div>
          <div class="row">
            <span>UNIDADES TOTALES:</span>
            <strong>${quotation.totalUnits} uds. (${quotation.totalReferences} refs)</strong>
          </div>
          <div class="row">
            <span>SUBTOTAL ANTES DE IVA:</span>
            <strong>${quotation.formattedSubtotalAntesIva}</strong>
          </div>
          <div class="row" style="color: #60a5fa; font-weight: bold; border-top: 1px dashed #374151; padding-top: 6px; margin-top: 6px;">
            <span>TOTAL IVA (19%):</span>
            <strong style="color: #93c5fd; font-size: 13px;">${quotation.formattedTotalIva}</strong>
          </div>
        </div>
        <div>
          <div class="divider"></div>
          <div class="grand-total-row">
            <span class="grand-title">TOTAL COTIZACIÓN:</span>
            <span class="grand-amount">${quotation.formattedTotalWithIva}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      <span>Trucco's Jeans · Comercial Truccos S.A.S. · NIT 900.228.614-1 · Medellín, Colombia</span>
      <span>www.truccos.com.co</span>
    </div>
  </body>
  </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
}
